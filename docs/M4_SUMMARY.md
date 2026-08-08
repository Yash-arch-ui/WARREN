# Milestone summary (M0–M6)

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
| **M6 — bootstrap** | **Proof-of-work token-batch bootstrap** (spec §4/§9): the issuer's eligibility policy is no longer a stub — a per-request challenge bound to `(nonce, client_id, epoch)` must be mined (`--pow-bits`, default 26) before **one batch per (client, epoch)** is granted. Tunable; honest bound verified (linear M×2^bits cost vs. 0 with the gate off; legit user 36 563 hashes / 0.26 s at bits=18). | `pow::tests` (deterministic shape/binding); `credential::tests` (enforcement, misbinding, single-use challenges); `tests/m7_bootstrap.rs` (measured linear attacker scaling + legit-user usability); `tests/cli_smoke.rs` (mine-then-grant CLI path); `docs/THREAT_MODEL.md` §3.2/§3.7/§6, `docs/SPAM_RESISTANCE.md` §3.1, `docs/LIBRARY_SELECTION.md` §7 |
| **M7 — directory K-of-N** | The relay list's trust root is no longer a single key: **N independent directory keys (default 3), K-of-N threshold (default 2)**. A client accepts a list only when ≥K of its configured keys attest it (`[directory] keys` + `threshold`; `--dir-key` on `warren directory-fetch`); attestation is **strict** — a forged/unconfigured key rejects the list even alongside K valid ones. Removes the single-directory-key assumption; still a fixed small N (gossip/DHT explicitly out of scope). | `directory::tests` (`k_of_n_threshold_enforced`, `forged_or_mismatched_attestation_rejects_even_with_k_valid`, `attestations_bind_to_the_entries`); `config::tests` (policy parse/defaults); `tests/m8_directory.rs` (1-of-3 refused pre-network, 2-of-3 routes a real message, forged rejected alongside 2 valid); `docs/THREAT_MODEL.md` §1/§2.E/§6 |
| **M8 — wire obfuscation** | Every frame is wrapped in a **TLS 1.2 application-data record shell** (`[0x17 03 03][u16 len][frame]`, chunked at the 16 KiB TLS plaintext cap) before hitting the wire, on both relay and client sides (`net::send_frame`/`recv_frame`); routing/mixing underneath is unchanged. **Honest bound:** defeats naive protocol-shape DPI fingerprinting; not a real TLS session (no handshake), so no claim against active probing / full protocol validation; obfs4-equivalent transports explicitly out of scope. | `net::tests` (`wire_bytes_are_tls_record_shaped`, `raw_tcp_wire_is_tls_record_shaped_and_parses`, `large_frame_spans_tls_records_and_reassembles`, updated `oversized_frame_rejected`); the entire integration suite (m1–m8) now runs over the wrapped wire, proving relay↔client consistency; `docs/THREAT_MODEL.md` §2.A/§5/§6 |

**Test suite:** 77 tests passing (+1 `#[ignore]`d latency harness);
`cargo clippy --all-targets -- -D warnings` clean; `cargo fmt` clean (as of the M8 checkpoint).

## 2. Named follow-ups (per `docs/THREAT_MODEL.md` §3.1, §3.2, §6)

These are explicitly flagged future work, not silently absent:

- ~~**Cover traffic**~~ and ~~**Poisson-distributed per-hop delay**~~ — the
  two items M4 listed as the top timing follow-ups are **built in M5**
  (see the M5 row above and `docs/LATENCY.md`/`docs/ANONYMITY_ANALYSIS.md`).
  Remaining timing-mixing refinement: full per-mix queue shaping / loop
  messages (the rest of Loopix's mechanism). **M5+**.
- ~~**Separate directory authority**~~ — **built in M7** as a **K-of-N
  multi-signer directory** (N keys, threshold K; see the M7 row). What
  remains is real **gossip propagation** (exchanging lists, a DHT) and
  per-operator path caps — **explicitly out of scope for this project**
  (hackathon scope), per `docs/THREAT_MODEL.md` §6, not a future TODO.
- ~~**Token-batch bootstrap**~~ — **built in M6** as per-batch proof of
  work (`src/pow.rs`), replacing the M2 one-batch-per-client stub; see the
  M6 row and `docs/SPAM_RESISTANCE.md` §3.1 for the honest bound (a cost
  floor, not a Sybil wall — supply scales with hashrate). What remains is
  named, not silent: **memory-hard PoW** (Argon2-style) to close the
  GPU/hashrate gap, and the spec's own open bootstrap questions (e.g. a
  possible zk-SNARK-style budget argument) are still unaddressed — the
  spec itself is not attached, so nothing further is claimed here.
- ~~**Transport obfuscation**~~ — **built in M8** at the minimum-viable bar
  (TLS-record-layer dressing; bounded claim in `docs/THREAT_MODEL.md` §5;
  pluggable-transport-grade resistance explicitly out of scope). Still
  named, not built: SURB-based anonymous replies, per-relay rate limiting,
  persisted double-spend set.
- **Global timing correlation is explicitly NOT solved** (spec §9) — the
  fixed per-hop delay is a partial, deterministic mitigation only, and the
  writeups say so.

## 3. Out of MVP scope (not built, deliberately — no expansion proposed)

- **Group messaging** (Olm is pairwise; Megolm/MLS would be required).
- **Mobile clients** (CLI/desktop only; plain TCP framing).
- **Formal security proofs** (evidence-based testing and written arguments
  instead — see `docs/SPAM_RESISTANCE.md` §3.4).
- **Global-deployment concerns**: real network RTTs, multi-machine
  distribution, operator reputation systems, and TLS at the edges are all
  beyond the current loopback MVP.
- **Named out of scope for this project** (hackathon scope): memory-hard
  PoW hardening, zk-SNARK budget, full gossip/DHT, per-operator path caps,
  bridge relays, jurisdictional diversity, app distribution, loop
  messages. They strengthen banked wins, not the claim being made, and are
  not pursued.

## 4. How to reproduce the claims

```console
$ cargo test                                   # 67 tests (latency harness is #[ignore]d)
$ cargo clippy --all-targets -- -D warnings
$ cargo test --release --test latency_measure -- --ignored --nocapture   # raw latency data
```

The latency numbers in `docs/LATENCY.md` are from a single internally
consistent run on a loopback, release-build environment; the harness prints
the authoritative raw TSV.
