//! M1 integration test: real 3-hop Sphinx routing through live relay
//! processes over local TCP.
//!
//! Verifies (1) plaintext is delivered to the destination client, and
//! (2) the core anonymity property: **no single relay saw both the original
//! sender and the final receiver** — the entry relay only ever forwards, the
//! middle relay only ever forwards, and only the exit relay learns the
//! destination; no relay ever logs the plaintext.

mod common;

use std::time::{Duration, Instant};

use common::*;
use warren::client;
use warren::config::Config;
use warren::credential::{ClientTokenWallet, Epoch, Issuer};
use warren::directory::SignedRelayList;
use warren::ratchet::RatchetClient;

#[test]
fn three_hop_routing_delivers_and_no_relay_sees_sender_and_receiver() {
    let tmp = TempDir::new("m1");

    // Three real relay processes (no admission gate for M1).
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    // Bob's Layer-3 ratchet identity (the receiver half of `warren listen`).
    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);

    let cfg_path = tmp.path().join("config.toml");
    write_config(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
    );

    // The CLI send path spends a token (M2 behavior); with no admission gate
    // configured the proof is ignored, so this still exercises the full real
    // M1 transport through `warren send`. Alice also needs a Layer-3 ratchet
    // identity (the message body is Double-Ratchet encrypted — Layer 3).
    let home = tmp.path().join("alice");
    warren::ratchet::RatchetClient::init(&home).unwrap();
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, 1).unwrap();
    wallet.save(&home.join("wallet.json")).unwrap();

    // The signed gossip list is the client's trust anchor: the client
    // verifies every entry's self-signature and cross-checks live handshake
    // claims against it. A valid list must be accepted and used for routing.
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);

    let out = run_send(&home, &cfg_path, "bob", "hello from alice");
    assert!(
        out.status.success(),
        "send failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );

    // 1) Plaintext arrives at the destination client.
    assert_eq!(
        receiver.wait_for_messages(1, Duration::from_secs(10)),
        vec!["hello from alice"]
    );

    // 2) Anonymity. Wait for the per-hop forwarding evidence, then assert on
    // the FULL log history (which includes consumed lines).
    assert!(
        entry.wait_log(
            &format!("forward to {}", middle.addr),
            Duration::from_secs(10)
        ),
        "entry relay should forward to the middle relay"
    );
    assert!(
        middle.wait_log(
            &format!("forward to {}", exit.addr),
            Duration::from_secs(10)
        ),
        "middle relay should forward to the exit relay"
    );
    assert!(
        exit.wait_log(
            &format!("deliver to {}", receiver.addr),
            Duration::from_secs(10)
        ),
        "exit relay should deliver to the receiver"
    );
    settle(300);

    let e = entry.all_logs().join("\n");
    let m = middle.all_logs().join("\n");
    let x = exit.all_logs().join("\n");

    // The entry relay (which the sender connected to) must never learn the
    // final receiver's address, and never delivers.
    assert!(
        !e.contains(&receiver.addr),
        "entry relay saw the receiver address: {e}"
    );
    assert!(!e.contains("deliver"), "entry relay delivered: {e}");

    // The middle relay must not see the receiver either.
    assert!(
        !m.contains(&receiver.addr),
        "middle relay saw the receiver address: {m}"
    );
    assert!(!m.contains("deliver"), "middle relay delivered: {m}");

    // Only the exit relay knows the destination.
    assert!(x.contains(&format!("deliver to {}", receiver.addr)));

    // No relay ever logs the plaintext.
    for (name, logs) in [("entry", &e), ("middle", &m), ("exit", &x)] {
        assert!(
            !logs.contains("hello from alice"),
            "{name} relay leaked the plaintext"
        );
    }
}

/// The per-hop mix delay (spec §3.2, `[relays] delay_ms`) must be **enforced**
/// by the relays, not just carried in the header. Since M5, `delay_ms` is a
/// Poisson *mean* — each hop's delay is sampled from an exponential with that
/// mean — so a single-message lower bound would be wrong: the sample can
/// legitimately be tiny. The honest statistical form: with 8 sends at mean
/// 200 ms, at least one delivery must exceed 150 ms of enforced delay.
/// Per message, P(entry+middle delay < 150 ms) for S = Exp(200)+Exp(200) is
/// 1 − e^(−0.75)·1.75 ≈ 0.173, so P(all 8 under 150 ms) ≈ 0.173⁸ ≈ 8 × 10⁻⁷ —
/// the test can only fail if the sleep mechanism is missing, never by luck.
/// (The exact distribution shape is pinned deterministically in `mix::tests`;
/// `tests/m6_mixing.rs` verifies the sampled delays on the wire.)
#[test]
fn per_hop_mix_delay_is_enforced_by_relays() {
    let tmp = TempDir::new("m1-delay");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);
    let cfg_path = tmp.path().join("config.toml");
    write_config_with_delay(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
        200,
    );
    let cfg = Config::load(&cfg_path).unwrap();

    let (alice_home, _alice_id, _alice_otk) = ratchet_init(&tmp, "alice");
    let mut ratchet = RatchetClient::load(&alice_home).unwrap();
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    let sends = 8usize;
    wallet.request_batch(&issuer, sends).unwrap();
    let list_path = alice_home.join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    let bob_peer = cfg.peers.get("bob").unwrap();
    let mut slowest = Duration::ZERO;
    for i in 0..sends {
        let wire = ratchet
            .encrypt(&bob_peer.id, &bob_peer.otk, &format!("slow boat {i}"))
            .unwrap();
        let token = wallet.spend_token().unwrap();
        let t0 = Instant::now();
        client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
        receiver.wait_for_messages(i + 1, Duration::from_secs(30));
        slowest = slowest.max(t0.elapsed());
    }

    assert!(
        slowest >= Duration::from_millis(150),
        "per-hop delay not enforced: slowest of {sends} sends at mean 200 ms \
         delivered in {slowest:?}"
    );
}
