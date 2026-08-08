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
//! The per-hop header `Delay` is **enforced**: before forwarding, the relay
//! sleeps for the delay the *sender* chose (tunable per user via
//! `[relays] delay_ms`, spec §3.2). Since M5 the client samples each hop's
//! delay from an exponential distribution (Poisson mixing), so the honored
//! delay is a distribution, not a constant offset. The honored delay is
//! **capped** at [`MAX_HONORED_DELAY_MS`]: the header value is
//! sender-controlled, so an uncapped sleep would let one malicious frame pin
//! a relay thread (and its open socket) for an arbitrarily long time.
//!
//! **Cover traffic (spec §3.2) lands in the second half of M5** (the
//! relay-side dummy-packet emitter, its own commit).

/// Upper bound a relay will sleep for a sender-chosen per-hop delay, in
/// milliseconds. Defense against the unbounded-delay DoS: a client can put
/// any value in the Sphinx header, so without a cap one hostile frame could
/// pin a relay's connection thread indefinitely. Delays above this are
/// clamped (and logged), not honored. (Single source of truth:
/// [`mix::MAX_DELAY_MS`], which the client-side sampler clamps to as well.)
pub const MAX_HONORED_DELAY_MS: u64 = mix::MAX_DELAY_MS;

use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use anyhow::{Result, anyhow};
use ed25519_dalek::SigningKey;
use sphinx_packet::SphinxPacket;
use sphinx_packet::constants::SECURITY_PARAMETER;
use sphinx_packet::header::delays::Delay;
use sphinx_packet::packet::ProcessedPacketData;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::credential::{AdmissionDecision, RelayAdmission};
use crate::directory::{self, RelayClaim};
use crate::mix;
use crate::net;

/// A relay's two key roles: the per-session x25519 Sphinx key and the
/// long-term ed25519 identity key that signs its claim (see
/// `docs/LIBRARY_SELECTION.md` §4 and `docs/THREAT_MODEL.md` §2.E).
pub struct RelayKeys {
    pub sphinx_sk: StaticSecret,
    pub sphinx_pk: PublicKey,
    pub identity_sk: SigningKey,
    pub identity_pk: [u8; 32],
}

/// Run the relay loop. Blocks forever. Prints a machine-readable startup
/// block once bound:
///
/// ```text
/// unlink relay listening on <addr> sphinx=<hex64> identity=<hex64>
/// relay claim: <json>
/// ```
///
/// The claim line is the relay's self-signed metadata; clients assemble it
/// into a gossip list (see `unlink directory-fetch`).
pub fn start(
    port: u16,
    key_path: Option<&Path>,
    admission: Option<Arc<Mutex<RelayAdmission>>>,
) -> Result<()> {
    let keys = load_or_generate_keys(key_path)?;
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let actual = listener.local_addr()?.to_string();

    // Self-sign the claim once, at startup, over the *actual* bound address.
    let claim = directory::sign_claim(&actual, *keys.sphinx_pk.as_bytes(), &keys.identity_sk);
    println!(
        "unlink relay listening on {actual} sphinx={} identity={}",
        hex::encode(keys.sphinx_pk.as_bytes()),
        hex::encode(keys.identity_pk)
    );
    println!("relay claim: {}", claim.to_json_string()?);

    for stream in listener.incoming() {
        let stream = match stream {
            Ok(s) => s,
            Err(e) => {
                eprintln!("accept error: {e}");
                continue;
            }
        };
        let sk = keys.sphinx_sk.clone();
        let claim = claim.clone();
        let admission = admission.clone();
        std::thread::spawn(move || handle_connection(stream, &sk, &claim, admission));
    }
    Ok(())
}

