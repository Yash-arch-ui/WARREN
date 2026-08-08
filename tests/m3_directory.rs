//! M3 integration test: the signed gossip list (spec §5.4, §8.5).
//!
//! The client's trust anchor is a list of per-relay self-signed claims. This
//! suite verifies over real relay processes + the real `warren` CLI that:
//!
//! 1. a **valid** signed list is accepted and used for routing (message
//!    delivered through all three hops);
//! 2. an **unsigned** list entry is rejected before any message leaves the
//!    client;
//! 3. a **tampered** (signature flipped) list entry is rejected, not
//!    silently accepted;
//! 4. a **forged** list entry — an attacker-signed claim for an honest
//!    relay's address — passes list self-signature checks but is rejected at
//!    the live handshake cross-check (identity mismatch, §8.5);
//! 5. the `warren directory-fetch` CLI assembles a verified list from live
//!    relays.

mod common;

use std::path::Path;
use std::process::Command;
use std::time::Duration;

use common::*;
use warren::credential::{ClientTokenWallet, Epoch, Issuer};
use warren::directory::{SignedRelayList, sign_claim};

/// Write a wallet with `count` tokens into `home`, plus a Layer-3 ratchet
/// identity for the sender (message bodies are Double-Ratchet encrypted).
fn home_with_wallet(home: &Path, count: usize) {
    warren::ratchet::RatchetClient::init(home).unwrap();
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, count).unwrap();
    wallet.save(&home.join("wallet.json")).unwrap();
}

/// Bob's receiving client (ratchet-decrypting) + the config for the sender.
fn bob_and_cfg(tmp: &TempDir, relays: (&str, &str, &str)) -> (Receiver, std::path::PathBuf) {
    let (bob_home, bob_id, bob_otk) = ratchet_init(tmp, "bob");
    let receiver = Receiver::start(&bob_home);
    let cfg_path = tmp.path().join("config.toml");
    write_config(
        &cfg_path,
        relays,
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
    );
    (receiver, cfg_path)
}

#[test]
fn valid_signed_list_is_accepted_and_routes_a_message() {
    let tmp = TempDir::new("m3-valid");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    let (receiver, cfg) = bob_and_cfg(&tmp, (&entry.addr, &middle.addr, &exit.addr));

    let home = tmp.path().join("home");
    home_with_wallet(&home, 5);
    // Every entry is the relay's own self-signed claim — the honest case.
    write_relay_list(&home.join("relays.json"), &[&entry, &middle, &exit]);

    let out = run_send(&home, &cfg, "bob", "hello through the signed list");
    assert!(
        out.status.success(),
        "send failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert_eq!(
        receiver.wait_for_messages(1, Duration::from_secs(10)),
        vec!["hello through the signed list"]
    );
}

#[test]
fn unsigned_list_entry_is_rejected_before_send() {
    let tmp = TempDir::new("m3-unsigned");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    let (receiver, cfg) = bob_and_cfg(&tmp, (&entry.addr, &middle.addr, &exit.addr));

    let home = tmp.path().join("home");
    home_with_wallet(&home, 5);

    // Entry relay's claim with a zeroed signature: self-signature is invalid,
    // so the whole list must be rejected at load time.
    let mut unsigned = entry.claim.clone();
    unsigned.signature = [0u8; 64];
    let list =
        SignedRelayList::from_claims(vec![unsigned, middle.claim.clone(), exit.claim.clone()]);
    list.save(&home.join("relays.json")).unwrap();

    let out = run_send(&home, &cfg, "bob", "should never leave");
    assert!(!out.status.success(), "unsigned entry must be rejected");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("relay list rejected"),
        "clean list-rejection error expected, got: {stderr}"
    );
    assert!(!stderr.contains("panicked"), "must not panic: {stderr}");
    assert_eq!(receiver.count(), 0, "no message may be delivered");
}

#[test]
fn tampered_list_entry_is_rejected_not_silently_accepted() {
    let tmp = TempDir::new("m3-tampered");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    let (receiver, cfg) = bob_and_cfg(&tmp, (&entry.addr, &middle.addr, &exit.addr));

    let home = tmp.path().join("home");
    home_with_wallet(&home, 5);

    // Flip one byte of the entry relay's signature in the list.
    let mut tampered = entry.claim.clone();
    tampered.signature[10] ^= 1;
    let list =
        SignedRelayList::from_claims(vec![tampered, middle.claim.clone(), exit.claim.clone()]);
    list.save(&home.join("relays.json")).unwrap();

    let out = run_send(&home, &cfg, "bob", "should never leave");
    assert!(!out.status.success(), "tampered entry must be rejected");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("relay list rejected"),
        "clean list-rejection error expected, got: {stderr}"
    );
    assert_eq!(receiver.count(), 0);
}

