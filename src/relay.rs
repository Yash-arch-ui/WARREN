//! Relay module — a mix relay node (M1: real transport).
//!
//! Receives a length-prefixed frame over TCP, and for a Sphinx-packet frame:
//!
//! 1. **Admission gate (M2)** — if the relay is configured with an issuer
//!    public key, it checks the blind-signature token that rides *ahead of*
//!    the mix-wrapped packet (the "Layer 2 position": attached before mix
//!    wrapping, so it is checkable without unwrapping any mix layer — see
//!    `docs/THREAT_MODEL.md` §4). Invalid/spent/missing proofs are dropped.
//!    Only the entry relay enforces admission in M2; relay-to-relay frames
//!    carry no proof (see the design note in `docs/THREAT_MODEL.md`).
//! 2. **Unwrap-and-forward (M1)** — `SphinxPacket::process(&relay_secret)`
//!    peels exactly one layer. The result is *either* a `ForwardHop`
//!    (the next relay's address + the re-encrypted remainder, which reveals
//!    nothing about the sender, the final destination, or the plaintext) *or*
//!    a `FinalHop` (destination + plaintext payload). A relay can never
//!    recover both the previous and the next hop from a single packet — that
//!    per-hop unlinkability is what this module is built on; it is verified
//!    in code in `client.rs` tests (`three_hop_per_hop_visibility`).
//!
//! The per-hop header `Delay` is logged but not enforced: traffic shaping /
//! timing mixing is M3 (global timing correlation is an accepted gap — see
//! `docs/THREAT_MODEL.md` §3.1).

use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{Result, anyhow};
use sphinx_packet::SphinxPacket;
use sphinx_packet::constants::SECURITY_PARAMETER;
use sphinx_packet::packet::ProcessedPacketData;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::credential::{AdmissionDecision, RelayAdmission};
use crate::net;

/// Run the relay loop. Blocks forever. Prints a single machine-readable
/// `unlink relay listening on <addr> pubkey <hex>` line once bound (used by
/// tests and by operators to fetch relay public keys).
pub fn start(
    port: u16,
    key_path: Option<&Path>,
    admission: Option<Arc<Mutex<RelayAdmission>>>,
) -> Result<()> {
    let (sk, pk) = load_or_generate_key(key_path)?;
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let actual = listener.local_addr()?.to_string();
    println!(
        "unlink relay listening on {actual} pubkey {}",
        hex::encode(pk.as_bytes())
    );

    for stream in listener.incoming() {
        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                eprintln!("accept error: {e}");
                continue;
            }
        };
        let sk = sk.clone();
        let admission = admission.clone();
        std::thread::spawn(move || handle_connection(stream, &sk, &pk, admission));
    }
    Ok(())
}

fn handle_connection(
    mut stream: TcpStream,
    sk: &StaticSecret,
    pk: &PublicKey,
    admission: Option<Arc<Mutex<RelayAdmission>>>,
) {
    let frame = match net::recv_frame(&mut stream) {
        Ok(Some(f)) => f,
        Ok(None) => return,
        Err(e) => {
            println!("error: recv failed: {e}");
            return;
        }
    };
    match frame.0 {
        net::FRAME_INFO_REQ => {
            let _ = net::send_frame(&mut stream, net::FRAME_INFO_RESP, pk.as_bytes());
        }
        net::FRAME_SPHINX => handle_sphinx(stream, sk, admission, &frame.1),
        other => println!("error: unknown frame type {other}"),
    }
}

fn handle_sphinx(
    _stream: TcpStream,
    sk: &StaticSecret,
    admission: Option<Arc<Mutex<RelayAdmission>>>,
    body: &[u8],
) {
    // Frame body layout: [u16 proof_len][proof][sphinx packet bytes].
    let (proof, packet_bytes) = match split_proof(body) {
        Ok(v) => v,
        Err(e) => {
            println!("drop: malformed-proof ({e})");
            return;
        }
    };

    if let Some(admission) = admission {
        if proof.is_empty() {
            println!("drop: missing-proof");
            return;
        }
        let token = match crate::credential::Token::deserialize(proof) {
            Ok(t) => t,
            Err(_) => {
                println!("drop: malformed-proof");
                return;
            }
        };
        // NOTE: token identifiers are deliberately NOT logged — logging them
        // would hand an observer a linkable per-redemption identifier (see
        // the M2 unlinkability integration test).
        let decision = {
            let mut adm = admission.lock().expect("admission lock poisoned");
            adm.check_and_mark(&token)
        };
        match decision {
            AdmissionDecision::Admit => println!("admit epoch={}", token.epoch.0),
            AdmissionDecision::Deny { reason } => {
                println!("drop: {reason}");
                return;
            }
        }
    }

    let packet = match SphinxPacket::from_bytes(packet_bytes) {
        Ok(p) => p,
        Err(e) => {
            println!("error: bad packet: {e}");
            return;
        }
    };

    match packet.process(sk) {
        Ok(processed) => match processed.data {
            ProcessedPacketData::ForwardHop {
                next_hop_packet,
                next_hop_address,
                delay,
            } => {
                let addr = net::field_to_addr(next_hop_address.as_bytes());
                println!(
                    "forward to {addr} delay={}ms",
                    delay.to_duration().as_millis()
                );
                match forward_packet(&addr, &next_hop_packet.to_bytes()) {
                    Ok(()) => {}
                    Err(e) => println!("error: forwarding to {addr} failed: {e}"),
                }
            }
            ProcessedPacketData::FinalHop {
                destination,
                payload,
                ..
            } => {
                let addr = net::field_to_addr(&destination.as_bytes());
                println!("deliver to {addr}");
                let msg = parse_payload(payload.as_bytes());
                deliver(&addr, &msg);
            }
        },
        Err(e) => println!("error: unwrap failed: {e}"),
    }
}

