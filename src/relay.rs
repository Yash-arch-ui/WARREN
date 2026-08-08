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
//! **Cover traffic (M5, spec §3.2):** a relay configured with
//! [`CoverConfig`] emits random-payload Sphinx packets on a Poisson schedule,
//! routed through its successors and terminated at a reserved drop
//! destination the exit discards instead of delivering. Cover is generated
//! in-process — *after* the M2 admission gate — and forwarded with the same
//! empty-proof framing as real relay-to-relay traffic, so it is
//! wire-indistinguishable from real traffic and never spends tokens.

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
use sphinx_packet::route::{Destination, DestinationAddressBytes, Node, NodeAddressBytes};
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

/// Cover-traffic configuration (M5, spec §3.2's "cover traffic... tunable per
/// user"). `Some` with `rate_per_sec > 0` makes the relay emit dummy Sphinx
/// packets on a constant-rate Poisson schedule, routed through its successors
/// and dropped at the exit.
pub struct CoverConfig {
    /// Cover packets per second (Poisson process rate; mean inter-arrival is
    /// 1/rate). 0 disables emission even if a config is present.
    pub rate_per_sec: f64,
    /// Mean per-hop delay (ms) for cover packets, sampled from Exp — cover
    /// must not be distinguishable from real traffic by timing either.
    pub delay_mean_ms: u64,
    /// The relay's view of the mix chain, in mix order (this relay included).
    /// The relay finds its own position and routes cover through its
    /// successors. Needed because relays do not run a directory (M5+); the
    /// operator passes the fixed chain it belongs to.
    pub network: Vec<String>,
}

