//! M2 integration test: reputation-gated admission with blind-signature
//! tokens, over the real 3-hop transport.
//!
//! 1. a valid token's message passes through and is delivered;
//! 2. replaying the same token is dropped by the (entry) relay;
//! 3. an out-of-tokens client's send fails cleanly without crashing the relay;
//! 4. unlinkability: the relay's logs/state contain no correlatable
//!    identifier between two messages spent from the same token batch.

mod common;

use std::time::Duration;

use common::*;
use unlink::client;
use unlink::config::Config;
use unlink::credential::{ClientTokenWallet, Epoch, Issuer, Token};

/// Create ONE issuer, write its public key PEM (relays load it via
/// `--admit-key`) and return it so the *same* issuer signs the wallet's
/// tokens — a mismatched keypair would make the relay reject every token.
fn setup_issuer(tmp: &TempDir, epoch: u64) -> (std::path::PathBuf, Issuer) {
    let issuer = Issuer::new(Epoch(epoch)).unwrap();
    let path = tmp.path().join("issuer.pub");
    std::fs::write(&path, issuer.public_key_pem().unwrap()).unwrap();
    (path, issuer)
}

/// Build a wallet of `count` tokens signed by `issuer` and persist it.
fn home_with_wallet(
    tmp: &TempDir,
    issuer: &Issuer,
    count: usize,
) -> (std::path::PathBuf, ClientTokenWallet) {
    let home = tmp.path().join("home");
    let mut wallet = ClientTokenWallet::new(issuer.epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(issuer, count).unwrap();
    wallet.save(&home.join("wallet.json")).unwrap();
    (home, wallet)
}

/// Spawn entry (with admission gate) + middle + exit relays.
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

fn write_cfg(tmp: &TempDir, relays: (&str, &str, &str), receiver: &str) -> std::path::PathBuf {
    let cfg_path = tmp.path().join("config.toml");
    write_config(&cfg_path, relays, &[("bob", receiver)]);
    cfg_path
}

#[test]
fn valid_token_message_passes_through() {
    let tmp = TempDir::new("m2-valid");
    let (issuer_pub, issuer) = setup_issuer(&tmp, 1);
    let (entry, middle, exit) = spawn_network(&tmp, &issuer_pub);
    let receiver = Receiver::start();
    let cfg_path = write_cfg(
        &tmp,
        (&entry.addr, &middle.addr, &exit.addr),
        &receiver.addr,
    );
    let (home, _wallet) = home_with_wallet(&tmp, &issuer, 10);
    // The signed gossip list is the client's trust anchor (spec §5.4):
    // without a valid list the send is refused before the admission gate.
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);

    let out = run_send(&home, &cfg_path, "bob", "hello admission");
    assert!(
        out.status.success(),
        "send failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert_eq!(
        receiver.wait_for_messages(1, Duration::from_secs(10)),
        vec!["hello admission"]
    );
    assert!(
        entry.wait_log("admit epoch=1", Duration::from_secs(10)),
        "entry relay should admit the valid token"
    );
}

#[test]
fn replayed_token_is_dropped_by_relay() {
    let tmp = TempDir::new("m2-replay");
    let (issuer_pub, issuer) = setup_issuer(&tmp, 1);
    let (entry, middle, exit) = spawn_network(&tmp, &issuer_pub);
    let receiver = Receiver::start();
    let cfg_path = write_cfg(
        &tmp,
        (&entry.addr, &middle.addr, &exit.addr),
        &receiver.addr,
    );
    let (home, wallet) = home_with_wallet(&tmp, &issuer, 2);
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);

    // The CLI pops the *last* token from the wallet file; record it so we can
    // replay it.
    let spent_token: Token = wallet.unspent_tokens().last().unwrap().clone();

    let out = run_send(&home, &cfg_path, "bob", "first");
    assert!(out.status.success());
    assert_eq!(
        receiver.wait_for_messages(1, Duration::from_secs(10)),
        vec!["first"]
    );

    // Craft a frame with the exact same token and push it at the entry relay.
    // The crafted send runs the full verification path (signed list + live
    // handshake cross-check) before reaching the admission gate.
    let cfg = Config::load(&cfg_path).unwrap();
    let list =
        unlink::directory::SignedRelayList::load_and_verify(&home.join("relays.json")).unwrap();
    client::send_packet(&cfg, &list, &receiver.addr, "replay", Some(&spent_token)).unwrap();

    // Block on the relay's drop decision first (deterministic), then assert
    // nothing was delivered.
    assert!(
        entry.wait_log("drop: already-spent", Duration::from_secs(10)),
        "entry relay should log the replay drop"
    );
    settle(300);
    assert_eq!(
        receiver.count(),
        1,
        "replayed message must NOT be delivered"
    );
}

