//! Client module — the user-facing side of UNLINK.
//!
//! M1–M3 status:
//! - `keygen` — real x25519 identity keypair, persisted 0600.
//! - `send`   — real 3-hop path selection (config addresses), **signed gossip
//!   list verification** (`directory::SignedRelayList`), signed-handshake
//!   verification with cross-check against the list (spec §8.5), **Layer-3
//!   Double Ratchet message-body encryption** (`ratchet`), Sphinx packet
//!   construction via `sphinx-packet`, M2 admission proof, plain-TCP
//!   transmission to the entry relay.
//! - `listen` — receive loop for messages delivered by the exit relay;
//!   decrypts each message with the Layer-3 ratchet before printing.
//!
//! Trust order in `send`: message validation → config/peer lookup → signed
//! relay list → path verification → **encryption** → token spend → transmit.
//! Everything before the token spend is a *refusal* path that must not burn
//! an admission token (spec §8.5), and encryption is one of those refusals.
//! (The token is spent *before* the network transmit, so a transport failure
//! during the final push can still cost a token — a pre-existing M1/M2
//! trade-off, distinct from the refusal paths above.)

use std::path::{Path, PathBuf};

use anyhow::{Result, anyhow};
use sphinx_packet::SphinxPacket;
use sphinx_packet::constants::PAYLOAD_SIZE;
use sphinx_packet::header::delays::Delay;
use sphinx_packet::payload::PAYLOAD_OVERHEAD_SIZE;
use sphinx_packet::route::{Destination, DestinationAddressBytes, Node, NodeAddressBytes};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::config::Config;
use crate::credential::{ClientTokenWallet, Token};
use crate::directory::{RelayClaim, SignedRelayList};
use crate::mix;
use crate::net;
use crate::ratchet::{OLM_WIRE_OVERHEAD, RatchetClient};

pub const PATH_LEN: usize = 3;
/// Plaintext budget inside the fixed 1024-byte payload: overhead (16 zeros +
/// 1 padding marker) minus our 2-byte length prefix, minus the Layer-3 olm
/// wire overhead (encrypted body replaces plaintext in the payload — see
/// `ratchet::OLM_WIRE_OVERHEAD` and the size test).
pub const MAX_MSG_LEN: usize = PAYLOAD_SIZE - PAYLOAD_OVERHEAD_SIZE - 2 - OLM_WIRE_OVERHEAD;

/// Default location of the signed gossip list for a data dir.
pub fn relays_path(home: &Path) -> PathBuf {
    home.join("relays.json")
}

