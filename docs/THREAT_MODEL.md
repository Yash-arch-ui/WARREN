# UNLINK threat model

*Status: M0–M6 written up. Still provisional against the full
`unlink-project-spec.md` (never attached); to be reconciled once it is
shared.*

This document defines what UNLINK's mixnet architecture is *designed* to
defend against and — just as importantly — what it **explicitly does not**
for the MVP. Every M1/M2/M3 engineering decision should be traceable back to
an entry here.

---

## 1. Trust roots and assumed environment

- The **directory** is a trust root for *routing integrity only*: it is
  *not* a mix relay and never sees message traffic. Since M7 it is **not a
  single key** — it is **N independent signing keys (default N=3) with a
  K-of-N threshold (default K=2)**. The client pins the N public keys in
  its config (`[directory]`) and accepts a relay list only if it carries
  **valid attestations from at least K of them** (`directory::
  SignedRelayList::verify_directory`, enforced in `client::send`; strict —
  a forged/unconfigured attestation rejects the list even alongside K
  valid ones). Below the attestation layer, the *list mechanics* are M3:
  every relay self-signs its metadata with a long-term ed25519 key and
  clients verify the signed list and cross-check live handshake claims
  (spec §8.5; §2.E).

  **What M7 removes and what it does not:** the single-directory-key trust
  assumption (the "one operator controls routing integrity" critique) is
  gone — no one key alone can steer clients' paths; compromising ≥K keys
  (or all N) still can. It is deliberately still a **fixed, small N** —
  real decentralized gossip/DHT (spec §5.4's stretch goal) is **explicitly
  out of scope for this project**, not a future TODO (§6). First-use trust
  (assembling the first list, choosing the N keys) remains an out-of-band
  bootstrap step.
- The **issuer** (M2) is a trusted root for *admission only*: it signs blind
  tokens, never sees message traffic, and cannot link a redemption back to
  an issuance (see §4). A compromised issuer can mint tokens (a spam vector)
  but not deanonymize traffic.
- **Relays** are *untrusted*, individually. Sphinx is designed so that no
  single relay learns the full path, the sender, or the plaintext.
- The **client's local machine** is trusted (no firmware-level attacker).
- Cryptographic primitives are assumed sound (Sphinx format, ChaCha20,
  HKDF, x25519, RFC 9474 blind RSA, ed25519, Olm Double Ratchet via
  `vodozemac` in M3).

## 2. Adversary capabilities we defend against

### A. Passive network observer (wire-level)

**Capability:** can read all traffic on links between clients and relays, and
between relays.

**Defense:** the Sphinx packet format — every layer is encrypted under a
per-hop key derived (via HKDF) from an ephemeral x25519 shared secret.
Observers see fixed-size, indistinguishable packets and cannot recover
sender, recipient, payload, or path. TLS on the client→first-relay hop adds
link protection at the edges. **M8:** the byte stream itself is dressed in
TLS 1.2 application-data record framing (`net::wrap_record`), so even its
*shape* matches ordinary TLS application data rather than a raw custom
protocol — with the honest bound of §5 (naive-shape resistance only, not
active probing).

**Architecture mapping:** `client::send` builds the packet (M1);
`relay` unwraps/forwards (M1); `net.rs` wraps/unwraps every frame (M8).

### B. Malicious relay (single compromised hop)

**Capability:** controls one relay on a path; can deviate from the protocol,
drop packets, alter routing metadata, or log everything it sees.

**Defense:** Sphinx gives **per-hop unlinkability** — a relay learns only its
immediate predecessor and successor, never the sender, final destination,
or plaintext. Per-hop MACs (keyed by the hop's derived key) let each relay
authenticate the layer it peels; a relay that tampers with a packet breaks
the MAC at the next honest hop, causing a drop (the tampering relay gains
nothing). No relay can forge a layer for a hop whose key it does not hold.

**Verified in code, not assumed (M1):** `client::tests::
three_hop_per_hop_visibility` unwraps a real 3-hop packet hop by hop and
asserts exactly what each relay can see — hop 1 sees only hop 2's address
and its forwarded bytes contain neither hop 3's address, the destination,
nor the plaintext; only the exit relay sees destination + plaintext. The
same property is asserted end-to-end over live relay processes in
`tests/m1_routing.rs` (no relay log contains both the sender's and the
receiver's side of the path).

**Architecture mapping:** `relay` unwrap-and-forward loop (M1).

### C. Compromised/rogue relay *operator* collusion (partial)

**Capability:** operates *several* relays on a victim's path and colludes.

**Defense:** probabilistic — with a path of length *L* chosen from a
directory of *N* relays (with per-operator caps on path membership), the
chance all hops are the adversary's is bounded. The directory's per-relay
operator binding + constrained random path selection (M1) keeps
`P(all hops adversarial)` low. This is **not** absolute, but a measurable
reduction; it is the standard mixnet trade-off.

### D. Malicious message *recipient* / metadata about the session

**Capability:** the peer you message can observe your behavior.

**Defense (M3):** the Olm Double Ratchet (via `vodozemac`, verified in
`docs/LIBRARY_SELECTION.md` §5) provides **forward secrecy** and
**post-compromise security** (break-in recovery) for message *content*: a
fresh key per message, erased after use, and a fresh DH keypair per reply.
Message bodies are encrypted at Layer 3 (`ratchet`) inside the Sphinx
payload; relays never see plaintext. The property is pinned in
`ratchet::tests::message_n_plus_one_does_not_decrypt_with_message_n_key`
and exercised end-to-end in `tests/m4_ratchet.rs`. SURBs (single-use reply
blocks, via `sphinx-packet`'s `surb` module) for anonymous replies remain
M5+.

### E. Poisoned relay list / unauthenticated relay pubkeys (M3)

**Capability:** an attacker who can intercept the client's connection to a
relay (or who controls a compromised gossip source) substitutes its own
x25519 key for the real relay's. Without authentication the client would
build its Sphinx route under keys the attacker holds, letting the attacker
decrypt every layer and deanonymize the sender (the "poisoned-relay-list"
attack, spec §8.5).

**Defense (M3, "a signed gossip list is enough" — spec §5.4):**

1. Every relay has a **long-term ed25519 identity key** (separate from its
   per-session x25519 Sphinx key) and self-signs a `RelayClaim`
   `(address, sphinx_pubkey, identity_pubkey)` at startup.
2. The client loads a **signed gossip list** and verifies **every entry's
   self-signature** before it will send anything. An attacker cannot forge
   an entry for an honest relay because it does not hold that relay's
   ed25519 key.
3. On the live handshake the relay returns its signed claim; the client
   verifies the signature **and cross-checks identity + sphinx keys against
   the list entry for that address**. A MITM substituting its own keys (or
   a relay that restarted with new keys while the list is stale) is
   rejected with a clean error.

**Verified in code and over the wire (M3):** `directory::tests`
(`tampered_claim_rejected`, `signature_binds_to_identity_key`,
`list_verify_rejects_any_bad_entry`, `unsigned_wire_body_rejected`),
`client::tests` (`handshake_claim_verified_and_parsed`,
`handshake_unsigned_claim_rejected`), and `tests/m3_directory.rs`
(valid list routes a message; unsigned / tampered / forged entries are
rejected by the real `unlink send` CLI).

**First-use caveat (TOFU, accepted for MVP):** a self-signature proves the
entry was produced by whoever holds that identity key — it does not by
itself prove the key belongs to the *real* relay at that address. The
client's protection is that it pins identity keys via the list (assembled
once, e.g. via `unlink directory-fetch` against relays it already trusts)
and thereafter rejects any relay whose live claim does not match.

**M7 attestation layer:** the N directory keys additionally vouch for the
*set* of identity keys — a relay list carries ≥K valid directory
attestations before a client will use it (`--dir-key` on
`unlink directory-fetch`; the client's `[directory] keys` + `threshold`).
An attacker would need ≥K directory keys (not one) to steer clients.
Real gossip **propagation** (exchanging lists between clients / a DHT) is
**explicitly out of scope for this project** — see §6.

## 3. Explicitly NOT defended against in MVP scope

These are accepted risks for M0/M1; each is documented so it can be
revisited deliberately, not by accident.

1. **Global timing correlation (spec §9).** A passive adversary with
   *global* visibility (all links) can correlate packet arrivals and
   departures across the network by timing, defeating mix anonymity.
   **Not fully solved** — by design and per spec §9. Sphinx provides
   *unlinkability of layers*, not *anonymity under global timing analysis*;
   that requires traffic shaping, cover traffic, and mix strategies
   (e.g., Poisson mixing) beyond MVP.

   **Implemented (M3 → M5), spec §3.2's "randomized per-hop delay and cover
   traffic… tunable per user":**

   - **Fixed per-hop delay (M3).** `[relays] delay_ms` rode in each hop's
     Sphinx header and each relay **enforced** it by sleeping before
     forwarding. Honored delays are **capped** at
     `relay::MAX_HONORED_DELAY_MS` (30 s): the header value is
     sender-controlled, so an uncapped sleep would let one hostile frame
     pin a relay's connection thread indefinitely (DoS; pinned by
     `relay::tests::delay_clamped_and_enforced`).
   - **Exponential (Poisson) per-hop delay (M5).** `delay_ms` is now the
     *mean* of an exponential distribution: the sender samples each hop's
     delay from Exp(mean) (`mix::exp_delay_ms`), so per-message timing is a
     distribution with an exponential tail, not a constant an observer can
     subtract. The shape is pinned deterministically in `mix::tests` and
     observed on the wire in `tests/m6_mixing.rs`.
   - **Cover traffic (M5).** Relays configured with `--cover-rate <n>`
     emit dummy Sphinx packets on a constant-rate Poisson schedule, routed
     through their successors and dropped at the exit (`relay::cover_loop`;
     a reserved drop destination, `mix::DROP_DESTINATION_PREFIX`). Cover is
     generated **after the M2 admission gate** (in-process), so it neither
     spends tokens nor interacts with the spam gate — verified explicitly
     in `tests/m6_mixing.rs` — and is byte-size-indistinguishable from real
     packets (Sphinx constant size, pinned by
     `mix::tests::sphinx_packets_constant_size_across_path_lengths`).

   *Global timing correlation remains the single biggest known gap and is
   deliberately deferred.* Exponential per-hop delay + cover traffic raise
   the cost of timing correlation (and break naive counting), but do **not**
   eliminate it — the writeups (`docs/LATENCY.md`, `docs/ANONYMITY_ANALYSIS.md`)
   state this plainly, consistent with spec §9's own admission. Remaining
   timing-mixing refinements (full per-mix queue shaping, loop messages) are
   M5+.

2. **Sybil attacks on the directory.** An adversary who can flood the
   directory with colluding relays can increase `P(all hops adversarial)`.
   Defending requires reputation, proof-of-work, or stake. **M6 status:**
   reputation gating is implemented (blind-signature admission tokens,
   M2), and the **bootstrap — who deserves a batch** — is now gated by
   **per-batch proof of work** (`src/pow.rs`;
   `Issuer::pow_challenge`/`grant_batch`): the issuer hands out a
   per-request challenge bound to `(fresh nonce, client_id, epoch)`, the
   client mines it at a tunable difficulty (`--pow-bits`, default 26 ≈
   67 M SHA-256 evals ≈ sub-second on commodity hardware), and one batch
   is granted per (client, epoch) — fresh tokens each epoch for
   established users, while every *new* identity (Sybil) pays the
   proof-of-work cost. **The honest bound — verified in
   `tests/m7_bootstrap.rs`, not assumed:** this is a **cost floor, not a
   Sybil wall**. Minting M identities costs ≈ M × 2^bits hashes (linear,
   no batch amplification — measured: 128 identities at bits=12 summed to
   ≈ 524k hashes, vs. **zero** hashes for the same minting with the gate
   off). But an attacker's *rate* scales with hashrate: a 20–100× GPU
   advantage buys 20–100× the batches for the same wall-clock (the
   well-known re-centralizing-around-compute caveat — see
   `docs/SPAM_RESISTANCE.md` §3.1 for the quantified numbers). Client ids
   are unauthenticated pseudonyms, so a third party can mine a batch under
   another's client_id and consume that identity's one-per-epoch slot — a
   griefing vector that costs the attacker one PoW, inherent to
   pseudonymous handles (and not a linkability leak). Memory-hard PoW
   (Argon2-style) or reputation/stake remain the hardening directions (§6).

3. **Compromised directory.** If the directory itself is malicious (or its
   key stolen), it can steer every client through colluding relays and
   deanonymize. Mitigations (auditability, multiple directories, signed
   transparency) are post-MVP.

4. **Local machine compromise.** Malware on the client, key theft, screen
   capture, clipboard snooping — all out of scope. We only do our part:
   keys stored 0600, `zeroize` on key material where practical.

5. **Denial of service.** Flooding relays, dropping relays off the network,
   sybilling — no DoS-resistance guarantees in MVP.

6. **Traffic analysis beyond timing** (packet counting, burst profiling,
   long-term intersection attacks). Partially mitigated by fixed packet
   sizes only.

7. **Sender authentication / spam prevention.** Messages are
   pseudonymous. **M6 status:** unauthenticated senders are dropped at the
   entry relay (no / invalid / spent / wrong-epoch token ⇒ `drop:`), so
   *token-less* spam is blocked; and batch bootstrap is now PoW-gated (see
   §3.2), so sybil-spraying is **no longer free** — each identity must
   mine ≈ 2^bits hashes per epoch. What remains: a funded attacker's
   spray *rate* scales with hashrate (the §3.2 bound), and per-relay rate
   limiting is still M-later.

8. **Quantum adversaries.** No post-quantum crypto in scope. (Sphinx can
   be layered with PQ KEMs later; the abstraction allows it.)

## 4. Credential unlinkability & the admission gate (M2)

### What the blind-signature library actually guarantees

We use `blind-rsa-signatures` (RFC 9474 / Privacy Pass v1) — see
`docs/LIBRARY_SELECTION.md` §2. The guarantee we rely on, stated precisely:

- **Per-token unlinkability between issuance and redemption** — RSA
  blinding makes the issuance transcript information-theoretically
  independent of the redeemed token. The relay's double-spend identifiers
  (`SHA-256(nonce ‖ msg_randomizer)`) are derived from client-chosen
  randomness the issuer never saw; the code-checks are
  `credential::tests::token_ids_not_derivable_from_issuance_view` and the
  wire-level `tests/m2_admission.rs`
  (`no_correlatable_identifier_across_redemptions`).
- **Where it stops (do not overclaim):** tokens are *epoch-linkable* (a
  verifier can tell which epoch a token belongs to); redemptions are
  linkable by IP/timing *outside* the protocol (mixnet's job, and global
  timing correlation is §3.1); and the *batch* a token came from is not
  revealed by the protocol — our client never transmits batch metadata.

### Admission-gate design (spec §3.2 "Layer 2 position", interpretation)

- The proof (`epoch ‖ nonce ‖ msg_randomizer ‖ sig`) is attached **ahead of
  the mix-wrapped packet** in the frame — "before Layer 1 mix-wrapping" — so
  the checking relay reads it **without unwrapping any mix layer**.
- **Only the entry relay enforces admission in M2.** The entry relay is the
  one that sees the client; middle/exit relays do not need it. Relay-to-relay
  frames carry *no* proof (fixed-length framing, uniform parser).
  Per-hop admission checks would require per-hop token shares or shared
  double-spend sync — deferred. *Interpretation pending the full spec.*
- **Storage tradeoff:** the double-spend set is epoch-scoped and dropped on
  rollover (bounded memory; no cross-epoch token profiling). Cross-epoch
  replay is blocked by the epoch check; only replay of a *stolen* old token
  in a later epoch is undetected (accepted for MVP).
- **Log hygiene:** relays log `admit`/`drop: <reason>` **without any token
  identifier** — the M2 unlinkability test asserts no correlatable value
  appears in relay *logs* across two redemptions from one batch. (The
  in-memory double-spend set *necessarily* holds the two token ids — that is
  its purpose — but those ids are independent random values with no link to
  the client, the batch, or each other.)
- **M2 caveats (accepted, M3 items):** (a) the double-spend set is in-memory
  and epoch-scoped — a relay restart forgets it, so within-epoch replay of a
  previously-spent token becomes possible until the epoch ends (persistence /
  sync is M3); (b) admission is enforced only at the entry relay — a client
  connecting straight to a middle/exit relay bypasses the gate (in M3,
  middle/exit relays also require proofs or restrict ingress).

  The former M2 caveat "(c) the client→relay pubkey handshake is
  unauthenticated plaintext" is **resolved in M3**: the handshake now
  returns the relay's self-signed claim, and the client verifies it and
  cross-checks it against its verified gossip list (spec §8.5; see §2.E).

## 5. Defense-in-depth notes

- **Data minimization:** UNLINK must never log plaintext, peer addresses, or
  full paths; `relay` logs routing metadata only when required. Verified by
  the M1 integration test (no relay log contains the plaintext; only the
  exit relay logs the destination).
- **Key hygiene:** identity/wallet/issuer material written 0600;
  ephemeral per-message keys; `zeroize` where the libraries support it.
- **Constant-time/format discipline:** packet and proof formats are fixed
  and unambiguous — this is *why* we reuse `sphinx-packet` (0.7.0,
  Apache-2.0) and `blind-rsa-signatures` (0.17.2, MIT) instead of
  hand-rolling crypto (see `docs/LIBRARY_SELECTION.md`).
- **Wire obfuscation (M8, minimum viable):** every frame is wrapped in a
  TLS 1.2 application-data record shell (`net::wrap_record`,
  `[0x17 03 03][u16 len][frame]`, chunked at the 16 KiB TLS plaintext cap)
  before hitting the wire, so a passive DPI observer sees TLS-shaped bytes
  instead of the old raw `[u32 len]`-prefixed custom protocol. The exact
  wire shape is pinned by `net::tests`
  (`wire_bytes_are_tls_record_shaped`,
  `raw_tcp_wire_is_tls_record_shaped_and_parses`,
  `large_frame_spans_tls_records_and_reassembles`). **The honest bound:**
  this **defeats naive protocol-shape fingerprinting**; it is **not** a
  real TLS session (there is no handshake — pure application-data records)
  and does **not** defeat active probing or a sophisticated DPI system
  doing full protocol validation. Pluggable-transport-grade resistance
  (obfs4-equivalent) is **explicitly out of scope for this project** (not
  a TODO).

## 6. Open items

- Reconcile against the full spec (esp. §9 timing, §3.2 admission position).
- ~~Real directory authority~~ — **BUILT (M7) as a K-of-N multi-signer
  directory**: N independent keys (default 3), client requires ≥K valid
  attestations (default 2), verified in `tests/m8_directory.rs` and
  `directory::tests`. Constrained random path selection (per-operator
  caps) and real **gossip propagation** (exchanging lists, a DHT — spec
  §5.4's own stretch goal) are **explicitly out of scope for this
  project** (hackathon scope), not future TODOs; the signed-list mechanics
  (self-signed relay claims, client-side verification, handshake
  cross-check — §2.E) remain the foundation they would build on.
- **Token-batch bootstrap is BUILT (M6, spec §4/§9)** — per-batch proof of
  work (`src/pow.rs`), tunable via `--pow-bits`, one batch per
  (client, epoch), with the honest linear-hashrate bound of §3.2 verified in
  `tests/m7_bootstrap.rs`. Hardening directions that remain: memory-hard PoW
  (Argon2-style, to close the GPU/hashrate gap), reputation/stake
  bootstrap, and per-relay rate limiting (still M-later).
- Persist/sync the relay double-spend set across restarts (M3); per-hop
  admission enforcement or ingress restriction (M3).
- Network-split issuer (issue over the wire, issuer key outside the client's
  data dir) — `Issuer::blind_sign` already takes only `BlindMessage`s, so
  the split is a serialization/transport exercise.
- **Cover traffic + Poisson/randomized per-hop delay are BUILT (M5)** —
  spec §3.2's core Layer-1 timing architecture: exponential per-hop delay
  and constant-rate Poisson cover are implemented, verified
  (`tests/m6_mixing.rs`), and measured (`docs/LATENCY.md`); see §3.1.
  Remaining timing-mixing refinement: full per-mix queue shaping / loop
  messages (the rest of Loopix's mechanism).
- ~~Transport obfuscation~~ — **BUILT (M8) at the minimum-viable bar**
  (TLS-record-layer dressing on all frames; bounded claim in §5).
  SURB-based anonymous replies remain out of scope. (Double Ratchet
  content encryption is **done** — M3, §2.D.)