#[test]
fn out_of_tokens_fails_cleanly_and_relay_survives() {
    let tmp = TempDir::new("m2-empty");
    let (issuer_pub, issuer) = setup_issuer(&tmp, 1);
    let (mut entry, middle, exit) = spawn_network(&tmp, &issuer_pub);
    let receiver = Receiver::start();
    let cfg_path = write_cfg(
        &tmp,
        (&entry.addr, &middle.addr, &exit.addr),
        &receiver.addr,
    );

    // Empty wallet (0 tokens): `unlink send` must fail cleanly. (The signed
    // list must be present and valid, or the send would fail earlier on
    // list verification instead of on the wallet.)
    let (home, wallet) = home_with_wallet(&tmp, &issuer, 0);
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);
    assert!(wallet.is_empty());
    drop(wallet);

    let out = run_send(&home, &cfg_path, "bob", "hello");
    assert!(!out.status.success(), "send with empty wallet must fail");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("out of tokens"),
        "expected a clean out-of-tokens error, got: {stderr}"
    );
    assert!(!stderr.contains("panicked"), "must not panic");
    assert!(entry.is_alive(), "the relay must survive the failed send");
    assert_eq!(receiver.count(), 0);
}

#[test]
fn no_correlatable_identifier_across_redemptions() {
    let tmp = TempDir::new("m2-unlink");
    let (issuer_pub, issuer) = setup_issuer(&tmp, 1);
    let (entry, middle, exit) = spawn_network(&tmp, &issuer_pub);
    let receiver = Receiver::start();
    let cfg_path = write_cfg(
        &tmp,
        (&entry.addr, &middle.addr, &exit.addr),
        &receiver.addr,
    );
    let (home, wallet) = home_with_wallet(&tmp, &issuer, 3);
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);
    let initial: Vec<Token> = wallet.unspent_tokens().to_vec();

    // Two messages from the same client (same batch) spend two tokens.
    for msg in ["first message", "second message"] {
        let out = run_send(&home, &cfg_path, "bob", msg);
        assert!(out.status.success(), "send failed: {msg}");
    }
    assert_eq!(
        receiver.wait_for_messages(2, Duration::from_secs(10)).len(),
        2
    );

    // Which tokens were spent? Those no longer present in the wallet file.
    let after = ClientTokenWallet::load(&home.join("wallet.json")).unwrap();
    let remaining: Vec<Token> = after.unspent_tokens().to_vec();
    let spent: Vec<&Token> = initial.iter().filter(|t| !remaining.contains(t)).collect();
    assert_eq!(spent.len(), 2, "exactly two tokens should have been spent");
    assert_ne!(
        spent[0].id(),
        spent[1].id(),
        "two redemptions must not share an identifier"
    );

    settle(400);
    let logs = entry.all_logs().join("\n");

    // The entry relay saw both redemptions. The unlinkability property:
    // its logs/state must contain NO identifier correlating the two — we
    // deliberately never log token ids, so none may appear at all, and the
    // only per-send log values are the constant strings.
    for t in &spent {
        let id_hex = hex::encode(t.id());
        assert!(
            !logs.contains(&id_hex),
            "relay logged a correlatable token identifier {id_hex}: {logs}"
        );
    }
    assert_eq!(
        logs.matches("admit epoch=1").count(),
        2,
        "expected exactly two admits: {logs}"
    );
}