/// Generate and persist an identity keypair (x25519). (Relays sign their
/// claims with ed25519 identity keys since M3; the client's message-body
/// identity lives in the Layer-3 ratchet account — see `unlink ratchet-init`.)
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
pub fn send(
    peer: &str,
    msg: &str,
    home: &Path,
    config_path: &Path,
    relays_path: &Path,
) -> Result<String> {
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
    let peer_label = peer.to_string();
    let peer = cfg.peers.get(peer).ok_or_else(|| {
        anyhow!(
            "unknown peer `{peer_label}` — add it under [peers] in {}",
            config_path.display()
        )
    })?;

    // The signed gossip list is the client's trust anchor (spec §5.4): every
    // entry must carry a valid self-signature, or the send is refused.
    let list = SignedRelayList::load_and_verify(relays_path)?;

    // Verify the path BEFORE spending a token: a relay substitution, a MITM
    // injecting its own keys, or a stale list must refuse the send without
    // burning an admission token (spec §8.5).
    let sphinx_keys = resolve_verified_path(&cfg.relays.path(), &list)?;

    // Layer 3: encrypt the message body with the Double Ratchet. The peer's
    // identity + one-time keys come from config (manual/config'd exchange, §5).
    // Also a refusal path: a missing/unparseable ratchet state must not burn
    // a token either.
    let mut ratchet = RatchetClient::load(home)?;
    let wire = ratchet.encrypt(&peer.id, &peer.otk, msg)?;

    let mut wallet = load_wallet(home)?;
    let token = wallet.spend_token()?; // clean "out of tokens" error
    wallet.save(&home.join("wallet.json"))?;

    transmit_packet(&cfg, &peer.addr, &wire, Some(&token), &sphinx_keys)?;
    Ok(format!(
        "sent {} B to {peer_label} (token epoch {}) via {} → {} → {}",
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

/// Core send: build a 3-hop Sphinx packet carrying the **Layer-3 encrypted
/// message body** and push it into the entry relay. `proof = Some(token)`
/// attaches the M2 admission proof ahead of the mix layers; relays without
/// admission config ignore it.
///
/// Trust flow (spec §8.5): for each relay on the path the client (1) looks up
/// the verified gossip-list entry for that address, (2) fetches the relay's
/// live self-signed claim over the handshake, (3) verifies the claim's
/// signature, and (4) cross-checks identity + sphinx keys against the list.
/// Any mismatch — a substituted relay, a MITM injecting its own key, a stale
/// list — aborts the send with a clean error.
///
/// `wire` is the Layer-3 ciphertext (`[u8 type][olm bytes]`); `send()`
/// produces it via `RatchetClient::encrypt`. This function is also used
/// directly by tests that craft frames (e.g. the M2 replay test).
pub fn send_packet(
    cfg: &Config,
    list: &SignedRelayList,
    receiver: &str,
    wire: &[u8],
    proof: Option<&Token>,
) -> Result<()> {
    if wire.is_empty() {
        anyhow::bail!("refusing to send an empty message body");
    }
    if wire.len() + 2 > PAYLOAD_SIZE - PAYLOAD_OVERHEAD_SIZE {
        anyhow::bail!(
            "encrypted message too large for the 1024-B Sphinx payload ({} B)",
            wire.len()
        );
    }

    let relays = cfg.relays.path();
    let sphinx_keys = resolve_verified_path(&relays, list)?;
    transmit_packet(cfg, receiver, wire, proof, &sphinx_keys)
}

/// Build the 3-hop Sphinx packet with the already-verified sphinx keys and
/// push it into the entry relay. `proof = Some(token)` attaches the M2
/// admission proof ahead of the mix layers; relays without admission config
/// ignore it.
fn transmit_packet(
    cfg: &Config,
    receiver: &str,
    wire: &[u8],
    proof: Option<&Token>,
    sphinx_keys: &[PublicKey; PATH_LEN],
) -> Result<()> {
    let relays = cfg.relays.path();
    let route: Vec<Node> = relays
        .iter()
        .zip(sphinx_keys.iter())
        .map(|(addr, pk)| {
            Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr).unwrap()),
                *pk,
            )
        })
        .collect();

    // The destination *is* the recipient's delivery address; the exit relay
    // reads it from the FinalHop metadata and pushes the ciphertext to it.
    let destination = Destination::new(
        DestinationAddressBytes::from_bytes(net::addr_to_field(receiver)?),
        [0u8; 16], // no mailbox identifier yet (M-later)
    );
    // Per-hop mix delay, tunable per user (spec §3.2): each hop's delay is
    // sampled from an exponential distribution with the configured mean
    // (Poisson mixing, M5 — see `mix`), rides in the Sphinx header, and is
    // enforced by the relay. A mean of 0 disables the delay entirely.
    let mut rng = rand::rng();
    let delays: Vec<Delay> = (0..PATH_LEN)
        .map(|_| mix::delay_from_ms(mix::exp_delay_ms(cfg.relays.delay_ms, &mut rng)))
        .collect();

    // Payload = [u16 BE len][wire]: length-prefixed so a 0x01 byte inside
    // the ciphertext cannot be confused with the crate's padding marker.
    let mut payload = Vec::with_capacity(2 + wire.len());
    payload.extend_from_slice(&(wire.len() as u16).to_be_bytes());
    payload.extend_from_slice(wire);

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

/// Resolve the path's relays against the verified gossip list: handshake each
/// relay, verify its self-signed claim, and cross-check identity + sphinx
/// keys against the list entry for that address. Returns the sphinx public
/// keys to build the route with.
fn resolve_verified_path(addrs: &[&str; 3], list: &SignedRelayList) -> Result<[PublicKey; 3]> {
    let mut sphinx_keys = Vec::with_capacity(addrs.len());
    for addr in addrs {
        let expected = list.get(addr).ok_or_else(|| {
            anyhow!(
                "relay {addr} is not in the verified relay list — re-run \
                 `unlink directory-fetch` (or check the gossip list)"
            )
        })?;
        // The relay's live claim must be a valid self-signature AND match the
        // pinned identity/sphinx keys from the list.
        let live = fetch_and_verify_claim(addr)?;
        if live.identity_pubkey != expected.identity_pubkey {
            anyhow::bail!(
                "relay {addr} identity mismatch between handshake and relay list — \
                 possible relay substitution / poisoned list (spec §8.5); refusing to send"
            );
        }
        if live.sphinx_pubkey != expected.sphinx_pubkey {
            anyhow::bail!(
                "relay {addr} sphinx key mismatch between handshake and relay list — \
                 stale list? re-run `unlink directory-fetch`"
            );
        }
        sphinx_keys.push(PublicKey::from(expected.sphinx_pubkey));
    }
    sphinx_keys
        .try_into()
        .map_err(|_| anyhow!("expected exactly {PATH_LEN} relay public keys"))
}

/// Handshake a relay and return its claim, verifying the self-signature.
/// An unsigned or tampered claim is rejected here — the client never trusts
/// a raw pubkey off the wire.
pub fn fetch_and_verify_claim(addr: &str) -> Result<RelayClaim> {
    let mut stream = net::connect(addr)?;
    net::send_frame(&mut stream, net::FRAME_INFO_REQ, &[])?;
    let (ty, body) = net::recv_frame(&mut stream)?
        .ok_or_else(|| anyhow!("relay {addr} closed without responding"))?;
    if ty != net::FRAME_INFO_RESP {
        anyhow::bail!("unexpected frame type {ty} from {addr}");
    }
    let claim = RelayClaim::from_wire(&body)?;
    claim
        .verify()
        .map_err(|e| anyhow!("relay {addr} returned an unsigned/invalid claim: {e}"))?;
    Ok(claim)
}

/// Receive loop for a client: prints messages delivered by the exit relay,
/// **decrypted** with the Layer-3 Double Ratchet. `home` holds the ratchet
/// account + sessions (`unlink ratchet-init` must have been run).
pub fn listen(addr: &str, home: &Path) -> Result<String> {
    let mut ratchet = RatchetClient::load(home)?;
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
            Ok(Some((net::FRAME_DELIVER, body))) => match ratchet.decrypt(&body) {
                Ok((sender, pt)) => {
                    println!(
                        "message from {}: {}",
                        &sender[..sender.len().min(16)],
                        String::from_utf8_lossy(&pt)
                    );
                }
                Err(e) => println!("undecryptable message dropped: {e}"),
            },
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
                delay_ms: crate::config::DEFAULT_DELAY_MS,
            },
            peers: Default::default(),
        };
        // The empty-message check runs before any network/list lookup.
        assert!(send_packet(&cfg, &SignedRelayList::default(), "127.0.0.1:1", &[], None).is_err());
    }

    /// A fake relay endpoint serving a claim over the handshake, so the
    /// client's handshake verification is unit-testable without processes.
    fn serve_claim_over_handshake(claim_bytes: Vec<u8>) -> String {
        let (listener, addr) = net::bind_any().unwrap();
        std::thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            // Expect the INFO_REQ, then answer with the claim wire bytes.
            let _ = net::recv_frame(&mut s);
            let _ = net::send_frame(&mut s, net::FRAME_INFO_RESP, &claim_bytes);
        });
        addr
    }

    #[test]
    fn handshake_claim_verified_and_parsed() {
        let sk = ed25519_dalek::SigningKey::from_bytes(&rand::random::<[u8; 32]>());
        let claim = crate::directory::sign_claim("127.0.0.1:7001", [9u8; 32], &sk);
        let addr = serve_claim_over_handshake(claim.to_wire());
        let got = fetch_and_verify_claim(&addr).unwrap();
        assert_eq!(got, claim);
        assert_eq!(got.identity_pubkey, sk.verifying_key().to_bytes());
    }

    #[test]
    fn handshake_unsigned_claim_rejected() {
        // An unsigned / garbage claim body must be rejected, never trusted.
        let addr = serve_claim_over_handshake(vec![0xde; 40]);
        let err = fetch_and_verify_claim(&addr).unwrap_err().to_string();
        assert!(
            err.contains("unsigned/invalid claim") || err.contains("too short"),
            "got: {err}"
        );
    }
}
