//! M6 integration test: proof-of-work token-batch bootstrap (spec §4/§9).
//!
//! The property that matters — not just "the mechanism runs": **an attacker
//! trying to mint many token batches cheaply is measurably limited by the
//! mechanism, while a single legitimate user can still get a usable batch in
//! reasonable time/cost.** The mechanism is issuer-side proof of work: a
//! per-request challenge bound to `(fresh nonce, client_id, epoch)`, mined at
//! a tunable difficulty, verified before the (unchanged) blind-signature
//! grant. See `src/pow.rs`, `src/credential.rs` (`Issuer::pow_challenge` /
//! `grant_batch`), `docs/THREAT_MODEL.md` §3.2, `docs/SPAM_RESISTANCE.md` §3.

use std::time::Instant;

use warren::credential::{AdmissionDecision, ClientTokenWallet, Epoch, Issuer, RelayAdmission};

/// Complete the full PoW grant flow for `client_id` at the issuer's
/// difficulty.
fn grant_with_pow(issuer: &mut Issuer, client_id: &str, epoch: Epoch) {
    let challenge = issuer.pow_challenge(client_id, epoch).unwrap();
    let counter = warren::pow::mine(&challenge, issuer.pow_bits());
    issuer.grant_batch(client_id, epoch, counter).unwrap();
}

/// The gate is enforced: no challenge → no grant; under-difficulty work is
/// rejected; a solution is single-use (consumed by the first attempt); and
/// one batch per (client, epoch) — an established client is *not* locked out,
/// but cannot stockpile batches.
#[test]
fn gate_enforced_end_to_end() {
    let bits = 12u32; // ~4096 expected hashes per solve
    let epoch = Epoch(1);
    let mut issuer = Issuer::with_pow_bits(epoch, bits).unwrap(); // A valid solve grants one batch. (The "real work" claim is verified
    // statistically in `attacker_minting_cost_scales_linearly`; a single
    // solve can occasionally succeed on trial 0 — P ≈ 2^-bits.)
    grant_with_pow(&mut issuer, "alice", epoch);

    // The same identity cannot mint another batch this epoch — even with a
    // fresh challenge (fail-fast: no wasted mining).
    let err = issuer
        .pow_challenge("alice", epoch)
        .unwrap_err()
        .to_string();
    assert!(err.contains("already has a batch"), "got: {err}");

    // Under-difficulty work is rejected: hand back a counter one below the
    // found solution (mine iterates from 0, so all smaller counters fail by
    // construction) — the difficulty is enforced, not checked loosely.
    let chal = issuer.pow_challenge("bob", epoch).unwrap();
    let counter = warren::pow::mine(&chal, bits);
    let err = issuer
        .grant_batch("bob", epoch, counter.saturating_sub(1))
        .unwrap_err()
        .to_string();
    assert!(err.contains("does not meet difficulty"), "got: {err}");

    // The failed attempt *consumed* the single-use challenge: the correct
    // solution can no longer be presented against it (stale-challenge replay
    // is impossible — a client must re-challenge and re-mine).
    assert!(
        issuer.grant_batch("bob", epoch, counter).is_err(),
        "single-use challenge must be consumed by the first attempt"
    );
    // A fresh challenge + fresh solve still works.
    grant_with_pow(&mut issuer, "bob", epoch);

    // A fresh epoch re-enables the established client (the intended policy:
    // fresh tokens each epoch for real users, not a lockout).
    grant_with_pow(&mut issuer, "alice", Epoch(2));
}

