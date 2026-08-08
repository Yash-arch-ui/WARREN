//! M5 load test: spam resistance under **concurrent** abuse.
//!
//! M2 already proved admission works *sequentially* (valid → admit, replay →
//! drop). This suite stresses the same gate **concurrently**: a burst of
//! over-budget send attempts (a wallet with a fixed batch keeps pushing more
//! frames than it has tokens, so every surplus frame reuses an already-spent
//! token) plus invalid-signature, wrong-epoch, and malformed-proof frames —
//! all from multiple simulated clients at once.
//!
//! Assertions, in order:
//! 1. A real legitimate batch of sends works end-to-end first (baseline).
//! 2. The concurrent barrage completes without the relay crashing.
//! 3. The relay logs the *correct* drop reasons for every attack category
//!    (already-spent / invalid-signature / wrong-epoch / malformed-proof) —
//!    nothing is silently admitted.
//! 4. After the barrage, the relay still admits a fresh valid token and a
//!    full real message is delivered: no degradation, not just survival.

mod common;

use std::sync::Arc;
use std::time::{Duration, Instant};

use common::*;
use unlink::client;
use unlink::config::Config;
use unlink::credential::{ClientTokenWallet, Epoch, Issuer, Token};
use unlink::directory::SignedRelayList;
use unlink::net;
use unlink::ratchet::RatchetClient;

/// Create ONE issuer, write its public key PEM (relays load it via
/// `--admit-key`) and return it so the *same* issuer signs every wallet.
fn setup_issuer(tmp: &TempDir, epoch: u64) -> (std::path::PathBuf, Issuer) {
    let issuer = Issuer::new(Epoch(epoch)).unwrap();
    let path = tmp.path().join("issuer.pub");
    std::fs::write(&path, issuer.public_key_pem().unwrap()).unwrap();
    (path, issuer)
}

