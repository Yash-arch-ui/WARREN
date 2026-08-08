//! SHA-256 proof-of-work for token-batch bootstrap (M6, spec §4/§9).
//!
//! The reputation-bootstrap question — *who deserves a token batch, without
//! an identity check that reintroduces linkability* — is answered with the
//! simplest cost-bearing mechanism: the issuer grants a batch only to a
//! client that presents a proof of work over a challenge bound to
//! `(issuer nonce, client_id, epoch)`. See `docs/LIBRARY_SELECTION.md` §7
//! for the decision and `docs/THREAT_MODEL.md` §3.2 for the honest bound.
//!
//! Why SHA-256 over the existing `sha2` dependency: mining/verification need
//! a cheap preimage-resistant hash; `sha2 0.11` is already in the tree (used
//! by `credential::Token::id`), so this adds **no new dependency**. The
//! difficulty is a leading-zero-bits target on the hash — standard, tunable,
//! and trivially verified. No memory-hardness (Argon2-style) because the
//! threat is per-identity *cost*, not GPU/ASIC economics at this scale; the
//! docs say so.

use sha2::{Digest, Sha256};

/// Default proof-of-work difficulty: required leading zero bits of the
/// challenge hash. Expected work = 2^26 ≈ 67 M SHA-256 evaluations ≈ a
/// fraction of a second on commodity hardware — the "reasonable time" a
/// legitimate user will tolerate once per epoch. Tunable via
/// `unlink token-issue --pow-bits` (0 disables the gate entirely).
pub const DEFAULT_POW_BITS: u32 = 26;

/// A batch-grant challenge: binds the work to `(issuer nonce, client_id,
/// epoch)` so a solution is not reusable across clients, epochs, or (via the
/// fresh nonce) different issuer grants.
pub fn challenge(nonce: &[u8; 32], client_id: &str, epoch: u64) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(nonce);
    h.update(client_id.as_bytes());
    h.update(epoch.to_be_bytes());
    h.finalize().into()
}

/// Hash of `(challenge, counter)` — the unit of work being proved.
pub fn hash(challenge: &[u8; 32], counter: u64) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(challenge);
    h.update(counter.to_be_bytes());
    h.finalize().into()
}

/// Number of leading zero bits of a 32-byte hash.
pub fn leading_zero_bits(h: &[u8; 32]) -> u32 {
    let mut bits = 0u32;
    for b in h {
        let zeros = b.leading_zeros();
        bits += zeros;
        if zeros < 8 {
            break;
        }
    }
    bits
}

/// True if `counter` is a valid proof of work for `challenge` at `bits`
/// difficulty. `bits == 0` disables the gate (everything verifies).
pub fn verify(challenge: &[u8; 32], counter: u64, bits: u32) -> bool {
    bits == 0 || leading_zero_bits(&hash(challenge, counter)) >= bits
}

/// Find the smallest `counter` satisfying [`verify`] at `bits` difficulty.
/// Each trial succeeds independently with probability 2^−bits, so the
/// expected number of trials is 2^bits (geometric). Iterating from 0 makes
/// the search deterministic for a given challenge.
pub fn mine(challenge: &[u8; 32], bits: u32) -> u64 {
    if bits == 0 {
        return 0;
    }
    let mut counter = 0u64;
    while !verify(challenge, counter, bits) {
        counter += 1;
    }
    counter
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mined_solution_verifies() {
        let chal = challenge(&[7u8; 32], "alice", 1);
        for bits in [0u32, 1, 8, 12, 16] {
            let counter = mine(&chal, bits);
            assert!(verify(&chal, counter, bits), "bits={bits}");
            assert!(
                leading_zero_bits(&hash(&chal, counter)) >= bits,
                "bits={bits}"
            );
        }
    }

    #[test]
    fn challenge_binds_client_and_epoch() {
        let nonce = [9u8; 32];
        let a1 = challenge(&nonce, "alice", 1);
        let a2 = challenge(&nonce, "alice", 2);
        let b1 = challenge(&nonce, "bob", 1);
        assert_ne!(a1, a2, "epoch must change the challenge");
        assert_ne!(a1, b1, "client must change the challenge");
        assert_ne!(a2, b1);
        // A fresh nonce (per-request) also changes the challenge — no
        // solution can be precomputed for a challenge not yet issued.
        assert_ne!(a1, challenge(&[8u8; 32], "alice", 1));
    }

    #[test]
    fn verify_is_exact_at_difficulty_boundary() {
        // The smallest counter satisfying bits=10 was found by mine; the
        // counter just below it must fail (mine iterates from 0, so all
        // smaller counters fail by construction).
        let chal = challenge(&[1u8; 32], "carol", 3);
        let g = mine(&chal, 10);
        assert!(g > 0, "test needs a nonzero solution");
        assert!(verify(&chal, g, 10));
        assert!(!verify(&chal, g - 1, 10));
        // Disabled gate: everything verifies at bits=0.
        assert!(verify(&chal, 0, 0));
        assert!(verify(&chal, u64::MAX, 0));
    }

    #[test]
    fn zero_bits_mine_is_instant() {
        let chal = challenge(&[0u8; 32], "dev", 1);
        assert_eq!(mine(&chal, 0), 0);
    }
}
