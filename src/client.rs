//! Client module — the user-facing side of UNLINK.
//!
//! M1/M2 status:
//! - `keygen` — real x25519 identity keypair, persisted 0600.
//! - `send`   — real 3-hop path selection (hardcoded/config relay list; no
//!   directory/gossip yet), Sphinx packet construction via `sphinx-packet`,
//!   M2 admission proof attached ahead of the mix layers, transmission to the
//!   entry relay over plain TCP.
//! - `listen` — receive loop for messages delivered by the exit relay.
//!
//! Double Ratchet content encryption is still out of scope (Sphinx wrapping
//! is the message body for now).

use std::path::Path;

use anyhow::{Result, anyhow};
use sphinx_packet::SphinxPacket;
use sphinx_packet::constants::PAYLOAD_SIZE;
use sphinx_packet::header::delays::Delay;
use sphinx_packet::payload::PAYLOAD_OVERHEAD_SIZE;
use sphinx_packet::route::{Destination, DestinationAddressBytes, Node, NodeAddressBytes};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::config::Config;
use crate::credential::{ClientTokenWallet, Token};
use crate::net;

pub const PATH_LEN: usize = 3;
/// Plaintext budget inside the fixed 1024-byte payload: overhead (16 zeros +
/// 1 padding marker) minus our 2-byte length prefix.
pub const MAX_MSG_LEN: usize = PAYLOAD_SIZE - PAYLOAD_OVERHEAD_SIZE - 2;

/// Generate and persist an identity keypair (x25519). ed25519 identity keys
/// for signing/peer IDs are deferred (M-later, with Double Ratchet).
pub fn keygen(home: &Path) -> Result<String> {
    let sk = StaticSecret::random();
    let pk = PublicKey::from(&sk);
    let path = home.join("identity.key");
    crate::credential::write_private(&path, &sk.to_bytes())?;
    Ok(format!(
        "unlink identity written to {} (pubkey {})",
        path.display(),
        hex::encode(pk.as_bytes())
    ))
}

/// CLI send path: load wallet, spend exactly one token (clean error when out
/// of tokens), and push a proof-carrying packet into the entry relay.
pub fn send(peer: &str, msg: &str, home: &Path, config_path: &Path) -> Result<String> {
    // Validate the message BEFORE spending a token: an empty or oversized
    // message must not burn a token.
    if msg.is_empty() {
        anyhow::bail!("refusing to send an empty message");
    }
    if msg.len() > MAX_MSG_LEN {
        anyhow::bail!(
            "message too long: {} B (max {MAX_MSG_LEN} B inside the 1024-B Sphinx payload)",
            msg.len()
        );
    }

    let cfg = Config::load(config_path)?;
    let receiver = cfg.peers.get(peer).ok_or_else(|| {
        anyhow!(
            "unknown peer `{peer}` — add it under [peers] in {}",
            config_path.display()
        )
    })?;

    let mut wallet = load_wallet(home)?;
    let token = wallet.spend_token()?; // clean "out of tokens" error
    wallet.save(&home.join("wallet.json"))?;

    send_packet(&cfg, receiver, msg, Some(&token))?;
    Ok(format!(
        "sent {} B to {peer} (token epoch {}) via {} → {} → {}",
        msg.len(),
        token.epoch.0,
        cfg.relays.entry,
        cfg.relays.middle,
        cfg.relays.exit
    ))
}

fn load_wallet(home: &Path) -> Result<ClientTokenWallet> {
    let path = home.join("wallet.json");
    if !path.exists() {
        return Err(anyhow!(
            "no token wallet at `{}` — run `unlink token-issue` first",
            path.display()
        ));
    }
    ClientTokenWallet::load(&path)
}