fn handle_connection(
    mut stream: TcpStream,
    sk: &StaticSecret,
    claim: &RelayClaim,
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
            // The handshake returns the self-signed claim (canonical bytes +
            // signature) — clients verify it and cross-check against their
            // gossip list instead of trusting a raw pubkey (spec §8.5).
            let _ = net::send_frame(&mut stream, net::FRAME_INFO_RESP, &claim.to_wire());
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
                let delay_dur = enforce_delay(delay);
                println!("forward to {addr} delay={}ms", delay_dur.as_millis());
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

/// Clamp a sender-chosen per-hop delay to [`MAX_HONORED_DELAY_MS`]. The
/// header value is sender-controlled, so without a cap one hostile frame
/// could pin a relay's connection thread indefinitely (DoS).
fn clamp_delay(delay: Delay) -> (Duration, bool) {
    let cap = Duration::from_millis(MAX_HONORED_DELAY_MS);
    let delay_dur = delay.to_duration();
    if delay_dur > cap {
        (cap, true)
    } else {
        (delay_dur, false)
    }
}

/// Sleep for a sender-chosen per-hop mix delay (spec §3.2), **clamped** via
/// [`clamp_delay`]. `FinalHop` carries no delay field in this crate, so the
/// exit delivers immediately — entry+middle still contribute two enforced
/// delay points on a 3-hop path. Returns the duration actually slept.
fn enforce_delay(delay: Delay) -> Duration {
    let (honored, clamped) = clamp_delay(delay);
    if clamped {
        println!(
            "delay clamped to {}ms (sender asked {}ms)",
            honored.as_millis(),
            delay.to_duration().as_millis()
        );
    }
    if !honored.is_zero() {
        std::thread::sleep(honored);
    }
    honored
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

/// Load or generate the relay keypair file: `[x25519 secret 32][ed25519
/// secret 32]` (64 bytes, 0600). An old 32-byte file (x25519 only, from
/// M1/M2) is migrated by generating the ed25519 identity key and rewriting.
fn load_or_generate_keys(key_path: Option<&Path>) -> Result<RelayKeys> {
    let path = match key_path {
        Some(p) => p.to_path_buf(),
        None => crate::config::unlink_home().join("relay.key"),
    };

    let (sphinx_sk, identity_sk) = if path.exists() {
        let raw = std::fs::read(&path)?;
        match raw.len() {
            64 => {
                let sphinx_sk = StaticSecret::from(<[u8; 32]>::try_from(&raw[0..32]).unwrap());
                let identity_sk =
                    SigningKey::from_bytes(&<[u8; 32]>::try_from(&raw[32..64]).unwrap());
                (sphinx_sk, identity_sk)
            }
            // M1/M2 key files were x25519-only (32 bytes); keep the Sphinx
            // key and mint a fresh long-term identity.
            32 => {
                let sphinx_sk = StaticSecret::from(<[u8; 32]>::try_from(raw.as_slice()).unwrap());
                let identity_sk = SigningKey::from_bytes(&rand::random::<[u8; 32]>());
                (sphinx_sk, identity_sk)
            }
            other => {
                return Err(anyhow!(
                    "bad relay key file `{}` (expected 64 bytes, found {other})",
                    path.display()
                ));
            }
        }
    } else {
        let sphinx_sk = StaticSecret::random();
        let identity_sk = SigningKey::from_bytes(&rand::random::<[u8; 32]>());
        (sphinx_sk, identity_sk)
    };

    let sphinx_pk = PublicKey::from(&sphinx_sk);
    let identity_pk = identity_sk.verifying_key().to_bytes();

    // Persist (also on migration) so identity is stable across restarts.
    let mut file = Vec::with_capacity(64);
    file.extend_from_slice(&sphinx_sk.to_bytes());
    file.extend_from_slice(&identity_sk.to_bytes());
    crate::credential::write_private(&path, &file)?;

    Ok(RelayKeys {
        sphinx_sk,
        sphinx_pk,
        identity_sk,
        identity_pk,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_generate_reload_and_stay_stable() {
        let path = std::env::temp_dir().join(format!("unlink-relay-key-{}", std::process::id()));
        let k1 = load_or_generate_keys(Some(&path)).unwrap();
        let k2 = load_or_generate_keys(Some(&path)).unwrap();
        let _ = std::fs::remove_file(&path);
        // The long-term identity must survive restarts: it is the gossip
        // anchor clients pin against.
        assert_eq!(k1.sphinx_pk.as_bytes(), k2.sphinx_pk.as_bytes());
        assert_eq!(k1.identity_pk, k2.identity_pk);
        assert_eq!(k1.identity_sk.to_bytes(), k2.identity_sk.to_bytes());
    }

    #[test]
    fn old_32_byte_key_file_is_migrated() {
        // Simulate an M1/M2 x25519-only key file: it must be upgraded to the
        // 64-byte format with a stable sphinx key and a fresh identity.
        let path =
            std::env::temp_dir().join(format!("unlink-relay-key-old-{}", std::process::id()));
        let old_sk = StaticSecret::random();
        std::fs::write(&path, old_sk.to_bytes()).unwrap();
        let k = load_or_generate_keys(Some(&path)).unwrap();
        let raw = std::fs::read(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(raw.len(), 64, "migrated file must be 64 bytes");
        assert_eq!(k.sphinx_sk.to_bytes(), old_sk.to_bytes());
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
    fn delay_clamped_and_enforced() {
        // Zero delay: no sleep (returns instantly).
        let t0 = std::time::Instant::now();
        assert_eq!(enforce_delay(Delay::new_from_millis(0)), Duration::ZERO);
        assert!(t0.elapsed() < Duration::from_millis(5));

        // A normal value is honored as-is (clamp must not touch it).
        let (honored, clamped) = clamp_delay(Delay::new_from_millis(1));
        assert_eq!(honored, Duration::from_millis(1));
        assert!(!clamped);

        // An absurd sender-chosen value (built from raw nanos, the way a
        // wire-parsed header value exists) is clamped to the cap — the
        // unbounded-delay DoS must be impossible. Test the clamp purely so
        // the suite doesn't sleep the full cap.
        let (honored, clamped) = clamp_delay(Delay::new_from_nanos(u64::MAX));
        assert_eq!(
            honored,
            Duration::from_millis(MAX_HONORED_DELAY_MS),
            "hostile delay must be clamped to the cap"
        );
        assert!(clamped, "over-cap delay must be flagged as clamped");
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