/// Run the relay loop. Blocks forever. Prints a machine-readable startup
/// block once bound:
///
/// ```text
/// warren relay listening on <addr> sphinx=<hex64> identity=<hex64>
/// relay claim: <json>
/// ```
///
/// The claim line is the relay's self-signed metadata; clients assemble it
/// into a gossip list (see `warren directory-fetch`).
pub fn start(
    port: u16,
    key_path: Option<&Path>,
    admission: Option<Arc<Mutex<RelayAdmission>>>,
    cover: Option<CoverConfig>,
) -> Result<()> {
    let keys = load_or_generate_keys(key_path)?;
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    let actual = listener.local_addr()?.to_string();

    // Self-sign the claim once, at startup, over the *actual* bound address.
    let claim = directory::sign_claim(&actual, *keys.sphinx_pk.as_bytes(), &keys.identity_sk);
    println!(
        "warren relay listening on {actual} sphinx={} identity={}",
        hex::encode(keys.sphinx_pk.as_bytes()),
        hex::encode(keys.identity_pk)
    );
    println!("relay claim: {}", claim.to_json_string()?);

    // Cover traffic (M5): a dedicated emitter thread so the accept loop and
    // per-connection handlers are never blocked by cover scheduling. It only
    // needs the successor *public* keys (fetched over the handshake), not the
    // relay's own Sphinx secret.
    if let Some(cover) = cover.filter(|c| c.rate_per_sec > 0.0) {
        let network = cover.network.clone();
        let self_addr = actual.clone();
        std::thread::spawn(move || {
            cover_loop(cover.rate_per_sec, cover.delay_mean_ms, network, self_addr)
        });
    }

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
                if mix::is_drop_destination(&addr) {
                    // Cover traffic (M5): a reserved drop destination is
                    // discarded here rather than delivered. The destination
                    // lives inside the innermost Sphinx layer, so only this
                    // relay can see it — a wire observer cannot.
                    println!("drop: cover");
                    return;
                }
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

/// Run a relay's cover-traffic emitter: on a Poisson schedule, build a
/// random-payload Sphinx packet routed through this relay's successors and
/// push it to the first one. The packet terminates at a reserved
/// [`mix::DROP_DESTINATION_PREFIX`] address, so the exit drops it instead of
/// delivering. Cover is generated in-process — after the M2 admission gate —
/// and forwarded with the same empty-proof framing as real relay-to-relay
/// traffic, so it never touches the token gate and is wire-indistinguishable
/// from real forwarding.
///
/// Successor keys are fetched over the relay handshake (the signed claim) and
/// cached; if the successors are not up yet (relay startup order), the loop
/// retries on the next tick instead of dying.
fn cover_loop(rate: f64, delay_mean_ms: u64, network: Vec<String>, self_addr: String) {
    let Some(pos) = network.iter().position(|a| *a == self_addr) else {
        eprintln!("cover: own address {self_addr} not found in --network; cover disabled");
        return;
    };
    let successors: Vec<String> = network[pos + 1..].to_vec();
    if successors.is_empty() {
        // Exit relay: no successors to route cover through; nothing to pad.
        return;
    }
    let mut rng = rand::rng();
    let mut keys: Option<crate::directory::SignedRelayList> = None;
    loop {
        let wait = mix::poisson_interarrival_ms(rate, &mut rng);
        std::thread::sleep(Duration::from_millis(wait.max(1)));

        if keys.is_none() {
            let addrs: Vec<&str> = successors.iter().map(String::as_str).collect();
            match crate::directory::fetch_claims_from(&addrs) {
                Ok(list) => keys = Some(list),
                Err(e) => {
                    eprintln!("cover: successors not reachable yet: {e}");
                    continue;
                }
            }
        }

        match build_cover_packet(&successors, keys.as_ref().unwrap(), &mut rng, delay_mean_ms) {
            Ok(packet) => {
                // Own-emission log (a relay knows its own cover; a wire
                // observer does not). Only the exit relay ever sees the drop
                // destination, so this cannot mark cover on the wire.
                println!(
                    "cover: sent {} B to {}",
                    packet.to_bytes().len(),
                    successors[0]
                );
                if let Err(e) = forward_packet(&successors[0], &packet.to_bytes()) {
                    eprintln!("cover: forward failed: {e}");
                }
            }
            Err(e) => eprintln!("cover: build failed: {e}"),
        }
    }
}

/// Build one cover Sphinx packet: a random payload routed through `successors`
/// and terminated at a reserved drop destination. Same wire format as a real
/// packet (constant-size Sphinx, per-hop delays sampled from Exp), so it is
/// indistinguishable to a wire observer; the final relay drops it.
fn build_cover_packet(
    successors: &[String],
    list: &crate::directory::SignedRelayList,
    rng: &mut impl rand::RngExt,
    delay_mean_ms: u64,
) -> Result<SphinxPacket> {
    let route: Vec<Node> = successors
        .iter()
        .map(|addr| {
            let claim = list
                .get(addr)
                .ok_or_else(|| anyhow!("cover: {addr} not in successor claims"))?;
            Ok(Node::new(
                NodeAddressBytes::from_bytes(net::addr_to_field(addr)?),
                PublicKey::from(claim.sphinx_pubkey),
            ))
        })
        .collect::<Result<_>>()?;
    let destination = Destination::new(
        DestinationAddressBytes::from_bytes(net::addr_to_field(&format!(
            "{}cover",
            mix::DROP_DESTINATION_PREFIX
        ))?),
        [0u8; 16],
    );
    let delays: Vec<Delay> = (0..successors.len())
        .map(|_| mix::delay_from_ms(mix::exp_delay_ms(delay_mean_ms, rng)))
        .collect();
    // Random payload (content is encrypted by Sphinx and dropped at the exit;
    // it exists so the packet is not structurally empty).
    let mut payload = vec![0u8; 64];
    for b in payload.iter_mut() {
        *b = rng.random_range(0..=u8::MAX);
    }
    SphinxPacket::new(payload, &route, &destination, &delays)
        .map_err(|e| anyhow!("cover: SphinxPacket::new failed: {e}"))
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
        None => crate::config::warren_home().join("relay.key"),
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
        let path = std::env::temp_dir().join(format!("warren-relay-key-{}", std::process::id()));
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
            std::env::temp_dir().join(format!("warren-relay-key-old-{}", std::process::id()));
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

    /// A cover packet must be a real, processable Sphinx packet: routed
    /// through the successors and terminated at a reserved drop destination
    /// (so the exit discards it) — verified in code, not assumed.
    #[test]
    fn cover_packet_routes_to_successors_and_terminates_at_drop() {
        use rand::SeedableRng;
        use rand::rngs::StdRng;

        let sk1 = StaticSecret::random();
        let pk1 = PublicKey::from(&sk1);
        let sk2 = StaticSecret::random();
        let pk2 = PublicKey::from(&sk2);
        let id_sk1 = ed25519_dalek::SigningKey::from_bytes(&rand::random::<[u8; 32]>());
        let id_sk2 = ed25519_dalek::SigningKey::from_bytes(&rand::random::<[u8; 32]>());
        let a1 = "127.0.0.1:7002";
        let a2 = "127.0.0.1:7003";
        let list = crate::directory::SignedRelayList::from_claims(vec![
            directory::sign_claim(a1, *pk1.as_bytes(), &id_sk1),
            directory::sign_claim(a2, *pk2.as_bytes(), &id_sk2),
        ]);
        let successors = vec![a1.to_string(), a2.to_string()];
        let mut rng = StdRng::seed_from_u64(9);
        let packet = build_cover_packet(&successors, &list, &mut rng, 10).unwrap();

        // Hop 1 (middle): a plain forward hop to the exit — nothing about the
        // packet marks it as cover at this layer.
        let p2 = match packet.process(&sk1).unwrap().data {
            ProcessedPacketData::ForwardHop {
                next_hop_packet,
                next_hop_address,
                ..
            } => {
                assert_eq!(net::field_to_addr(next_hop_address.as_bytes()), a2);
                next_hop_packet
            }
            _ => panic!("cover hop 1 must be a forward hop"),
        };
        // Hop 2 (exit): final hop with the reserved drop destination.
        match p2.process(&sk2).unwrap().data {
            ProcessedPacketData::FinalHop { destination, .. } => {
                let addr = net::field_to_addr(&destination.as_bytes());
                assert!(mix::is_drop_destination(&addr), "got {addr}");
            }
            _ => panic!("cover hop 2 must be the final hop"),
        }
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