/// Split a frame body into `(proof, packet_bytes)`.
fn split_proof(body: &[u8]) -> Result<(&[u8], &[u8])> {
    if body.len() < 2 {
        return Err(anyhow!("body too short for proof length"));
    }
    let proof_len = u16::from_be_bytes([body[0], body[1]]) as usize;
    if body.len() < 2 + proof_len {
        return Err(anyhow!("proof length exceeds body"));
    }
    Ok((&body[2..2 + proof_len], &body[2 + proof_len..]))
}

/// Forward the peeled packet to the next relay. Relay-to-relay frames use the
/// same layout as client frames — `[u16 proof_len][proof][packet]` — with an
/// empty proof, so a receiving relay parses the frame uniformly (a relay
/// without an admission gate simply ignores the (empty) proof).
fn forward_packet(addr: &str, packet_bytes: &[u8]) -> Result<()> {
    let mut body = Vec::with_capacity(2 + packet_bytes.len());
    body.extend_from_slice(&0u16.to_be_bytes());
    body.extend_from_slice(packet_bytes);
    let mut upstream = net::connect(addr)?;
    net::send_frame(&mut upstream, net::FRAME_SPHINX, &body)?;
    Ok(())
}

fn deliver(receiver_addr: &str, msg: &[u8]) {
    match net::connect(receiver_addr) {
        Ok(mut client) => {
            if let Err(e) = net::send_frame(&mut client, net::FRAME_DELIVER, msg) {
                println!("deliver failed: {e}");
            }
        }
        Err(e) => println!("deliver failed: cannot reach {receiver_addr}: {e}"),
    }
}

/// Recover the message from a final payload: `[SECURITY_PARAMETER zeros]
/// [u16 BE msg_len][msg][0x01][zero padding]` — the length prefix is ours
/// (see `client::send_packet`) and avoids ambiguity when the message itself
/// contains the `0x01` padding marker.
fn parse_payload(payload: &[u8]) -> Vec<u8> {
    let start = SECURITY_PARAMETER;
    if payload.len() < start + 2 {
        return Vec::new();
    }
    let len = u16::from_be_bytes([payload[start], payload[start + 1]]) as usize;
    let msg_start = start + 2;
    if payload.len() < msg_start + len {
        return Vec::new();
    }
    payload[msg_start..msg_start + len].to_vec()
}

fn load_or_generate_key(key_path: Option<&Path>) -> Result<(StaticSecret, PublicKey)> {
    let path = match key_path {
        Some(p) => p.to_path_buf(),
        None => crate::config::unlink_home().join("relay.key"),
    };
    if path.exists() {
        let raw = std::fs::read(&path)?;
        if raw.len() != 32 {
            return Err(anyhow!(
                "bad relay key file `{}` (expected 32 bytes)",
                path.display()
            ));
        }
        let sk = StaticSecret::from(<[u8; 32]>::try_from(raw.as_slice()).unwrap());
        let pk = PublicKey::from(&sk);
        Ok((sk, pk))
    } else {
        let sk = StaticSecret::random();
        let pk = PublicKey::from(&sk);
        crate::credential::write_private(&path, &sk.to_bytes())?;
        Ok((sk, pk))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_generates_and_reloads() {
        let path = std::env::temp_dir().join(format!("unlink-relay-key-{}", std::process::id()));
        let (sk1, pk1) = load_or_generate_key(Some(&path)).unwrap();
        let (_sk2, pk2) = load_or_generate_key(Some(&path)).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(pk1.as_bytes(), pk2.as_bytes());
        assert_eq!(sk1.to_bytes(), _sk2.to_bytes());
    }

    #[test]
    fn payload_parse_respects_length_prefix() {
        // Message that contains the 0x01 padding marker: only the length
        // prefix can disambiguate it.
        let mut msg = b"a\x01b\x01c".to_vec();
        let mut payload = vec![0u8; SECURITY_PARAMETER];
        payload.extend_from_slice(&(msg.len() as u16).to_be_bytes());
        payload.append(&mut msg);
        payload.push(1);
        payload.extend_from_slice(&[0u8; 32]);
        assert_eq!(parse_payload(&payload), b"a\x01b\x01c");
    }

    #[test]
    fn split_proof_parses() {
        let body = vec![0u8, 4, 1, 2, 3, 4, 9, 9, 9];
        let (proof, rest) = split_proof(&body).unwrap();
        assert_eq!(proof, &[1, 2, 3, 4]);
        assert_eq!(rest, &[9, 9, 9]);
        assert!(split_proof(&[0u8, 5, 1, 2]).is_err());
    }
}
