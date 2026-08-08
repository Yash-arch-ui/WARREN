//! M1 integration test: real 3-hop Sphinx routing through live relay
//! processes over local TCP.
//!
//! Verifies (1) plaintext is delivered to the destination client, and
//! (2) the core anonymity property: **no single relay saw both the original
//! sender and the final receiver** — the entry relay only ever forwards, the
//! middle relay only ever forwards, and only the exit relay learns the
//! destination; no relay ever logs the plaintext.

mod common;

use std::time::Duration;

use common::*;
use unlink::credential::{ClientTokenWallet, Epoch, Issuer};

#[test]
fn three_hop_routing_delivers_and_no_relay_sees_sender_and_receiver() {
    let tmp = TempDir::new("m1");

    // Three real relay processes (no admission gate for M1).
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    let receiver = Receiver::start();

    let cfg_path = tmp.path().join("config.toml");
    write_config(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr)],
    );

    // The CLI send path spends a token (M2 behavior); with no admission gate
    // configured the proof is ignored, so this still exercises the full real
    // M1 transport through `unlink send`.
    let home = tmp.path().join("home");
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, 1).unwrap();
    wallet.save(&home.join("wallet.json")).unwrap();

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