/// Core send: build a 3-hop Sphinx packet for `receiver` and push it into the
/// entry relay. `proof = Some(token)` attaches the M2 admission proof ahead
/// of the mix layers; relays without admission config ignore it.
pub fn send_packet(cfg: &Config, receiver: &str, msg: &str, proof: Option<&Token>) -> Result<()> {
    if msg.len() > MAX_MSG_LEN {
        anyhow::bail!(
            "message too long: {} B (max {MAX_MSG_LEN} B inside the 1024-B Sphinx payload)",
            msg.len()
        );
    }
    if msg.is_empty() {
        anyhow::bail!("refusing to send an empty message");
    }

    let relays = cfg.relays.path();
    let pks = fetch_relay_pubkeys(&relays)?;

    let route: Vec<Node> = relays
        .iter()
        .zip(pks.iter())
        .map(|(addr, pk)| {
            Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr).unwrap()),
                *pk,
            )
        })
        .collect();

    // The destination *is* the recipient's delivery address; the exit relay
    // reads it from the FinalHop metadata and pushes the plaintext to it.
    let destination = Destination::new(
        DestinationAddressBytes::from_bytes(net::addr_to_field(receiver)?),
        [0u8; 16], // no mailbox identifier yet (M-later)
    );
    let delays = vec![Delay::new_from_millis(10); PATH_LEN];

    // Payload = [u16 BE len][msg]: length-prefixed so a 0x01 byte inside the
    // message cannot be confused with the crate's padding marker.
    let mut payload = Vec::with_capacity(2 + msg.len());
    payload.extend_from_slice(&(msg.len() as u16).to_be_bytes());
    payload.extend_from_slice(msg.as_bytes());

    let packet = SphinxPacket::new(payload, &route, &destination, &delays)?;

    // Frame body: [u16 proof_len][proof][packet].
    let mut body = Vec::with_capacity(2 + 74 + 256 + packet.to_bytes().len());
    match proof {
        Some(t) => {
            let proof = t.serialize();
            body.extend_from_slice(&(proof.len() as u16).to_be_bytes());
            body.extend_from_slice(&proof);
        }
        None => body.extend_from_slice(&0u16.to_be_bytes()),
    }
    body.extend_from_slice(&packet.to_bytes());

    let mut stream = net::connect(&cfg.relays.entry)?;
    net::send_frame(&mut stream, net::FRAME_SPHINX, &body)?;
    Ok(())
}

/// Ask each relay for its x25519 public key (the stand-in for directory /
/// gossip discovery, out of scope for M1/M2).
fn fetch_relay_pubkeys(addrs: &[&str; 3]) -> Result<[PublicKey; 3]> {
    let mut keys: Vec<PublicKey> = Vec::with_capacity(addrs.len());
    for addr in addrs {
        let mut stream = net::connect(addr)?;
        net::send_frame(&mut stream, net::FRAME_INFO_REQ, &[])?;
        let (ty, body) = net::recv_frame(&mut stream)?
            .ok_or_else(|| anyhow!("relay {addr} closed without responding"))?;
        if ty != net::FRAME_INFO_RESP || body.len() != 32 {
            anyhow::bail!("unexpected info response from {addr}");
        }
        let arr: [u8; 32] = body.try_into().unwrap();
        keys.push(PublicKey::from(arr));
    }
    keys.try_into()
        .map_err(|_| anyhow!("expected exactly {PATH_LEN} relay public keys"))
}

