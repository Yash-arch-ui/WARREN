//! M7 integration test: the K-of-N multi-signer relay directory.
//!
//! The M3 gossip list is signed by each relay *itself*; M7 adds a separate
//! directory layer: N independent directory signing keys, of which at least
//! K must attest a relay list for a client to accept it. This removes the
//! single-directory-key trust assumption (the \"one operator controls routing
//! integrity\" critique). It is still a **fixed, small N** — not real
//! decentralized gossip/DHT (explicitly out of scope; `docs/THREAT_MODEL.md`
//! §1, §6).
//!
//! The three properties that matter (pinned here, not assumed):
//! 1. an entry/list attested by **only 1 of 3** directory keys is rejected;
//! 2. a list attested by **2 of 3** is accepted and used for routing;
//! 3. an attestation from a **non-directory key (forged/mismatched)** is
//!    rejected *even when* 2 other valid attestations are present.

mod common;

use std::path::Path;
use std::time::Duration;

use common::*;
use ed25519_dalek::SigningKey;
use warren::credential::{ClientTokenWallet, Epoch, Issuer};
use warren::directory::SignedRelayList;

fn dir_key(i: u8) -> SigningKey {
    SigningKey::from_bytes(&[i; 32])
}

/// The default-sized set of N directory signers (the documented default is
/// N = `directory::DEFAULT_DIR_SIGNERS` = 3).
fn dir_set() -> Vec<SigningKey> {
    (1..=warren::directory::DEFAULT_DIR_SIGNERS as u8)
        .map(dir_key)
        .collect()
}

fn dir_keys_hex(sks: &[SigningKey]) -> Vec<String> {
    sks.iter()
        .map(|sk| hex::encode(sk.verifying_key().to_bytes()))
        .collect()
}

/// Sender home with a Layer-3 ratchet identity + a wallet of `count` tokens.
fn home_with_wallet(home: &Path, count: usize) {
    warren::ratchet::RatchetClient::init(home).unwrap();
    let epoch = Epoch(1);
    let issuer = Issuer::new(epoch).unwrap();
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, count).unwrap();
    wallet.save(&home.join("wallet.json")).unwrap();
}

/// A relay list from fabricated (self-signed) claims, attested by the given
/// directory keys. The refusal paths must fail *before any network I/O*, so
/// they need no live relays — which is exactly the property being checked.
fn fabricated_list(dir_attest: &[&SigningKey]) -> SignedRelayList {
    let claims = [
        ("127.0.0.1:7001", 11u8),
        ("127.0.0.1:7002", 12),
        ("127.0.0.1:7003", 13),
    ]
    .into_iter()
    .map(|(addr, seed)| {
        let relay_id = SigningKey::from_bytes(&[seed; 32]);
        warren::directory::sign_claim(addr, [7u8; 32], &relay_id)
    })
    .collect();
    let mut list = SignedRelayList::from_claims(claims);
    for sk in dir_attest {
        list.attestations.push(list.sign_attestation(sk));
    }
    list
}

/// Property 2: a list attested by 2 of the 3 configured directory keys is
/// accepted, and a real message routes through all three relays.
#[test]
fn two_of_three_directory_keys_route_a_message() {
    let tmp = TempDir::new("m7-accept");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let receiver = Receiver::start(&bob_home);

    let keys = dir_set();
    let cfg_path = tmp.path().join("config.toml");
    write_config_with_directory(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[("bob", &receiver.addr, &bob_id, &bob_otk)],
        &dir_keys_hex(&keys),
        2,
    );

    let home = tmp.path().join("alice");
    home_with_wallet(&home, 1);
    // Attested by 2 of the 3 configured directory keys → accepted and used.
    write_attested_relay_list(
        &home.join("relays.json"),
        &[&entry, &middle, &exit],
        &keys[..2],
    );

    let out = run_send(&home, &cfg_path, "bob", "k of n hello");
    assert!(
        out.status.success(),
        "send failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    assert_eq!(
        receiver.wait_for_messages(1, Duration::from_secs(10)),
        vec!["k of n hello"]
    );
}

/// Property 1: a list attested by only 1 of the 3 configured directory keys
/// is refused — and refused *before any network I/O* (no relays are even
/// running; the failure is purely the directory policy).
#[test]
fn under_threshold_list_refused_before_any_network_io() {
    let tmp = TempDir::new("m7-reject");
    let keys = dir_set();
    let home = tmp.path().join("alice");
    home_with_wallet(&home, 1);

    let cfg_path = tmp.path().join("config.toml");
    write_config_with_directory(
        &cfg_path,
        ("127.0.0.1:7001", "127.0.0.1:7002", "127.0.0.1:7003"),
        &[(
            "bob",
            "127.0.0.1:9001",
            &hex::encode([0xaa; 32]),
            &hex::encode([0xbb; 32]),
        )],
        &dir_keys_hex(&keys),
        2,
    );

    let list = fabricated_list(&[&keys[0]]); // only 1 of 3
    list.save(&home.join("relays.json")).unwrap();

    let out = run_send(&home, &cfg_path, "bob", "should not send");
    assert!(
        !out.status.success(),
        "under-threshold send must be refused"
    );
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(
        err.contains("attested by only 1 of the 3"),
        "stderr should name the threshold shortfall: {err}"
    );
}

/// Property 3: a forged/mismatched attestation from a key that is *not* one
/// of the configured directory keys rejects the list — even when 2 valid
/// attestations are present alongside it.
#[test]
fn forged_attestation_refused_even_alongside_two_valid() {
    let tmp = TempDir::new("m7-forge");
    let keys = dir_set();
    let rogue = dir_key(9); // not one of the configured N
    let home = tmp.path().join("alice");
    home_with_wallet(&home, 1);

    let cfg_path = tmp.path().join("config.toml");
    write_config_with_directory(
        &cfg_path,
        ("127.0.0.1:7001", "127.0.0.1:7002", "127.0.0.1:7003"),
        &[(
            "bob",
            "127.0.0.1:9001",
            &hex::encode([0xaa; 32]),
            &hex::encode([0xbb; 32]),
        )],
        &dir_keys_hex(&keys),
        2,
    );

    let list = fabricated_list(&[&keys[0], &keys[1], &rogue]);
    list.save(&home.join("relays.json")).unwrap();

    let out = run_send(&home, &cfg_path, "bob", "should not send");
    assert!(!out.status.success(), "forged attestation must be refused");
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(
        err.contains("not among the configured"),
        "stderr should name the unconfigured signer: {err}"
    );
}
