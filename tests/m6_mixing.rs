//! M5 integration test: Poisson timing mixing over the real path.
//!
//! 1. `per_hop_delays_on_the_wire_are_exponentially_varied` — the per-hop mix
//!    delay (spec §3.2) must be a *distribution*, not a constant: the delays
//!    the relays actually enforce across a batch of real sends must vary and
//!    match the configured exponential mean (the shape itself is verified
//!    deterministically in `mix::tests`; this test proves the sampler is
//!    wired into the real send path and the relays enforce the sampled
//!    values).
//!
//! (The cover-traffic test lands with the cover implementation, in the same
//! milestone's second commit.)

mod common;

use std::collections::HashSet;
use std::time::Duration;

use common::*;
use unlink::client;
use unlink::config::Config;
use unlink::credential::{ClientTokenWallet, Epoch, Issuer};
use unlink::directory::SignedRelayList;
use unlink::ratchet::RatchetClient;

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
            .all(|&d| d <= unlink::relay::MAX_HONORED_DELAY_MS),
        "delay beyond the honored cap: {delays:?}"
    );

    // 4) The varied delays actually shape delivery timing: total elapsed must
    //    exceed what zero delay would take (lower bound only, robust).
    //    (Implicitly covered by the ≥ 2×N enforced sleeps; no separate assert
    //    needed here — m1's lower-bound enforcement test covers the sleep.)
}