#[test]
fn forged_list_entry_rejected_at_handshake_crosscheck() {
    let tmp = TempDir::new("m3-forged");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);
    let (receiver, cfg) = bob_and_cfg(&tmp, (&entry.addr, &middle.addr, &exit.addr));

    let home = tmp.path().join("home");
    home_with_wallet(&home, 5);

    // Attacker-controlled identity key claims the *honest entry relay's*
    // address with its own sphinx key. The claim is self-consistent (the
    // list verify passes), but the live handshake returns the real relay's
    // claim — identity mismatch (§8.5): a relay substitution must abort.
    let attacker = ed25519_dalek::SigningKey::from_bytes(&rand::random::<[u8; 32]>());
    let forged = sign_claim(&entry.addr, [0xAB; 32], &attacker);
    let list = SignedRelayList::from_claims(vec![forged, middle.claim.clone(), exit.claim.clone()]);
    list.save(&home.join("relays.json")).unwrap();

    let out = run_send(&home, &cfg, "bob", "should never leave");
    assert!(!out.status.success(), "forged entry must be rejected");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("identity mismatch"),
        "handshake cross-check must catch the substitution, got: {stderr}"
    );
    assert_eq!(receiver.count(), 0);

    // The refused send must NOT burn an admission token: path verification
    // happens before spend (spec §8.5).
    let wallet = ClientTokenWallet::load(&home.join("wallet.json")).unwrap();
    assert_eq!(
        wallet.unspent_tokens().len(),
        5,
        "a refused send must not spend a token"
    );
}

#[test]
fn directory_fetch_cli_assembles_verified_list() {
    let tmp = TempDir::new("m3-fetch");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    let out_path = tmp.path().join("relays.json");
    let out = Command::new(env!("CARGO_BIN_EXE_warren"))
        .arg("directory-fetch")
        .arg(&entry.addr)
        .arg(&middle.addr)
        .arg(&exit.addr)
        .arg("--out")
        .arg(&out_path)
        .output()
        .expect("failed to run warren directory-fetch");
    assert!(
        out.status.success(),
        "directory-fetch failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );

    // The fetched list must load and pass full self-signature verification.
    let list = SignedRelayList::load_and_verify(&out_path).unwrap();
    assert_eq!(list.entries.len(), 3);
    assert!(list.get(&entry.addr).is_some());
    assert!(list.get(&middle.addr).is_some());
    assert!(list.get(&exit.addr).is_some());
    // The fetched entries match the relays' own signed claims exactly.
    assert_eq!(list.get(&entry.addr).unwrap(), &entry.claim);
}

/// A relay may bind a loopback/wildcard interface but **advertise** a
/// different public `host:port` in its self-signed claim (deployment
/// support: on a public host the claim must carry the externally reachable
/// address, while the process still binds privately). This pins the behavior
/// end-to-end: the startup claim uses the advertised address, its signature
/// still verifies, and `directory-fetch` over the real handshake returns the
/// advertised-address claim.
#[test]
fn relay_can_advertise_a_public_address_while_binding_loopback() {
    let tmp = TempDir::new("m3-advertise");
    let public = "203.0.113.9:7001"; // TEST-NET-3; must never be the bind addr
    let relay = RelayProcess::spawn(&[
        "--key",
        &tmp.path().join("key-entry").to_string_lossy(),
        "--advertise",
        public,
    ]);

    // The process still bound loopback (the private-by-default default), but
    // its claim now points clients at the public address.
    assert!(
        relay.addr.starts_with("127.0.0.1:"),
        "bound address must stay loopback, got {}",
        relay.addr
    );
    assert_eq!(
        relay.claim.address, public,
        "claim must advertise the public address"
    );
    assert!(
        relay.claim.verify().is_ok(),
        "advertised claim must still self-verify"
    );

    // A client assembling the list over the real handshake (to the *bound*
    // loopback address) receives the advertised-address claim — so a gossip
    // list built against this relay routes through the public host:port.
    let fetched = warren::directory::fetch_claims_from(&[&relay.addr]).unwrap();
    assert_eq!(fetched.entries.len(), 1);
    assert_eq!(fetched.entries[0].address, public);
    assert_eq!(
        fetched.entries[0].identity_pubkey,
        relay.claim.identity_pubkey
    );
    assert_eq!(fetched.entries[0].sphinx_pubkey, relay.claim.sphinx_pubkey);
}