/// Receive loop for a client: prints messages delivered by the exit relay.
pub fn listen(addr: &str) -> Result<String> {
    let listener = std::net::TcpListener::bind(addr)?;
    println!("unlink listening on {addr} — waiting for delivered messages (Ctrl-C to stop)");
    for stream in listener.incoming() {
        let mut stream = match stream {
            Ok(s) => s,
            Err(e) => {
                eprintln!("accept error: {e}");
                continue;
            }
        };
        match net::recv_frame(&mut stream) {
            Ok(Some((net::FRAME_DELIVER, body))) => {
                println!("message: {}", String::from_utf8_lossy(&body));
            }
            Ok(Some((ty, _))) => println!("unexpected frame type {ty}"),
            _ => {}
        }
    }
    Ok("listener stopped".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sphinx_packet::constants::SECURITY_PARAMETER;
    use sphinx_packet::packet::ProcessedPacketData;

    /// The core anonymity property (spec §3.2), verified in code rather than
    /// assumed: build a 3-hop packet and unwrap it hop by hop, asserting
    /// exactly what each relay can and cannot see.
    ///
    /// - Hop 1 sees only hop 2's address; the remainder it forwards contains
    ///   neither hop 3's address, nor the final destination (the receiver),
    ///   nor the plaintext.
    /// - Hop 2 sees only hop 3's address; still no destination/plaintext.
    /// - Only hop 3 (the exit) sees the destination and the plaintext.
    /// - At no point does a processed result expose both a next hop and the
    ///   final destination: `ForwardHop` has no payload field and `FinalHop`
    ///   has no next-hop field (structural guarantee of the enum).
    #[test]
    fn three_hop_per_hop_visibility() {
        let sk1 = StaticSecret::random();
        let pk1 = PublicKey::from(&sk1);
        let sk2 = StaticSecret::random();
        let pk2 = PublicKey::from(&sk2);
        let sk3 = StaticSecret::random();
        let pk3 = PublicKey::from(&sk3);
        let addr1 = "127.0.0.1:7001";
        let addr2 = "127.0.0.1:7002";
        let addr3 = "127.0.0.1:7003";
        let receiver = "127.0.0.1:9001";
        let marker = "TOP-SECRET-MARKER";

        let route = [
            Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr1).unwrap()),
                pk1,
            ),
            Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr2).unwrap()),
                pk2,
            ),
            Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr3).unwrap()),
                pk3,
            ),
        ];
        let destination = Destination::new(
            DestinationAddressBytes::from_bytes(net::addr_to_field(receiver).unwrap()),
            [0u8; 16],
        );
        let delays = vec![Delay::new_from_millis(10); 3];

        let mut payload = Vec::new();
        payload.extend_from_slice(&(marker.len() as u16).to_be_bytes());
        payload.extend_from_slice(marker.as_bytes());
        let packet = SphinxPacket::new(payload, &route, &destination, &delays).unwrap();

        // ---- hop 1 ----
        let (p2, a2) = match packet.process(&sk1).unwrap().data {
            ProcessedPacketData::ForwardHop {
                next_hop_packet,
                next_hop_address,
                delay,
            } => {
                assert_eq!(delay.to_duration(), std::time::Duration::from_millis(10));
                (
                    next_hop_packet,
                    net::field_to_addr(next_hop_address.as_bytes()),
                )
            }
            _ => panic!("hop 1 must be a forward hop"),
        };
        assert_eq!(a2, addr2, "hop 1 sees only its next hop");
        let p2_bytes = p2.to_bytes();
        assert!(
            !contains_subslice(&p2_bytes, addr3.as_bytes()),
            "hop 1 must not see hop 3's address"
        );
        assert!(
            !contains_subslice(&p2_bytes, receiver.as_bytes()),
            "hop 1 must not see the receiver's address"
        );
        assert!(
            !contains_subslice(&p2_bytes, marker.as_bytes()),
            "hop 1 must not see the plaintext"
        );

        // ---- hop 2 ----
        let (p3, a3) = match p2.process(&sk2).unwrap().data {
            ProcessedPacketData::ForwardHop {
                next_hop_packet,
                next_hop_address,
                ..
            } => (
                next_hop_packet,
                net::field_to_addr(next_hop_address.as_bytes()),
            ),
            _ => panic!("hop 2 must be a forward hop"),
        };
        assert_eq!(a3, addr3, "hop 2 sees only its next hop");
        let p3_bytes = p3.to_bytes();
        assert!(
            !contains_subslice(&p3_bytes, receiver.as_bytes()),
            "hop 2 must not see the receiver's address"
        );
        assert!(
            !contains_subslice(&p3_bytes, marker.as_bytes()),
            "hop 2 must not see the plaintext"
        );

        // ---- hop 3 (exit): destination + plaintext only ----
        match p3.process(&sk3).unwrap().data {
            ProcessedPacketData::FinalHop {
                destination,
                payload,
                ..
            } => {
                assert_eq!(net::field_to_addr(&destination.as_bytes()), receiver);
                let raw = payload.as_bytes();
                let start = SECURITY_PARAMETER;
                let len = u16::from_be_bytes([raw[start], raw[start + 1]]) as usize;
                assert_eq!(&raw[start + 2..start + 2 + len], marker.as_bytes());
            }
            _ => panic!("hop 3 must be the final hop"),
        }
    }

    fn contains_subslice(haystack: &[u8], needle: &[u8]) -> bool {
        haystack.windows(needle.len()).any(|w| w == needle)
    }

    #[test]
    fn empty_message_rejected() {
        let cfg = Config {
            relays: crate::config::Relays {
                entry: "127.0.0.1:1".into(),
                middle: "127.0.0.1:1".into(),
                exit: "127.0.0.1:1".into(),
            },
            peers: Default::default(),
        };
        assert!(send_packet(&cfg, "127.0.0.1:1", "", None).is_err());
    }
}
