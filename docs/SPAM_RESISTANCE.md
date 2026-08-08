# Spam resistance argument (M4)

*Status: M4 writeup, per spec §5.5. A written argument backed by the
measured results of `tests/m5_load.rs` — **not** a formal proof.*

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
are only issued by the issuer under the (currently stubbed) eligibility
policy. This is the core spam-resistance argument: **admission cost is a
cryptographic per-message cost, not a voluntary one.**

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

1. **The reputation-bootstrap problem is still open (spec §4/§9).** The
   issuer's eligibility policy is a **stubbed placeholder**: one batch per
   client-id, ever (`credential::Issuer::grant_batch`, flagged
   TODO-M-later in `docs/THREAT_MODEL.md` §3.2). Anyone can obtain a batch
   of tokens, so a **Sybil** can mint as many batches as it likes and then
   spend them — the token mechanism gates *per-message cost* but does not
   currently gate *who gets tokens*. Real bootstrap (proof-of-work,
   reputation, or stake) is required before the admission gate becomes an
   actual spam *barrier* rather than a cost-shaping mechanism. This is a
   known, named gap — not solved here.
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

UNLINK's spam resistance today is: **every admitted message pays a
cryptographic per-message cost that is unforgeable without the issuer's
key, and the gate is verified to hold up under concurrent abuse.** What it
is not yet: a barrier against **Sybil-obtained batches** (bootstrap is a
stub), a defense against **resource-exhaustion floods** (no rate limiting),
or a **formal** guarantee. All three are named follow-ups in
`docs/THREAT_MODEL.md` (§3.2, §3.5/§3.7, §5), consistent with the standing
instruction that MVP items are never quietly deferred.
