//! M5 integration test: Poisson timing mixing over the real path.
//!
//! 1. `per_hop_delays_on_the_wire_are_exponentially_varied` — the per-hop mix
//!    delay (spec §3.2) must be a *distribution*, not a constant: the delays
//!    the relays actually enforce across a batch of real sends must vary and
//!    match the configured exponential mean (the shape itself is verified
//!    deterministically in `mix::tests`; this test proves the sampler is
//!    wired into the real send path and the relays enforce the sampled
//!    values).
//! 2. `cover_traffic_bypasses_admission_and_is_dropped_at_exit` — cover
//!    traffic (M5): relays emit dummy Sphinx packets on a Poisson schedule,
//!    routed like real packets, dropped at the exit. The entry relay runs the
//!    M2 admission gate, so this is also the explicit test that cover traffic
//!    **does not interact with the spam gate**: cover is generated after the
//!    gate (in-process), forwards without any `admit`/`drop`, never spends
//!    tokens, and is wire-indistinguishable from real forwarding (the middle
//!    relay processes it identically and cannot mark it).

mod common;

use std::collections::HashSet;
use std::time::Duration;

use common::*;
use warren::client;
use warren::config::Config;
use warren::credential::{ClientTokenWallet, Epoch, Issuer};
use warren::directory::SignedRelayList;
use warren::ratchet::RatchetClient;

/// Parse the per-hop delays a relay enforced while forwarding to `next_addr`
/// (its log lines are `forward to <addr> delay=<N>ms`).
fn enforced_delays(logs: &[String], next_addr: &str) -> Vec<u64> {
    let prefix = format!("forward to {next_addr} delay=");
    logs.iter()
        .filter_map(|l| {
            let rest = l.strip_prefix(&prefix)?;
            rest.strip_suffix("ms")?.parse().ok()
        })
        .collect()
}

/// With `delay_ms` now a Poisson *mean*, the per-hop delays a batch of real
/// sends actually experience must vary (an exponential distribution, not a
/// fixed value) and stay within the relay's honored cap. The distribution
/// shape itself is pinned deterministically in `mix::tests`; here the point
/// is that the sampler is live on the real path.
#[test]
fn per_hop_delays_on_the_wire_are_exponentially_varied() {
    let tmp = TempDir::new("m6-poisson");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);

    let (alice_home, _alice_id, _alice_otk) = ratchet_init(&tmp, "alice");
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    let sends = 10usize;
    wallet.request_batch(&issuer, sends).unwrap();

    let cfg_path = tmp.path().join("config.toml");
    // Mean per-hop delay 120 ms: a large mean makes the enforced samples
    // visually distinct and the magnitude assertions unambiguous.
    write_config_with_delay(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
        120,
    );
    let cfg = Config::load(&cfg_path).unwrap();
    let list_path = tmp.path().join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    let mut ratchet = RatchetClient::load(&alice_home).unwrap();
    let bob_peer = cfg.peers.get("bob").unwrap();
    for i in 0..sends {
        let wire = ratchet
            .encrypt(&bob_peer.id, &bob_peer.otk, &format!("poisson-{i}"))
            .unwrap();
        let token = wallet.spend_token().unwrap();
        client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
    }
    receiver.wait_for_messages(sends, Duration::from_secs(60));
    // Let the relay stdout pipes settle before reading the logs: the entry's
    // forward log for the last send is written before delivery, but the pipe
    // reader thread may not have drained it into `all_logs()` yet (same
    // reason m1 settles before log assertions).
    settle(300);

    // Both forwarding relays enforced a sampled delay per send: entry enforces
    // hop 1, middle enforces hop 2 (two independent samples per message).
    let mut delays = enforced_delays(&entry.all_logs(), &middle.addr);
    delays.extend(enforced_delays(&middle.all_logs(), &exit.addr));
    assert!(
        delays.len() >= 2 * sends,
        "expected ≥ {} enforced delays, got {}",
        2 * sends,
        delays.len()
    );

    // 1) Not a constant: 20 exponential samples are effectively never all
    //    equal (continuous distribution, integer-ms rounding).
    let distinct: HashSet<u64> = delays.iter().copied().collect();
    assert!(
        distinct.len() >= 3,
        "per-hop delays must vary (Poisson sampling), got only {distinct:?}"
    );

    // 2) Magnitude consistent with Exp(mean 120): with overwhelming
    //    probability at least one of 20 samples exceeds 100 ms
    //    (P(single sample ≥ 100 ms) = e^(−100/120) ≈ 0.43).
    assert!(
        delays.iter().any(|&d| d >= 100),
        "expected at least one delay ≥ 100 ms for Exp(mean 120), got {delays:?}"
    );

    // 3) Every enforced delay is within the honored cap (a heavy-tail sample
    //    must have been clamped, never honored).
    assert!(
        delays
            .iter()
            .all(|&d| d <= warren::relay::MAX_HONORED_DELAY_MS),
        "delay beyond the honored cap: {delays:?}"
    );

    // 4) The varied delays actually shape delivery timing: total elapsed must
    //    exceed what zero delay would take (lower bound only, robust).
    //    (Implicitly covered by the ≥ 2×N enforced sleeps; no separate assert
    //    needed here — m1's lower-bound enforcement test covers the sleep.)
}

