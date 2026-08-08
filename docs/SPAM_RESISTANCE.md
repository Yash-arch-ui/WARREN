# Spam resistance argument (M4)

*Status: M4 writeup (updated M6), per spec §5.5. A written argument backed
by the measured results of `tests/m5_load.rs` and `tests/m7_bootstrap.rs` —
**not** a formal proof.*

## 1. The mechanism: token-gated admission

Every message that enters the mix path must carry a **blind-signature
admission token** (RFC 9474, `blind-rsa-signatures`) checked by the entry
relay *before* any mix-layer unwrapping (the "Layer 2 position", spec §3.2;
see `docs/THREAT_MODEL.md` §4):

- A frame without a token is dropped (`drop: missing-proof`).
- A token with an unparseable proof is dropped (`drop: malformed-proof`).
- A token the issuer did not sign is dropped (`drop: invalid-signature`).
- A token from the wrong epoch is dropped (`drop: wrong-epoch`).
- A token already redeemed in this epoch is dropped (`drop: already-spent`),
  via an epoch-scoped double-spend set.

A **wallet** can only spend each token once (`spend_token` pops), so a
legitimate client is rate-limited to its granted batch per epoch. A
**malicious** client can of course send as many frames as it wants — but
each frame still needs a *valid, unspent* token to be admitted, and tokens
are only issued by the issuer under its eligibility policy: a **per-batch
proof of work** (M6, `--pow-bits`, default 26). This is the core
spam-resistance argument: **admission cost is a cryptographic per-message
cost, not a voluntary one, and batch acquisition has a per-identity
computational cost, not an identity-check one.**

## 2. What the load test actually showed

`tests/m5_load.rs` (`concurrent_abuse_rejected_and_relay_stays_responsive`)
drives the gate concurrently — not the sequential single-shot coverage of
M2. The measured results:

- **8 simulated clients**, firing **200 frames concurrently** at the
  admission-gated entry relay:
  - **100 over-budget replays** — a wallet that spent 4 tokens keeps pushing
    frames reusing those same (now spent) tokens → every one logged
    `drop: already-spent`.
  - **50 invalid-signature** tokens (signature bytes corrupted, frame still
    parses) → every one logged `drop: invalid-signature`.
  - **30 malformed-proof** frames (unparseable) → every one logged
    `drop: malformed-proof`.
  - **20 wrong-epoch** tokens (valid signature, epoch 2 vs relay epoch 1) →
    every one logged `drop: wrong-epoch`.
- **Exact-rejection accounting:** the test asserts *all 200* frames were
  rejected in their correct category, and that **exactly 4** `admit` lines
  appear (the legitimate baseline batch) — i.e. nothing from the attack was
  silently admitted.
- **No degradation, not just survival:** after the barrage the entry relay
  was still alive, still had not panicked, and **admitted a fresh valid
  token and delivered a full ratchet-encrypted message end-to-end** through
  all three hops.

What this establishes (carefully worded):

1. The admission gate is **correct under concurrency**: overlapping,
   multi-client abuse is classified and rejected per-category, with no
   cross-connection state corruption (the double-spend set is
   mutex-guarded).
2. The relay is **responsive under load**: thread-per-connection handling
   means a burst of hostile frames does not wedge the accept loop or poison
   subsequent legitimate traffic.
3. **Over-budget behavior is the intended one:** a client cannot exceed its
   granted token count by replaying; surplus frames are dropped as
   already-spent.

## 3. What this does NOT establish (the honest limits)

The test is strong evidence the *gate mechanics* work under concurrent
abuse. It is **not** an argument that the network is spam-proof:

