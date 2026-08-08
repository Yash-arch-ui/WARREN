//! Latency measurement — RAW DATA ONLY (spec: "raw data for M4, not
//! analysis yet"; extended in M5 for the Poisson-delay + cover-traffic
//! profile). The writeup lives in `docs/LATENCY.md`.
//!
//! Times the full end-to-end send→receive cycle over the real 3-hop relay
//! path with the full real stack: Layer-3 Double Ratchet encryption, M2 token
//! spend, signed-list + handshake verification, Sphinx wrapping, plain TCP
//! through three real relay processes, delivery, and decryption on the
//! receiver.
//!
//! Latency is measured as `t_arrival − t_send_returned`: the wall-clock time
//! from the sender's send returning (message fully pushed into the entry
//! relay) until the receiver's decrypt loop observed the delivered plaintext.
//!
//! Per spec §5.5, latency is captured at configuration points of the per-hop
//! mix delay (spec §3.2, `[relays] delay_ms`). **Since M5 `delay_ms` is a
//! Poisson *mean***: each hop's delay is sampled from an exponential with
//! that mean, so per-message latency is a distribution (mean ≈ 2 × delay_ms
//! plus the ~4 ms loopback floor — entry + middle enforce one sleep each),
//! not a constant offset. Points measured:
//!
//! - `delay_ms = 0`  (no enforced per-hop delay; unchanged baseline)
//! - `delay_ms = 25` (Poisson mean)
//! - `delay_ms = 50` (Poisson mean)
//! - `delay_ms = 25` **with cover traffic** (entry relay emitting 20 dummy
//!   packets/s on a Poisson schedule) — the §3.2 full configuration
//!
//! This test is `#[ignore]`d because it is environment-dependent and its
//! numbers belong in `docs/LATENCY.md`, not in the CI suite. Run it with:
//!
//! ```console
//! $ cargo test --release --test latency_measure -- --ignored --nocapture
//! ```
//!
//! Raw measurements are printed as TSV (one row per sample) plus a summary
//! line; the latest run is transcribed into `docs/LATENCY.md` by hand.

mod common;

use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use common::*;
use warren::client;
use warren::config::Config;
use warren::credential::{ClientTokenWallet, Epoch, Issuer};
use warren::directory::SignedRelayList;
use warren::net;
use warren::ratchet::RatchetClient;

const SAMPLES: usize = 30;

/// A minimal receiver that records the wall-clock arrival time of each
/// delivered plaintext, so the harness can pair sends with arrivals.
struct TimedReceiver {
    addr: String,
    arrivals: Arc<Mutex<Vec<(Instant, String)>>>,
}