/// Cover traffic (spec §3.2) against a **token-gated entry relay**: dummy
/// Sphinx packets are emitted by the relay on a Poisson schedule, forwarded
/// through the chain like real traffic, and dropped at the exit — without
/// touching the M2 admission gate (no tokens, no admits, no drops at the
/// gate), and without being distinguishable by the middle relay.
#[test]
fn cover_traffic_bypasses_admission_and_is_dropped_at_exit() {
    let tmp = TempDir::new("m6-cover");

    // Fixed ports so the entry relay can be told the full chain (including
    // its own address) before it starts — relays have no directory (M5+).
    let (entry_port, middle_port, exit_port) = (7101u16, 7102u16, 7103u16);
    let (entry_addr, middle_addr, exit_addr) = (
        format!("127.0.0.1:{entry_port}"),
        format!("127.0.0.1:{middle_port}"),
        format!("127.0.0.1:{exit_port}"),
    );

    // Spawn middle + exit first so the entry's cover emitter can handshake
    // its successors on the first tick. The middle is deliberately a *clean
    // witness*: no cover of its own, so everything it forwards is either a
    // real message or the entry's cover packet — and it must not be able to
    // tell which is which.
    let network = format!("{entry_addr},{middle_addr},{exit_addr}");
    let middle = RelayProcess::spawn_with_port(
        middle_port,
        &["--key", &tmp.path().join("key-middle").to_string_lossy()],
    );
    let exit = RelayProcess::spawn_with_port(
        exit_port,
        &["--key", &tmp.path().join("key-exit").to_string_lossy()],
    );

    // Entry relay: M2 admission gate (token-gated) AND cover traffic. Cover
    // packets use a small per-hop delay mean so they don't clog the test.
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let issuer_pub = tmp.path().join("issuer.pub");
    std::fs::write(&issuer_pub, issuer.public_key_pem().unwrap()).unwrap();
    let entry = RelayProcess::spawn_with_port(
        entry_port,
        &[
            "--key",
            &tmp.path().join("key-entry").to_string_lossy(),
            "--admit-key",
            &issuer_pub.to_string_lossy(),
            "--epoch",
            "1",
            "--cover-rate",
            "30", // packets/s, Poisson
            "--cover-delay-ms",
            "5",
            "--network",
            &network,
        ],
    );

    // Wait until cover demonstrably reaches the exit and is dropped.
    assert!(
        exit.wait_log("drop: cover", Duration::from_secs(15)),
        "exit relay must drop cover traffic"
    );

    // Real traffic during the cover barrage: 2 token-carrying messages.
    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);
    let (alice_home, _alice_id, _alice_otk) = ratchet_init(&tmp, "alice");
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, 5).unwrap();

    let cfg_path = tmp.path().join("config.toml");
    write_config_with_delay(
        &cfg_path,
        (&entry_addr, &middle_addr, &exit_addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
        5,
    );
    let cfg = Config::load(&cfg_path).unwrap();
    let list_path = tmp.path().join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    let mut ratchet = RatchetClient::load(&alice_home).unwrap();
    let bob_peer = cfg.peers.get("bob").unwrap();
    for i in 0..2 {
        let wire = ratchet
            .encrypt(&bob_peer.id, &bob_peer.otk, &format!("real-{i}"))
            .unwrap();
        let token = wallet.spend_token().unwrap();
        client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
    }
    receiver.wait_for_messages(2, Duration::from_secs(30));
    // Let the cover barrage run a little longer, then confirm exactly the two
    // real messages arrived — cover is dropped, never delivered.
    settle(1500);
    assert_eq!(receiver.count(), 2, "cover traffic must never be delivered");

    // --- The M2 interaction (the point of this test) ---
    // Entry logs: cover is generated AFTER the gate. The entry's own emitter
    // logs `cover: sent`; the admission accounting shows exactly the 2 real
    // sends — no extra admits, and no drop lines at all (cover is neither
    // admitted nor rejected by the gate).
    assert!(
        entry.all_logs().iter().any(|l| l.contains("cover: sent")),
        "entry relay must emit cover traffic"
    );
    let entry_logs = entry.all_logs().join("\n");
    let admits = entry
        .all_logs()
        .iter()
        .filter(|l| l.contains("admit"))
        .count();
    assert_eq!(
        admits, 2,
        "cover must not be admitted through the gate: {entry_logs}"
    );
    assert!(
        !entry_logs.contains("drop:"),
        "cover must not be rejected by the gate either: {entry_logs}"
    );

    // The padding property, observed at the wire: the middle forwarded far
    // more packets than the 2 real sends — the surplus is the entry's cover,
    // handled byte-identically as ordinary forwards.
    let middle_forwards = enforced_delays(&middle.all_logs(), &exit_addr);
    assert!(
        middle_forwards.len() >= 5,
        "middle must forward entry cover packets like real ones (got {})",
        middle_forwards.len()
    );

    // --- Wire-indistinguishability: the middle relay cannot tell ---
    // The middle processes entry cover packets exactly like real ones
    // (ForwardHop → exit), logs nothing special, parses them cleanly.
    let middle_logs = middle.all_logs();
    let middle_text = middle_logs.join("\n");
    assert!(
        middle_text.contains(&format!("forward to {exit_addr}")),
        "middle must forward both real and cover packets to the exit"
    );
    assert!(
        !middle_text.contains("cover"),
        "the middle relay must not be able to distinguish cover traffic"
    );
    assert!(
        !middle_text.contains("error:"),
        "cover packets must parse as valid Sphinx at the middle"
    );
    assert!(
        !middle_text.contains("deliver"),
        "middle must never deliver"
    );

    // --- Exit: real deliveries happen alongside cover drops ---
    assert!(
        exit.wait_log(
            &format!("deliver to {}", receiver.addr),
            Duration::from_secs(15)
        ),
        "real messages must still be delivered during the cover barrage"
    );
    assert!(
        exit.all_logs()
            .iter()
            .filter(|l| l.contains("drop: cover"))
            .count()
            >= 5,
        "sustained cover traffic must be dropped at the exit"
    );
    // The padding claim: the exit delivered only the 2 real messages while
    // dropping many cover packets — output volume > delivered volume.
    let exit_delivers = exit
        .all_logs()
        .iter()
        .filter(|l| l.contains("deliver to"))
        .count();
    assert_eq!(exit_delivers, 2, "only real messages may be delivered");
}