1. **Reputation bootstrap is now PoW-gated (M6), with an honest bound.**
   The issuer's eligibility policy is a **per-batch proof of work**
   (`src/pow.rs`, `Issuer::pow_challenge`/`grant_batch`): a per-request
   challenge bound to `(fresh nonce, client_id, epoch)` must be mined at a
   tunable difficulty before one batch is granted per (client, epoch).
   This is a real improvement over the M2 one-batch-per-client stub, and
   the *measured* Sybil-resistance bound (`tests/m7_bootstrap.rs`) is:
   - **Linear, unamplified cost:** minting M identities costs ≈ M × 2^bits
     hashes. Measured: 128 identities at bits=12 summed to ≈ 524k hashes
     (within the asserted [½, 2]× expected band); the *same* 128 mintings
     with the gate off cost **0** hashes — the gate is precisely what
     turns free minting into linear-cost minting.
   - **A legitimate user is not locked out:** one user at bits=18 solved in
     **36 563 hashes / 0.26 s** (measured, debug build on this machine;
     release is far faster). The default of 26 ≈ 67 M evals ≈ sub-second
     on commodity hardware — the "reasonable time/cost" the design target
     set.
   - **The honest limit (do not overclaim):** this is a **cost floor, not
     a Sybil wall**. An attacker's supply scales *proportionally* with
     hashrate: at the default difficulty (2²⁶ ≈ 67 M hashes per batch) a
     rented GPU box (≈ 10 GH/s ≈ 10¹⁰ hashes/s, 20–100× a laptop) mints
     ≈ 150 batches/s — **≈ 5×10⁵ batches/hour for cents**. PoW
     re-centralizes around compute, the well-known caveat. It removes
     *free* minting and forces per-identity cost; it does not stop a
     funded adversary. Client ids are unauthenticated pseudonyms, so a
     third party can also mine a batch under another's client_id and burn
     that identity's one-per-epoch slot (griefing that costs the attacker
     one PoW — inherent to pseudonymous handles). Memory-hard PoW
     (Argon2-style), reputation, or stake are the remaining hardening
     directions (`docs/THREAT_MODEL.md` §3.2, §6).
2. **No rate limiting / DoS hardening.** A hostile client can still open
   many connections and consume relay CPU/memory even while every frame is
   dropped (the load test shows correct *rejection* under 200 frames, not
   that an arbitrarily large flood is cheap to absorb). Per-relay rate
   limiting and connection-level defenses are M-later
   (`docs/THREAT_MODEL.md` §3.5, §3.7).
3. **The double-spend set is in-memory and epoch-scoped** — a relay restart
   forgets it (within-epoch replay becomes possible until rollover), and
   admission is enforced only at the entry relay (`docs/THREAT_MODEL.md`
   §4 caveats (a)/(b), M3 items).
4. **This is an argument, not a proof.** The test demonstrates the property
   on one machine at 200 frames / 8 clients. A formal security argument for
   arbitrary adversarial send rates is out of MVP scope (spec §5's "formal
   proofs" exclusion).

## 4. How the load results map to the mechanism

| Attack category | Mechanism that stops it | Result in m5 |
|---|---|---|
| Token-less / malformed | proof required + parseable before unwrap | 30/30 malformed dropped |
| Forged token (not issuer-signed) | RSA signature verification (RFC 9474) | 50/50 invalid-sig dropped |
| Replayed / over-budget | epoch-scoped double-spend set | 100/100 already-spent dropped |
| Wrong-epoch reuse | epoch check before signature check | 20/20 wrong-epoch dropped |
| Legitimate traffic during attack | thread-per-connection + mutex-guarded state | 4/4 admitted, fresh token still delivered after |

## 5. Bottom line

WARREN's spam resistance today is: **every admitted message pays a
cryptographic per-message cost that is unforgeable without the issuer's
key, the gate is verified to hold up under concurrent abuse, and batch
acquisition is PoW-gated so mass identity-minting is linearly expensive
rather than free.** What it is not yet: a **wall** against a funded
Sybil (the PoW bound is proportional to hashrate — a cost floor, not a
solve; §3.1), a defense against **resource-exhaustion floods** (no rate
limiting), or a **formal** guarantee. The remaining items are named
follow-ups in `docs/THREAT_MODEL.md` (§3.2 hardening, §3.5/§3.7, §5),
consistent with the standing instruction that MVP items are never quietly
deferred.