/// The Sybil-resistance property: minting M identities costs **M independent
/// solves** — the attacker's total cost scales linearly with identity count
/// with no batch amplification — while disabling the gate makes the same
/// minting free. That linear per-identity cost is the mechanism's honest
/// bound (an attacker's *rate* still scales with hashrate; see
/// `docs/THREAT_MODEL.md` §3.2 — this is a cost floor, not a Sybil wall).
#[test]
fn attacker_minting_cost_scales_linearly() {
    let bits = 12u32;
    let epoch = Epoch(1);
    let mut issuer = Issuer::with_pow_bits(epoch, bits).unwrap();

    const M: usize = 128;
    let mut total_hashes: u64 = 0;
    let mut zero_work: usize = 0;
    for i in 0..M {
        let id = format!("sybil-{i}");
        let chal = issuer.pow_challenge(&id, epoch).unwrap();
        let counter = warren::pow::mine(&chal, bits);
        if counter == 0 {
            zero_work += 1;
        }
        issuer.grant_batch(&id, epoch, counter).unwrap();
        total_hashes += counter + 1;
    }
    // A single solve can succeed on trial 0 with P = 2^-bits ≈ 0.02%, so a
    // few zero-work identities are expected — but if a large fraction of the
    // batch cost nothing, the gate is not biting.
    assert!(
        zero_work <= M / 8,
        "the gate must bite on the overwhelming majority of identities \
         ({zero_work}/{M} cost zero work)"
    );

    // Total work ≈ M × 2^bits (sum of 128 geometrics, mean 4096 each).
    // Bound generously: [½×expected, 2×expected] — P(sum < half the mean) and
    // P(sum > 2× the mean) are both astronomically small at M = 128.
    let expected = (M as u64) << bits; // 128 × 4096 = 524 288
    assert!(
        total_hashes >= expected / 2,
        "mass minting must cost ~M×2^bits in total, got {total_hashes} (expected {expected})"
    );
    assert!(
        total_hashes <= expected * 2,
        "no amplification allowed, got {total_hashes} (expected {expected})"
    );

    // Gate off (--pow-bits 0): the same 128 mintings cost zero hashes. This
    // is the counterfactual that makes the mechanism's effect measurable —
    // the gate is precisely what turns free minting into linear-cost minting.
    let mut open = Issuer::with_pow_bits(epoch, 0).unwrap();
    let free_work: u64 = (0..M)
        .map(|i| {
            let id = format!("open-{i}");
            let chal = open.pow_challenge(&id, epoch).unwrap();
            let counter = warren::pow::mine(&chal, 0);
            open.grant_batch(&id, epoch, counter).unwrap();
            counter // always 0: the gate-off path performs no hashing
        })
        .sum();
    assert_eq!(free_work, 0, "no gate → minting is free");
}

/// A single legitimate user at a realistic difficulty is not locked out: the
/// solve completes in reasonable wall-clock time, and the granted batch
/// produces tokens that pass the relay's admission gate unchanged — the PoW
/// is invisible to the redemption path.
#[test]
fn legit_user_gets_usable_batch_in_reasonable_time() {
    // bits=18 ≈ 262k expected hashes (~1M SHA-256 ops including the verify
    // pass): real work, fast even in debug builds. The CLI default of 26 is
    // the same shape (≈ sub-second at commodity hashrates in release).
    let bits = 18u32;
    let epoch = Epoch(9);
    let mut issuer = Issuer::with_pow_bits(epoch, bits).unwrap();

    let start = Instant::now();
    let chal = issuer.pow_challenge("carol", epoch).unwrap();
    let counter = warren::pow::mine(&chal, bits);
    issuer.grant_batch("carol", epoch, counter).unwrap();
    let elapsed = start.elapsed();

    // Expected work ≈ 2^18. Only an *upper* bound is asserted: a single
    // geometric sample has an exponential lower tail (P(counter < ¼·mean)
    // ≈ 6%), so a lower bound would flake — the "gate bites" property is
    // proven statistically in `attacker_minting_cost_scales_linearly`
    // (128 solves, P(such a sum runs low) ≈ 1e-8). What this test owns is
    // "the solve completes in reasonable time and work is not exploding".
    let hashes = counter + 1;
    assert!(
        hashes >= 1 && hashes <= (1u64 << (bits + 8)),
        "implausible work for bits={bits}: {hashes} hashes"
    );
    assert!(
        elapsed.as_secs() < 30,
        "legitimate user locked out by the gate: {elapsed:?}"
    );
    eprintln!("m7 legit-user: bits={bits} hashes={hashes} elapsed={elapsed:?}");

    // The batch is actually usable: the granted wallet yields tokens that the
    // relay admission gate admits (the PoW gate runs before blind issuance and
    // is invisible to redemption — nothing downstream changed).
    let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
    wallet.request_batch(&issuer, 5).unwrap();
    assert_eq!(wallet.token_count(), 5);

    let mut relay = RelayAdmission::from_pem(&wallet.issuer_pub_pem, epoch).unwrap();
    let token = wallet.spend_token().unwrap();
    assert!(
        matches!(relay.check_and_mark(&token), AdmissionDecision::Admit),
        "granted tokens must be admit-able downstream"
    );
}
