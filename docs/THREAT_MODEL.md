# UNLINK threat model

*Status: M0–M2 written up. Still provisional against the full
`unlink-project-spec.md` (never attached); to be reconciled once it is
shared.*

This document defines what UNLINK's mixnet architecture is *designed* to
defend against and — just as importantly — what it **explicitly does not**
for the MVP. Every M1/M2 engineering decision should be traceable back to an
entry here.

---

## 1. Trust roots and assumed environment

- The **directory** is a trusted (but auditable) root: it is *not* a mix
  relay and never sees message traffic. Its public key is pinned in the
  client (out-of-band). It signs the relay list. *(Stub — M-later.)*
- The **issuer** (M2) is a trusted root for *admission only*: it signs blind
  tokens, never sees message traffic, and cannot link a redemption back to
  an issuance (see §4). A compromised issuer can mint tokens (a spam vector)
  but not deanonymize traffic.
- **Relays** are *untrusted*, individually. Sphinx is designed so that no
  single relay learns the full path, the sender, or the plaintext.
- The **client's local machine** is trusted (no firmware-level attacker).
- Cryptographic primitives are assumed sound (Sphinx format, ChaCha20,
  HKDF, x25519, RFC 9474 blind RSA, Double Ratchet in M2).

## 2. Adversary capabilities we defend against

### A. Passive network observer (wire-level)

**Capability:** can read all traffic on links between clients and relays, and
between relays.

**Defense:** the Sphinx packet format — every layer is encrypted under a
per-hop key derived (via HKDF) from an ephemeral x25519 shared secret.
Observers see fixed-size, indistinguishable packets and cannot recover
sender, recipient, payload, or path. TLS on the client→first-relay hop adds
link protection at the edges.

**Architecture mapping:** `client::send` builds the packet (M1);
`relay` unwraps/forwards (M1).

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

**Defense (M2):** the Double Ratchet provides forward secrecy and
post-compromise security for message *content*. SURBs (single-use reply
blocks, via `sphinx-packet`'s `surb` module) allow anonymous replies without
revealing your address.

## 3. Explicitly NOT defended against in MVP scope

These are accepted risks for M0/M1; each is documented so it can be
revisited deliberately, not by accident.

1. **Global timing correlation (spec §9).** A passive adversary with
   *global* visibility (all links) can correlate packet arrivals and
   departures across the network by timing, defeating mix anonymity.
   **Not fully solved** — by design and per spec §9. Sphinx provides
   *unlinkability of layers*, not *anonymity under global timing analysis*;
   that requires traffic shaping, cover traffic, and mix strategies
   (e.g., Poisson mixing) beyond MVP. MVP mitigations are limited to:
   fixed-size packets (no length signal) and no plaintext routing metadata.
   *This is the single biggest known gap and is deliberately deferred.*

2. **Sybil attacks on the directory.** An adversary who can flood the
   directory with colluding relays can increase `P(all hops adversarial)`.
   Defending requires reputation, proof-of-work, or stake. **M2 status:**
   reputation gating is now *mechanically* implemented (blind-signature
   admission tokens) but the **bootstrap — who deserves a batch — is a
   stubbed placeholder**: one batch per client-id, ever (spec §4 open
   question, §PoW caveat; `credential::Issuer::grant_batch`, flagged
   TODO-M-later). This placeholder is **known to be insufficient** for
   real spam resistance; it exists so the token mechanics can be tested
   end-to-end.

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
   pseudonymous. **M2 status:** unauthenticated senders are now dropped at
   the entry relay (no/ invalid/spent/wrong-epoch token ⇒ `drop:`), so
   *token-less* spam is blocked — but because bootstrap is a placeholder
   (see §3.2), a granted batch can still be sybil-sprayed. Rate limiting
   per relay and real bootstrap are M-later.

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
  middle/exit relays also require proofs or restrict ingress); (c) the
  client→relay pubkey handshake is unauthenticated plaintext — a MITM can
  substitute its own key for hop 1 (this is the directory's future job).

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

## 6. Open items

- Reconcile against the full spec (esp. §9 timing, §3.2 admission position).
- Real directory + constrained random path selection (per-operator caps).
- Real bootstrap for token batches (spec §4; PoW/reputation) — replaces the
  one-batch-per-client stub.
- Persist/sync the relay double-spend set across restarts (M3); per-hop
  admission enforcement or ingress restriction (M3).
- Network-split issuer (issue over the wire, issuer key outside the client's
  data dir) — `Issuer::blind_sign` already takes only `BlindMessage`s, so
  the split is a serialization/transport exercise.
- SURB-based replies; Double Ratchet content encryption; transport
  obfuscation; timing mixing (§3.1).