impl TimedReceiver {
    fn start(home: &std::path::Path) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let arrivals = Arc::new(Mutex::new(Vec::new()));
        let rx = arrivals.clone();
        let home = home.to_path_buf();
        std::thread::spawn(move || {
            let mut ratchet = RatchetClient::load(&home).unwrap();
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                if let Ok(Some((net::FRAME_DELIVER, body))) = net::recv_frame(&mut s)
                    && let Ok((_sender, pt)) = ratchet.decrypt(&body)
                {
                    rx.lock()
                        .unwrap()
                        .push((Instant::now(), String::from_utf8_lossy(&pt).into_owned()));
                }
            }
        });
        TimedReceiver { addr, arrivals }
    }

    /// Wait until `n` arrivals have been recorded; return them with timestamps.
    fn wait(&self, n: usize, timeout: Duration) -> Vec<(Instant, String)> {
        let deadline = Instant::now() + timeout;
        loop {
            {
                let r = self.arrivals.lock().unwrap();
                if r.len() >= n {
                    return r.clone();
                }
            }
            if Instant::now() > deadline {
                panic!(
                    "timed out waiting for {n} arrivals; have {:?}",
                    self.arrivals.lock().unwrap().clone()
                );
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}

/// One measurement run at a given per-hop delay configuration (Poisson mean)
/// and optional cover-traffic rate on the entry relay. Spawns its own relay
/// set so config points never interfere.
///
/// With cover enabled the relays must run on **fixed ports**: the entry
/// relay's `--network` flag names the whole chain (including itself) before
/// it starts. Ports 7301–7303 are reserved for this harness.
fn run_at_delay(tag: &str, delay_ms: u64, cover_rate: f64) {
    let tmp = TempDir::new(&format!("latency-{tag}"));

    let (entry_addr, middle_addr, exit_addr);
    let entry;
    let middle;
    let exit;
    if cover_rate > 0.0 {
        let network = "127.0.0.1:7301,127.0.0.1:7302,127.0.0.1:7303".to_string();
        middle = RelayProcess::spawn_with_port(
            7302,
            &["--key", &tmp.path().join("key-middle").to_string_lossy()],
        );
        exit = RelayProcess::spawn_with_port(
            7303,
            &["--key", &tmp.path().join("key-exit").to_string_lossy()],
        );
        entry = RelayProcess::spawn_with_port(
            7301,
            &[
                "--key",
                &tmp.path().join("key-entry").to_string_lossy(),
                "--cover-rate",
                &cover_rate.to_string(),
                "--cover-delay-ms",
                "5",
                "--network",
                &network,
            ],
        );
        entry_addr = entry.addr.clone();
        middle_addr = middle.addr.clone();
        exit_addr = exit.addr.clone();
    } else {
        entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
        middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
        exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
        entry_addr = entry.addr.clone();
        middle_addr = middle.addr.clone();
        exit_addr = exit.addr.clone();
    }

    // Receiver (bob) + sender (alice) with full Layer-3 state.
    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = TimedReceiver::start(&bob_home);

    let (alice_home, alice_id, _alice_otk) = ratchet_init(&tmp, "alice");
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, SAMPLES + 5).unwrap();

    let cfg_path = tmp.path().join("config.toml");
    write_config_with_delay(
        &cfg_path,
        (&entry_addr, &middle_addr, &exit_addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
        delay_ms,
    );
    let cfg = Config::load(&cfg_path).unwrap();
    let list_path = tmp.path().join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    let mut ratchet = RatchetClient::load(&alice_home).unwrap();
    let bob_peer = cfg.peers.get("bob").unwrap();

    let cover_tag = if cover_rate > 0.0 {
        format!("cover={cover_rate}")
    } else {
        "no-cover".to_string()
    };
    println!("latency_samples_start delay_ms={delay_ms} {cover_tag}");
    let mut sends: Vec<(Instant, String)> = Vec::with_capacity(SAMPLES);
    for i in 0..SAMPLES {
        let msg = format!("latency-sample-{i}");
        let wire = ratchet.encrypt(&bob_peer.id, &bob_peer.otk, &msg).unwrap();
        let token = wallet.spend_token().unwrap();
        let t0 = Instant::now();
        client::send_packet(&cfg, &list, &receiver.addr, &wire, Some(&token)).unwrap();
        sends.push((t0, msg));
        // Small inter-message gap so deliveries don't coalesce into one batch.
        std::thread::sleep(Duration::from_millis(5));
    }
    println!("latency_samples_end delay_ms={delay_ms} {cover_tag}");

    // Pair each arrival with its send by message content (sends are in order).
    let arrivals = receiver.wait(SAMPLES, Duration::from_secs(60));
    assert_eq!(arrivals.len(), SAMPLES, "all samples must arrive");

    let mut latencies: Vec<Duration> = Vec::with_capacity(SAMPLES);
    for (t0, msg) in &sends {
        let (t1, arrived_msg) = arrivals
            .iter()
            .find(|(_, m)| m == msg)
            .unwrap_or_else(|| panic!("arrival for {msg} not found"));
        assert_eq!(arrived_msg, msg);
        latencies.push(t1.saturating_duration_since(*t0));
    }
    latencies.sort();

    println!("sample\tt_ms\tdelay_ms={delay_ms}\t{cover_tag}");
    for (i, l) in latencies.iter().enumerate() {
        println!("{i}\t{:.2}\t{delay_ms}\t{cover_tag}", l.as_secs_f64() * 1e3);
    }
    let sum: Duration = latencies.iter().sum();
    let mean = sum / latencies.len() as u32;
    let p50 = latencies[latencies.len() / 2];
    let p95 = latencies[(latencies.len() as f64 * 0.95).floor() as usize];
    println!(
        "summary\tdelay_ms={delay_ms}\t{cover_tag}\tmin_ms={:.2}\tmean_ms={:.2}\tp50_ms={:.2}\tp95_ms={:.2}\tmax_ms={:.2}",
        latencies.first().unwrap().as_secs_f64() * 1e3,
        mean.as_secs_f64() * 1e3,
        p50.as_secs_f64() * 1e3,
        p95.as_secs_f64() * 1e3,
        latencies.last().unwrap().as_secs_f64() * 1e3,
    );
    println!("alice_id={alice_id}");
}

#[test]
#[ignore = "environment-dependent; transcribe into docs/LATENCY.md manually"]
fn measure_end_to_end_latency_over_real_path() {
    // Configuration points (spec §5.5): the three delay means from M4, plus
    // the full §3.2 configuration — Poisson delay WITH cover traffic on the
    // entry relay.
    run_at_delay("delay-0", 0, 0.0);
    run_at_delay("delay-25", 25, 0.0);
    run_at_delay("delay-50", 50, 0.0);
    run_at_delay("delay-25-cover-20", 25, 20.0);
}
