# Library selection

Two cryptographic dependencies, chosen with the same evidence standard:

1. **§1 — Sphinx mix packets (M0/M1):** [`sphinx-packet`](https://crates.io/crates/sphinx-packet)
   (Nymtech, Apache-2.0, v0.7.0). The project language is therefore **Rust**.
2. **§2 — Blind-signature admission tokens (M2):**
   [`blind-rsa-signatures`](https://crates.io/crates/blind-rsa-signatures)
   (jedisct1, MIT, v0.17.2) — RFC 9474, the Privacy Pass v1 primitive.

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

Conclusion: a TS/Node UNLINK would either (a) reimplement Sphinx crypto from
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
