# M4 milestone summary

*Status: milestone checkpoint writeup. Everything stated here is anchored to
what is actually implemented and tested in the repository — the writeups in
`docs/LATENCY.md`, `docs/ANONYMITY_ANALYSIS.md`, `docs/SPAM_RESISTANCE.md`,
and `docs/THREAT_MODEL.md` are the precise references.*

## 1. What is built (M0–M4, core MVP per spec §5.1–§5.4)

| Milestone | Delivered | Verified by |
|---|---|---|
| **M0/M1 — Layer 1: mix routing** | Real 3-hop Sphinx routing over plain TCP (`sphinx-packet`). Per-hop unlinkability: each relay sees only its predecessor/successor; only the exit sees destination + payload. **Per-hop mix delay is enforced** (tunable `[relays] delay_ms`, relay sleeps before forwarding, capped against hostile values) — beyond the original M1 scope, where the delay field existed but was not enforced. | `client::tests::three_hop_per_hop_visibility`; `tests/m1_routing.rs` (delivery + no relay sees both sides of the path); `tests/m1_routing.rs::per_hop_mix_delay_is_enforced_by_relays`; `relay::tests::delay_clamped_and_enforced` |
| **M2 — Layer 2: admission** | Blind-signature tokens (RFC 9474, Privacy Pass v1) gate entry: unlinkable per-redemption, epoch-scoped double-spend set, proof checked ahead of mix layers. **Concurrent spam-resistance demonstrated.** | `tests/m2_admission.rs` (valid/replay/out-of-tokens/unlinkability); `tests/m5_load.rs` (8 clients, 200 concurrent frames, exact per-category rejection, relay responsive after) |
| **M3 — directory + Layer 3** | **Directory (beyond base MVP bar):** relays self-sign claims with long-term ed25519 keys; clients verify a signed gossip list and cross-check live handshake claims against it (§5.4, §8.5). **Message content:** Olm Double Ratchet encryption (forward secrecy + break-in recovery, verified against the crate source), full bidirectional session over the real path. | `tests/m3_directory.rs` (valid/unsigned/tampered/forged); `tests/m4_ratchet.rs` (bidirectional session, fresh key per message); `ratchet::tests` (N+1 key property, persistence) |
| **M4 — measurements + writeup** | Latency measured at 3 config points (`delay_ms` 0/25/50); anonymity-set and spam-resistance analysis written without overclaiming; per-hop-delay tradeoff documented. | `tests/latency_measure.rs` (ignored harness); `docs/LATENCY.md`, `docs/ANONYMITY_ANALYSIS.md`, `docs/SPAM_RESISTANCE.md` |
| **M5 — timing mixing** | **Exponential (Poisson) per-hop delay** (each hop's delay sampled from Exp(mean `delay_ms`); shape pinned deterministically) and **constant-rate Poisson cover traffic** (relays emit dummy Sphinx packets, routed like real packets, dropped at the exit; byte-size-indistinguishable). Both verified on the real path, including that cover bypasses the M2 admission gate without touching it. | `mix::tests` (deterministic distribution shape + constant-size Sphinx); `tests/m6_mixing.rs` (wire-varied delays; cover/admission interaction); `tests/m1_routing.rs` (Poisson-safe enforcement test); `tests/latency_measure.rs` (4 config points incl. cover); `docs/LATENCY.md`, `docs/ANONYMITY_ANALYSIS.md` (M5 updates) |

**Test suite:** 59 tests passing; `cargo clippy --all-targets -- -D warnings`
clean; `cargo fmt` clean (as of commit `8637699` + this M5 checkpoint).

## 2. Named follow-ups (per `docs/THREAT_MODEL.md` §3.1, §3.2, §6)

These are explicitly flagged future work, not silently absent:

- ~~**Cover traffic**~~ and ~~**Poisson-distributed per-hop delay**~~ — the
  two items M4 listed as the top timing follow-ups are **built in M5**
  (see the M5 row above and `docs/LATENCY.md`/`docs/ANONYMITY_ANALYSIS.md`).
  Remaining timing-mixing refinement: full per-mix queue shaping / loop
  messages (the rest of Loopix's mechanism). **M5+**.
- **Full gossip propagation / separate directory authority** — the signed
  list mechanics are real; propagation (exchanging lists, a DHT) and an
  out-of-band directory/pubkey that vouches for relay identity keys are
  **M5+** (per spec §5.4's own "full DHT is a stretch goal").
- **Real token-batch bootstrap** — the issuer's eligibility policy is a
  stub (one batch per client-id); PoW/reputation/stake bootstrap is the
  remaining spam-resistance gap (spec §4, §9). The spec's own bootstrap
  open questions (including a possible zk-SNARK-style budget argument) are
  unaddressed — the spec itself is not attached, so nothing further is
  claimed here.
- **Transport obfuscation, timing mixing beyond the fixed delay, SURB-based
  anonymous replies, per-relay rate limiting, persisted double-spend set.**
- **Global timing correlation is explicitly NOT solved** (spec §9) — the
  fixed per-hop delay is a partial, deterministic mitigation only, and the
  writeups say so.

## 3. Out of MVP scope per spec §5 (not built, deliberately)

- **Group messaging** (Olm is pairwise; Megolm/MLS would be required).
- **Mobile clients** (CLI/desktop only; plain TCP framing).
- **Formal security proofs** (evidence-based testing and written arguments
  instead — see `docs/SPAM_RESISTANCE.md` §3.4).
- **Global-deployment concerns**: real network RTTs, multi-machine
  distribution, operator reputation systems, and TLS at the edges are all
  beyond the current loopback MVP.

## 4. How to reproduce the claims

```console
$ cargo test                                   # 51 tests (latency harness is #[ignore]d)
$ cargo clippy --all-targets -- -D warnings
$ cargo test --release --test latency_measure -- --ignored --nocapture   # raw latency data
```

The latency numbers in `docs/LATENCY.md` are from a single internally
consistent run on a loopback, release-build environment; the harness prints
the authoritative raw TSV.
