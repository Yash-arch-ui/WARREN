# Library selection

Four cryptographic dependencies (M6's proof-of-work adds **no new
dependency** — it reuses `sha2`, already in the tree), chosen with the
same evidence standard:

1. **§1 — Sphinx mix packets (M0/M1):** [`sphinx-packet`](https://crates.io/crates/sphinx-packet)
   (Nymtech, Apache-2.0, v0.7.0). The project language is therefore **Rust**.
2. **§2 — Blind-signature admission tokens (M2):**
   [`blind-rsa-signatures`](https://crates.io/crates/blind-rsa-signatures)
   (jedisct1, MIT, v0.17.2) — RFC 9474, the Privacy Pass v1 primitive.
3. **§4 — Relay long-term identity signing (M3):**
   [`ed25519-dalek`](https://crates.io/crates/ed25519-dalek)
   (Dalek team, BSD-3-Clause/Apache-2.0, v2.1) — RFC 8032, the natural
   pairing with the existing `x25519-dalek` keys.
4. **§5 — Double Ratchet message-body encryption (M3):**
   [`vodozemac`](https://crates.io/crates/vodozemac) (Matrix, Apache-2.0,
   v0.10.0) — the Olm Double Ratchet with verified forward secrecy +
   break-in recovery.

---

# §1 Sphinx mix-packet implementation

**Decision: reuse [`sphinx-packet`](https://crates.io/crates/sphinx-packet)**
(Nymtech's Rust Sphinx implementation), pinned at **`0.7.0`** in
`Cargo.toml`.

---

## Options considered

### Rust: `sphinx-packet` (crates.io, by Nymtech) — ✅ SELECTED

| Attribute       | Value (verified 2026-08-08)                                  |
|-----------------|--------------------------------------------------------------|
| Latest version  | `0.7.0`                                                      |
| Last release    | **2026-07-24** (two weeks ago)                               |
| License         | **Apache-2.0** (declared in the published crate metadata)    |
| Repo            | `github.com/nymtech/sphinx` (288★, not archived, 12 open issues) |
| Downloads       | **285k+**                                                    |
| Production use  | Same code Nym's production mixnet runs                        |
| Dependencies    | `x25519-dalek 3`, `chacha20`, `aes`, `hkdf`, `hmac`, `sha2`, `subtle`, `zeroize`, `bs58`, `lioness-rs` (SURBs), `rand` |
| Package layout  | Standalone lib crate (`sphinx_packet`), no Nym stack required |
| Edition / Rust  | edition 2021, compiles on current stable Rust (1.9x)         |

Why it wins:

1. **Maturity.** It is the reference implementation of the Sphinx packet
   format (Danezis & Goldberg) used by a deployed production mixnet (Nym).
   Not a toy or an academic prototype: it ships an integration test suite and
   criterion benchmarks in the published crate.
2. **Active maintenance.** `0.7.0` released July 2026; commit history shows
   ongoing work (seeded payload keys, `ExpandedSharedSecret`/`ReplyTag`, and
   removal of legacy packet handling — i.e. it is *evolving its security
   posture*, not frozen).
3. **License.** Apache-2.0 — permissive for our use, compatible with the
   rest of the Rust crypto ecosystem we depend on.
4. **Correct primitives.** ChaCha20/AES per-hop encryption, HKDF per-hop key
   derivation, x25519 group ops for shared secrets, `zeroize` for key
   hygiene, and `lioness-rs` for Single-Use Reply Blocks (needed for
   anonymous replies in M2).

### Rust: `sphinx` (crates.io) — ❌ rejected

**Name-collision trap.** The crates.io `sphinx` crate is *not* a mix packet
implementation at all — it is an unrelated egui page-switching utility (max
version `0.0.0`, last updated 2022). Anyone searching "sphinx rust crate"
can waste time here. Only `sphinx-packet` is the real Sphinx format crate.

### TypeScript / Node.js — ❌ rejected

There is **no maintained pure-TS implementation** of the Sphinx packet format:

- npm search for Sphinx mixnet libraries returns only unrelated projects
  (`@sphinx-labs/*` is a Solidity contract toolchain, `sphinx-agent` is an
  unrelated secret-guard CLI, etc.).
- Nym's own TS offerings (`@nymproject/nym-client-wasm`,
  `nym-client-wasm-node`) are **WASM bindings compiled from the Rust code** —
  i.e., even in a TS project you would be calling into the Rust
  implementation. That gives you the complexity of both worlds with none of
  the benefit of native Rust.

Conclusion: a TS/Node WARREN would either (a) reimplement Sphinx crypto from
scratch — explicitly out of scope for this project — or (b) wrap WASM. Rust +
`sphinx-packet` is strictly better.

---

## How it will be used (M1 preview)

API names below were **verified against the 0.7.0 source** (`src/lib.rs`,
`src/packet/mod.rs`) — no guessing:

- **Client send path:** `sphinx_packet::SphinxPacketBuilder` (root
  re-export; underlying module `packet::builder`) — `build_packet::<M>`
  builds a packet over a relay path with per-hop keys derived from a fresh
  x25519 ephemeral.
- **Relay unwrap path:** `SphinxPacket::process(&StaticSecret)` →
  `ProcessedPacket` — peel one layer, check the per-hop MAC, then forward
  (routing) or deliver (payload / SURB).
- **Reply path (M2):** `sphinx_packet::surb::{SURB, SURBMaterial}` —
  Single-Use Reply Blocks so replies don't require the original sender to be
  online or reveal their address.

> Status (M1 complete): `sphinx-packet` is now a **required** dependency and
> is exercised end-to-end: `src/client.rs` builds packets with
> `SphinxPacket::new`/`SphinxPacketBuilder` over a 3-hop route, and
> `src/relay.rs` unwraps with `SphinxPacket::process`. The per-hop
> unlinkability claim is verified in code (`client::tests::
> three_hop_per_hop_visibility`) and over the wire (`tests/m1_routing.rs`).

---

# §2 Blind signatures for reputation-gated admission

**Decision: reuse [`blind-rsa-signatures`](https://crates.io/crates/blind-rsa-signatures)**
(jedisct1 / Frank Denis), pinned at **`0.17.2`**. This is the Privacy Pass
v1 primitive: RSA blind signatures per **RFC 9474** (the IETF standard for
exactly this use — one-time unlinkable tokens).

## Why this one

| Attribute       | Value (verified 2026-08-08)                                    |
|-----------------|----------------------------------------------------------------|
| Latest version  | `0.17.2`                                                      |
| Last release    | **2026-05-21**                                                 |
| License         | **MIT**                                                        |
| Repo            | `github.com/jedisct1/rust-blind-rsa-signatures` (not archived)  |
| Downloads       | **8.5M+**                                                      |
| Protocol        | RFC 9474 (RSA Blind Signatures) — the Privacy Pass v1 primitive |
| Modes           | `Randomized` and `Deterministic` blinding, PSS salt options    |
| APIs            | batch-friendly, PEM/DER/SPKI key serialization, `serde` opt-in |
| Security review | Author is Frank Denis (libsodium); used by Cloudflare's Privacy Pass |

**Maturity.** 8.5M downloads, MIT, actively maintained (May 2026 release),
by the author of libsodium. This is *the* reference Rust implementation of
RFC 9474 and is what Privacy Pass deployments build on. It is far more
mature than anything else in the space.

**The property that matters: unlinkability across redemptions, not just blind
issuance.** This is the trap the brief warns about, so it gets checked
explicitly. Blind issuance alone only guarantees the *issuer* cannot read
what it signs; unlinkability across redemptions additionally requires that a
verifier cannot tie a redemption back to its issuance. RFC 9474 RSA blinding
gives the stronger property: a token is `(m, sig)` where `sig = m^d` and the
issuer only ever saw `blinded = m·r^e mod N` for client-chosen random `r`.
Since for any observed `(m, blinded)` pair there exists an `r` making them
consistent, the issuance transcript is *information-theoretically independent*
of the redemption. The crate's own README states it directly: *"no one
besides the client can link (message', signature') to (message,
signature)."*

We pin the code-checkable part of this in `credential.rs`
(`token_ids_not_derivable_from_issuance_view`: the relay's double-spend
identifiers are `SHA-256(nonce ‖ msg_randomizer)`, i.e. derived from
client-only randomness, and none is derivable from the issuer's transcript
of `BlindMessage`s) and over the wire (`tests/m2_admission.rs`,
`no_correlatable_identifier_across_redemptions`).

## What unlinkability we are actually getting (and where it stops)

Don't assume "blind signature" = "fully unlinkable in every pattern":

- ✅ **Per-token issuance↔redemption unlinkability** (RSA blinding, above).
- ✅ **Single-use by construction**: our wallet pops tokens and relays keep an
  epoch-scoped double-spend set of `SHA-256(nonce ‖ randomizer)`; reuse is
  detectable (by design) and impossible from the same wallet.
- ⚠️ **Epoch-linkable**: tokens are bound to an epoch, so a verifier can tell
  *which epoch* a token belongs to. That is inherent to epoch-scoped
  double-spend and is fine for M2 (it also bounds the double-spend set).
- ⚠️ **Redemption-pattern leakage outside the protocol**: IP/timing linkage
  of redemptions is *not* prevented by the signature scheme — that is the
  mixnet's job (and global timing correlation is explicitly out of scope;
  see `docs/THREAT_MODEL.md` §3.1).
- ⚠️ **Batch metadata is client-side only**: nothing on the wire identifies
  the batch or the client; the wallet never transmits such data.

## Alternatives considered

### `voprf` (facebook/voprf) — ❌ rejected

- License Apache-2.0, but **`0.6.0-pre.1` — a pre-release**, 574K downloads.
- Raw VOPRF (draft-irtf-cfrg-voprf) is the *building block* behind Privacy
  Pass v2 (RFC 9577), **not** a token scheme: adopting it means implementing
  the PPv2 token format, issuance messages, and redemption rules ourselves.
  That is exactly the hand-rolled-crypto territory M2 forbids.

### RustCrypto `rsa` — ❌ rejected

- The `rsa` crate does expose a `Blinder`, but only as a low-level
  primitive. Building RFC 9474 on it means reimplementing the protocol
  (blind, blind-sign, unblind, verify, salt/randomizer handling, batch)
  ourselves. `blind-rsa-signatures` is the maintained, reviewed
  implementation of that exact protocol.

### Cloudflare `privacy-pass` (TypeScript) — ❌ rejected

- Cloudflare's Privacy Pass implementation is TypeScript. We are already
  committed to Rust for Sphinx; introducing a second language for one
  primitive is not worth it, and the Rust `blind-rsa-signatures` crate is
  the same underlying protocol.

### BLS blind signatures — ❌ rejected

- Blind BLS (e.g. via `bls12_381`) is elegant but the pairing-based
  ecosystem has no maintained, protocol-shaped crate for this use; we would
  be hand-rolling the Schnorr-style blinding. RFC 9474 gives us a standard
  with a reference implementation — no reason to invent.

## If nothing suitable had existed

The brief asked for an explicit fallback rather than a closest-enough pick.
Had `blind-rsa-signatures` not existed, the fallback would have been a
**small, scoped RSA blind-signature module** implementing RFC 9474 over
RustCrypto's `rsa` (`Blinder`), limited to exactly the Privacy Pass v1 flow,
with vectors from the RFC test suite. That fallback is **not needed** — the
crate exists, is mature, and is the reference implementation.

## How it is used (M2)

- **`src/credential.rs`**: `Issuer` (signs only `BlindMessage`s),
  `ClientTokenWallet` (blind → issuer → finalize, spend-by-pop),
  `RelayAdmission` (verify + epoch-scoped double-spend set).
- **Wire**: the proof (`epoch ‖ nonce ‖ msg_randomizer ‖ sig`) is attached
  ahead of the mix-wrapped packet in the frame, so the entry relay checks it
  **without unwrapping any mix layer** (spec §3.2 "Layer 2 position" —
  interpretation documented in `docs/THREAT_MODEL.md` §4).

---

# §4 Ed25519 for relay long-term identity signing

**Decision: reuse [`ed25519-dalek`](https://crates.io/crates/ed25519-dalek)**
(Dalek cryptography team), pinned at **`2.1`** in `Cargo.toml`.

## Why this one

| Attribute       | Value (verified 2026-08-08)                                |
|-----------------|-------------------------------------------------------------|
| Latest version  | `2.1`                                                       |
| License         | **BSD-3-Clause** (dual-licensed BSD-3 / Apache-2.0)         |
| Repo            | `github.com/dalek-cryptography/curve25519-dalek` (not archived) |
| Downloads       | **30M+**                                                     |
| Scheme          | RFC 8032 Ed25519 (EdDSA over Curve25519)                    |
| Security review | The standard Rust ed25519 implementation; used across the RustCrypto / dalek ecosystem |

**Why Ed25519 is the natural pairing with x25519.** The relays already use
`x25519-dalek` for Sphinx per-hop keys (M1), and both schemes live on the
same Curve25519 group with the same 32-byte public-key size — one curve,
one mental model, one 32-byte key field in our wire format (the Sphinx
header fields are already 32 bytes, so an identity pubkey fits the same
encoding). Ed25519 is the RFC 8032 standard for exactly this job:
sign-verify a short fixed-format message (a relay's claim) with no
interactive setup and a compact 64-byte signature.

**Why not the alternatives:**

- `ed25519-dalek 2.x` (selected) vs **1.x**: 2.x is the current maintained
  line (1.x is deprecated upstream); 2.x also aligns with the dalek
  `curve25519-dalek` that `x25519-dalek 3` already pulls in.
- **RSA / P-256 (ECDSA)**: require ASN.1/DER key handling and bigger
  signatures; ECDSA needs a nonce (r, s) format that is less natural for a
  64-byte fixed wire field than Ed25519's (R, S).
- **BLS**: pairing-based, no maintained Rust crate with a simple sign/verify
  API in our dependency tree; overkill for self-signed relay metadata.
- **Hand-rolling anything**: signing relay claims is exactly the
  don't-implement-crypto-yourself territory the project already avoids (§1,
  §2); `ed25519-dalek` is a maintained, audited primitive.

## How it is used (M3)

- **`src/directory.rs`**: `RelayClaim` — `(address, sphinx_pubkey,
  identity_pubkey)` self-signed with the relay's long-term ed25519 key over
  a canonical byte encoding; `SignedRelayList` bundles per-relay claims for
  the client's gossip list. Verification is `verify_strict` (RFC 8032
  strict rules — small-order/re-encoded points rejected).
- **`src/relay.rs`**: each relay loads (or generates) a 64-byte key file
  `[x25519 secret 32][ed25519 secret 32]`; the 32-byte M1/M2-era format is
  auto-migrated. The claim is served over the `FRAME_INFO_REQ` handshake.
- **`src/client.rs`**: the client verifies the live handshake claim's
  signature and cross-checks identity + sphinx keys against its verified
  gossip list before building the Sphinx route (spec §8.5).

---

# §5 Double Ratchet message-body encryption

**Decision: reuse [`vodozemac`](https://crates.io/crates/vodozemac)** (the
Matrix foundation's Olm library), pinned at **`0.10.0`** in `Cargo.toml`.
This is the reference implementation of the Signal Double Ratchet protocol
that Matrix uses in production (`matrix-rust-sdk`).

## Why this one

| Attribute       | Value (verified 2026-08-08)                                   |
|-----------------|----------------------------------------------------------------|
| Latest version  | `0.10.0`                                                      |
| Last release    | 2026 (actively maintained)                                    |
| License         | **Apache-2.0**                                                |
| Repo            | `github.com/matrix-org/vodozemac` (maintained by the Matrix foundation) |
| Downloads       | **1M+**                                                        |
| Production use  | Matrix's `matrix-rust-sdk` end-to-end encryption               |
| Protocol        | The Signal **Double Ratchet** (Ratcheted DH + symmetric ratchet) |
| Verified claims | *"Perfect forward secrecy"* **and** *"self-healing"* — i.e. break-in recovery (post-compromise security) |

## The M2-style trap check: forward secrecy + break-in recovery, verified

The brief warns not to assume the label "Double Ratchet" implies the full
forward-secrecy + break-in-recovery guarantee — the same trap as M2's
blind-sig check. So this was verified against the **actual crate source**
(not just the marketing blurb):

- **Forward secrecy** (compromise of the current state does not reveal past
  message keys): vodozemac's root README states the session uses *"a fresh
  key for every message and deletes it immediately after use"* — i.e. each
  message key is derived by a KDF chain step and erased once consumed, so an
  old ciphertext cannot be decrypted with later state (this is the property
  our `message_n_plus_one_does_not_decrypt_with_message_n_key` test pins:
  replaying message N after the ratchet advances fails).
- **Break-in recovery / post-compromise security** (compromise of current
  state does not permanently poison future messages): the README's
  "self-healing" property — *"every reply that the other party sends is
  encrypted with a fresh key pair"* — is the DH ratchet step: each new
  message from the peer introduces a fresh ephemeral DH key, so an attacker
  who compromises the current ratchet state cannot predict future chain keys
  unless they can also compromise the peer's fresh ephemerals.

Both are structural properties of the Double Ratchet (DH ratchet per message
on the receiving side, KDF chain per message on the sending side), and they
are what make Olm a real ratchet rather than a stream cipher with a counter.

## Why not the alternatives (checked with the same rigor)

### `ratchet` (crates.io) — ❌ rejected

**Name-collision trap (like §1's `sphinx`).** The crates.io `ratchet` crate
is **not** a Double Ratchet implementation at all — it is an unrelated
**cryptographic PRNG** (a "ChaCha-based random generator" per its README).
Its docs contain a `DoubleRatchet` name only as a coincidence of
terminology. Anyone searching "rust double ratchet" can burn hours here.

### `double-ratchet` (Dynisious, crates.io) — ❌ rejected

A spec-conformant `CryptoProvider`-based implementation, but: effectively
**unmaintained and unproven** (no releases on crates.io beyond an early
version, no visible downstream users or reviews), and it requires the
consumer to **implement the `CryptoProvider` trait** (providing HKDF,
ChaCha20-Poly1305, X25519 wrappers) — which pushes the crypto wiring into
our code, exactly the hand-rolled-crypto territory this project forbids.
vodozemac ships a complete, tested implementation with zero glue code.

### `mls-rs` / `openmls` — ❌ rejected

MLS is a **group** messaging protocol (KeyPackages, group state, epoch
transitions, a Delivery Service). Our spec needs **pairwise** message-body
encryption between two clients, with a simple two-party session — MLS
brings an entire group handshake and committee architecture that is wrong
shaped for a two-party channel and far heavier than needed.

### Hand-rolling a ratchet — ❌ rejected

The project rule (from §1/§2): never implement crypto ourselves.

## How it is used (M3)

- **`src/ratchet.rs`** — `RatchetClient`: a persisted vodozemac `Account`
  (curve25519 identity + one-time keys) plus per-peer `Session`s, keyed by
  the peer's identity key hex. `encrypt` opens the outbound session on first
  use (`create_outbound_session` with the peer's identity + one-time key
  from config) and produces the first message as a **pre-key message**;
  `decrypt` establishes the inbound session from a pre-key message
  (`create_inbound_session`, consuming the matching one-time key) or matches
  a normal message by trying each stored session on a **clone** and
  committing only on success (a wrong candidate never mutates state).
- **Session setup is manual/config'd for M3** (the task's allowance):
  `warren ratchet-init` prints the client's identity key + a fresh one-time
  key; the peer pastes those into its `[peers.<name>]` config entry. The
  library's own pre-key message flow then *is* the session establishment —
  no separate X3DH handshake needs to be implemented by us (the task
  permits this since the chosen library requires it).
- **Wire format**: the encrypted body is `[u8 message_type][olm message]`
  inside the Sphinx payload, replacing the M1/M2 plaintext. Relays are
  unchanged — to them it is opaque payload.
- **`src/client.rs`** — `send` encrypts the body (Layer 3) before spending a
  token and wrapping in Sphinx; `listen` decrypts delivered bodies with the
  matching session.

## Verified forward-secrecy test (code, not vibes)

`ratchet::tests::message_n_plus_one_does_not_decrypt_with_message_n_key`
encrypts two messages, asserts the wire bytes differ for identical
plaintext, decrypts both in order, then asserts **replaying either message
after the ratchet advanced fails** — the exact forward-secrecy property the
crate claims, pinned in code. `tests/m4_ratchet.rs` additionally drives a
full bidirectional session over the real 3-hop relay path.

---

# §6 Poisson delay & cover traffic (M5)

**Design decision: no new library — build on what is already in the tree.**

## The check (step 1 of the M5 task, done before writing code)

**Is there a maintained Rust crate for Loopix-style Poisson mixing?** No.
Checked crates.io and the Nym project: Nym's timing mixing (the
`nym-sphinx` header delays, `nym-mixnode`'s Poisson delay queue, cover/loop
drop messages) is **embedded in Nym's node software** — its crates are
published only as internal pieces of the `nymtech/nym` monorepo, tightly
coupled to the node's event loops and topology; there is no standalone,
reusable "Poisson mix scheduler" crate on crates.io. This is the same
situation as M1's Sphinx check, but reversed: `sphinx-packet` *is* a
reusable crate, while the timing layer is not. Nothing on crates.io named
`mixnet`/`loopix` is a maintained library for this.

**So this is a design/parameter question, as suspected** — the primitives
were already in the dependency tree:

- **Exponential sampling:** `rand_distr` is already a direct dependency of
  `sphinx-packet` 0.7.0 — `sphinx-packet`'s own `Delay` type samples from
  `rand_distr::Exp` (verified in `header/delays.rs` of the published
  crate). Adding `rand_distr = "0.6"` to our `Cargo.toml` reuses the
  **already-locked** version (0.6.0, paired with our `rand 0.10.2`)
  — zero new transitive dependencies, and the same distribution type the
  Sphinx header crate itself uses. `Exp::new(lambda)` takes the *rate*
  (mean = 1/λ), so the client samples `Exp(1 / delay_ms)` per hop
  (`mix::exp_delay_ms`).
- **Constant-rate Poisson cover scheduling:** the same `Exp` distribution
  gives Poisson inter-arrival times (`mix::poisson_interarrival_ms`); the
  relay's existing sleep-before-forward mechanism (`relay::enforce_delay`)
  and thread-per-connection model host the emitter with no timers
  framework needed (a plain `thread::sleep` loop; no tokio required — this
  project is deliberately synchronous).
- **Wire-indistinguishability of cover packets** rests on a *property of
  the Sphinx format we already use*: packet size is constant regardless of
  path length (the crate sizes the header by `MAX_PATH_LENGTH`, not the
  actual route). Verified in code
  (`mix::tests::sphinx_packets_constant_size_across_path_lengths`), so a
  relay-generated cover packet is byte-size identical to a real one.

**Alternatives rejected:** hand-rolling inverse-CDF exponential sampling
(unnecessary — the verified primitive is already in the tree); adopting
Nym's internal crates (not published for standalone use); introducing
`tokio` just for timers (the synchronous design already sleeps per
connection; a tokio event loop would be a rewrite, not a reuse).

---

# §7 Proof-of-work token-batch bootstrap (M6)

**Design decision: no new library — SHA-256 via the existing `sha2`
dependency (`src/pow.rs`).** The reputation-bootstrap question (spec §4/§9:
who deserves a token batch, without an identity check that reintroduces
linkability) is answered with the cheapest cost-bearing mechanism: the
issuer grants a batch only to a client presenting a proof of work over a
challenge bound to `(issuer nonce, client_id, epoch)`.

## Why SHA-256 (no new dependency), not a memory-hard hash

- **SHA-256 is already in the tree** — `sha2 0.11` is used by
  `credential::Token::id` — so mining and verification add **zero new
  crates** (the project rule: never add a dependency without a reason; and
  never implement crypto ourselves — we implement *work*, not crypto). The
  primitive itself is a preimage-resistant hash from the RustCrypto
  audited family; we only chain inputs (`challenge ‖ counter`) and count
  leading zero bits.
- **Why not Argon2/other memory-hard KDFs (M6):** memory-hardness exists
  to close the GPU/ASIC gap — but at this project's scale the *honest*
  claim is the linear-hashrate bound anyway (`docs/THREAT_MODEL.md` §3.2:
  this is a cost floor, not a Sybil wall). Introducing a memory-hard
  primitive now would be a new dependency + parameter (memory, iterations)
  whose benefit we cannot honestly claim to *measure* at MVP scale. It is
  named as the first hardening direction, not silently dropped.
- **Why not a VDF (verifiable delay function) or hash-chain:** VDFs need
  trusted-setup-free yet expensive-to-verify constructions that are
  exactly the don't-implement-crypto-ourselves territory; a simple
  leading-zero-bits target is standard, tunable (`--pow-bits`), and
  trivially verified.

## Design details (what was verified in code, not assumed)

- **Difficulty = required leading zero bits** of `SHA-256(challenge ‖
  counter)`; expected work = 2^bits. `bits == 0` disables the gate
  (everything verifies) — the same tunable pattern as `delay_ms`.
- **Challenge binding** (`pow::challenge`): `SHA-256(nonce ‖ client_id ‖
  epoch)` with a **fresh per-request nonce**, so a solution is not
  reusable across clients, epochs, or issuer grants, and cannot be
  precomputed before the challenge exists.
- **Single-use challenges** (`Issuer::pending`): consumed by the first
  `grant_batch` attempt — success *or* failure — so a stale solution can
  never be replayed (pinned in `credential::tests` and
  `tests/m7_bootstrap.rs`).
- **One batch per (client, epoch)**, re-earnable each epoch: fresh tokens
  for established users (no day-two lockout), while every new identity
  pays the proof-of-work cost. The M2 "one batch ever" stub is replaced;
  the blind-signature flow is untouched (PoW runs before it, invisible to
  redemption).
- **Verified, not assumed:** `pow::tests` (deterministic solution/verify),
  `credential::tests` (gate enforcement, misbinding, single-use),
  `tests/m7_bootstrap.rs` (measured linear scaling: 128 identities ≈
  M × 2^bits hashes vs. 0 with the gate off; legit user 36 563 hashes /
  0.26 s at bits=18).