fn spawn_network(
    tmp: &TempDir,
    issuer_pub: &std::path::Path,
) -> (RelayProcess, RelayProcess, RelayProcess) {
    let entry = RelayProcess::spawn(&[
        "--key",
        &tmp.path().join("key-entry").to_string_lossy(),
        "--admit-key",
        &issuer_pub.to_string_lossy(),
        "--epoch",
        "1",
    ]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    (entry, middle, exit)
}

/// A fresh wallet with `count` tokens signed by `issuer`.
fn fresh_wallet(issuer: &Issuer, count: usize) -> ClientTokenWallet {
    let mut wallet = ClientTokenWallet::new(issuer.epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(issuer, count).unwrap();
    wallet
}

/// Push one raw SPHINX frame straight at the entry relay with the given proof
/// and (arbitrary) packet bytes. This is what a simulated abusive client
/// does — it bypasses the (wallet-side) token budget entirely.
fn push_attack_frame(entry_addr: &str, proof: &[u8], packet_bytes: &[u8]) {
    let mut body = Vec::with_capacity(2 + proof.len() + packet_bytes.len());
    body.extend_from_slice(&(proof.len() as u16).to_be_bytes());
    body.extend_from_slice(proof);
    body.extend_from_slice(packet_bytes);
    let mut stream = net::connect(entry_addr).unwrap();
    net::send_frame(&mut stream, net::FRAME_SPHINX, &body).unwrap();
}

#[test]
fn concurrent_abuse_rejected_and_relay_stays_responsive() {
    let tmp = TempDir::new("m5-load");
    let (issuer_pub, issuer) = setup_issuer(&tmp, 1);
    let (mut entry, middle, exit) = spawn_network(&tmp, &issuer_pub);

    // Bob (receiver) + alice's Layer-3 state and config.
    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);
    let cfg_path = tmp.path().join("config.toml");
    write_config(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
    );
    let cfg = Config::load(&cfg_path).unwrap();
    let list_path = tmp.path().join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    let (alice_home, _alice_id, _alice_otk) = ratchet_init(&tmp, "alice");
    let mut ratchet = RatchetClient::load(&alice_home).unwrap();
    let bob_peer = cfg.peers.get("bob").unwrap();

    // ---- Phase 1: baseline — a legitimate 4-message batch, real path. ----
    let mut budget = fresh_wallet(&issuer, 4);
    let mut spent: Vec<Token> = Vec::with_capacity(4);
    for i in 0..4 {
        let msg = format!("legit-{i}");
        let wire = ratchet.encrypt(&bob_peer.id, &bob_peer.otk, &msg).unwrap();
        let token = budget.spend_token().unwrap();
        spent.push(token.clone());
        client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
    }
    assert_eq!(
        receiver.wait_for_messages(4, Duration::from_secs(10)),
        vec![
            "legit-0".to_string(),
            "legit-1".to_string(),
            "legit-2".to_string(),
            "legit-3".to_string()
        ],
        "baseline legitimate traffic must flow"
    );

    // ---- Phase 2: concurrent barrage, 8 simulated clients. ----
    // Attack mix (200 frames): over-budget replays of the 4 spent tokens
    // (100), invalid-signature (50), malformed-proof (30), wrong-epoch (20).
    let replays: Vec<Vec<u8>> = spent.iter().map(|t| t.serialize()).collect();
    let mut invalid_sigs: Vec<Vec<u8>> = Vec::new();
    for i in 0..50 {
        let mut proof = spent[i % spent.len()].serialize();
        // Corrupt a signature byte deterministically (never the epoch/nonce
        // header, so the frame parses as a token with a bad RSA signature).
        proof[74 + i] ^= 0xff;
        invalid_sigs.push(proof);
    }
    let mut wrong_epoch: Vec<Vec<u8>> = Vec::new();
    for _ in 0..20 {
        let mut proof = spent[1].serialize();
        proof[0..8].copy_from_slice(&2u64.to_be_bytes()); // token for epoch 2
        wrong_epoch.push(proof);
    }
    let malformed: Vec<Vec<u8>> = vec![vec![0xde; 40]; 30]; // not parseable as a proof

    let mut attacks: Vec<(Vec<u8>, &'static str)> = Vec::with_capacity(200);
    for i in 0..100 {
        // Cycle through the 4 spent tokens deterministically.
        attacks.push((replays[i % replays.len()].clone(), "replay"));
    }
    for p in invalid_sigs {
        attacks.push((p, "invalid-sig"));
    }
    for p in wrong_epoch {
        attacks.push((p, "wrong-epoch"));
    }
    for p in malformed {
        attacks.push((p, "malformed"));
    }
    // Keep the categories in one list; all 8 clients sweep it concurrently
    // (each owns every 8th frame), so every category is being fired at the
    // relay by multiple clients at the same time.
    attacks.sort_by_key(|(_, kind)| *kind);

    let packet_garbage: &[u8] = &[0xab; 256];
    let entry_addr = Arc::new(entry.addr.clone());
    let attacks = Arc::new(attacks);
    let mut handles = Vec::new();
    for c in 0..8 {
        let addr = entry_addr.clone();
        let attacks = attacks.clone();
        handles.push(std::thread::spawn(move || {
            for (i, (proof, _)) in attacks.iter().enumerate() {
                if i % 8 != c {
                    continue; // each client owns 1/8th of the frames
                }
                push_attack_frame(&addr, proof, packet_garbage);
                std::thread::sleep(Duration::from_millis(1));
            }
        }));
    }
    for h in handles {
        h.join().expect("attack client thread panicked");
    }

    // ---- Phase 3: health check — no crash, correct drops, still responsive. ----
    assert!(
        entry.is_alive(),
        "entry relay must survive the concurrent barrage"
    );
    // The relay handles each frame in its own thread; the log pipe lags the
    // attack threads, so poll until every category's drop has been observed
    // (bounded, so a genuine failure still panics with the log dump).
    let deadline = Instant::now() + Duration::from_secs(15);
    let logs = loop {
        let logs = entry.all_logs().join("\n");
        if logs.matches("drop: already-spent").count() >= 100
            && logs.matches("drop: invalid-signature").count() >= 50
            && logs.matches("drop: wrong-epoch").count() >= 20
            && logs.matches("drop: malformed-proof").count() >= 30
        {
            break logs;
        }
        if Instant::now() > deadline {
            panic!("relay did not reject all attack categories in time:\n{logs}");
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    assert!(
        !logs.contains("panicked"),
        "no panic may escape the relay under load"
    );
    assert!(
        logs.matches("drop: already-spent").count() >= 100,
        "all over-budget replays must be rejected"
    );
    assert!(
        logs.matches("drop: invalid-signature").count() >= 50,
        "all invalid-signature frames must be rejected"
    );
    assert!(
        logs.matches("drop: wrong-epoch").count() >= 20,
        "all wrong-epoch frames must be rejected"
    );
    assert!(
        logs.matches("drop: malformed-proof").count() >= 30,
        "all malformed-proof frames must be rejected"
    );
    // Nothing from the attack may have been admitted.
    assert_eq!(
        logs.matches("admit epoch=1").count(),
        4,
        "only the 4 baseline sends may be admitted"
    );

    // The relay must still do REAL work: admit a fresh token and deliver a
    // full ratchet-encrypted message through all three hops.
    let mut fresh = fresh_wallet(&issuer, 1);
    let wire = ratchet
        .encrypt(&bob_peer.id, &bob_peer.otk, "still alive under load")
        .unwrap();
    let token = fresh.spend_token().unwrap();
    client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
    assert_eq!(
        receiver
            .wait_for_messages(5, Duration::from_secs(10))
            .last(),
        Some(&"still alive under load".to_string()),
        "relay must keep delivering after the barrage"
    );
    assert!(
        entry.is_alive(),
        "relay must remain alive after health check"
    );
}
