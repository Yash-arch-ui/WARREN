# Anonymity-set analysis (M4)

*Status: M4 writeup, per spec §5.5. This document states precisely what
"anonymity set" means for what is actually built — no more than that.*

## 1. What is actually built (the anchor for everything below)

The anonymity machinery that exists today is **Sphinx per-hop
unlinkability** over a **3-hop path**, plus per-hop mix delay and
token-gated admission:

- `client` builds a 3-hop Sphinx packet; each relay peels one layer and
  learns only its immediate predecessor/successor (`src/client.rs`,
  `src/relay.rs`). Verified in code (`client::tests::
  three_hop_per_hop_visibility`) and over the wire
  (`tests/m1_routing.rs`: no relay log contains both the sender's and
  receiver's side of the path).
- Relays **enforce** a per-hop mix delay (`[relays] delay_ms`,
  `relay::enforce_delay`) — fixed, deterministic, tunable per user.
- The **signed gossip list** pins relay identity keys (spec §8.5); a
  substituted relay is rejected before send.
- **No cover traffic** is built. **No Poisson/randomized per-hop delay** is
  built. There is no anonymity *padding* of any kind beyond Sphinx's
  fixed-size packets.

## 2. What "anonymity set" means here

For a given message, the anonymity set is the set of possible senders (or
receivers) that the adversary's observations are consistent with, *given the
machinery that actually exists*.

### 2.1 Against a passive wire observer (no relay compromise)

Sphinx hides which hops carry the packet and who sent it to whom: the
observer sees fixed-size, layer-encrypted packets. **The anonymity set for
the sender is, in principle, all users of the network who could have sent a
message at that time** — *if* there were enough simultaneous traffic to make
that meaningful.

That "if" is the honest crux: **the practical anonymity set today is bounded
by the number of concurrent real senders on the network, not padded by
dummy traffic.** Concretely:

- If only one user is sending while an observer watches, the observer sees
  one packet stream enter the network and (with timing correlation — see
  §4) can match it to one exit. Anonymity set ≈ 1, regardless of the delay
  knob.
- With N concurrent real senders, a *single* observed message has an
  anonymity set of at most N for the sender. This is the same bound every
  real mixnet has without cover traffic; cover traffic is what decouples
  "concurrent senders" from "traffic an adversary can count."

This is exactly the limitation `docs/THREAT_MODEL.md` §3.1 names: cover
traffic is a **named M4+ follow-up**, not built. This document does not
pretend otherwise.

### 2.2 Against a single malicious/compromised relay

This is where Sphinx gives a **structural**, code-verified guarantee rather
than a traffic-volume-dependent one:

- A compromised relay on the path sees only its predecessor and successor
  (for middle/entry relays) or the destination (for the exit relay). It
  cannot see the full path, the sender, or the plaintext.
- With 3 hops, what a single compromised relay sees depends on its
  position on the path: an **entry** compromise sees the sender directly
  (the client connects to it), an **exit** compromise sees the receiver
  directly, and a **middle** compromise sees only its immediate neighbors
  (the entry and exit relays) — neither the sender nor the receiver. So to
  keep both sender and receiver hidden from *any* single malicious relay,
  the honest relays must include the entry and the exit — i.e. **at least
  2 of the 3 hops must be honest**. The sender's anonymity set *with
  respect to the exit relay* is "all senders whose packets entered through
  relays other than this one's predecessor" — again bounded in practice
  by concurrent traffic, but the *path knowledge* is provably absent.

**Honest boundary:** if an adversary compromises **all 3** relays on a
victim's path (or a sufficient colluding subset), Sphinx provides no
protection — that is the collusion case, probabilistically mitigated only by
path selection over a large relay set (see §3 below), not by the protocol.

### 2.3 Against the recipient

The receiver learns the sender's **Layer-3 ratchet identity** (that is how
the Double Ratchet session works — `ratchet::decrypt` returns the sender's
identity key). So the anonymity set of a message *as seen by its
recipient* is exactly **{the sender}**: the recipient knows who messaged
them. UNLINK is a pseudonymous messenger, not an anonymous-posting system;
that is by design (the peer you message is in your config, and the ratchet
session pins your identity to them).

## 3. How relay count and delay interact at the tested configurations

The tested configurations are: 3 hops, delay_ms ∈ {0, 25, 50} (`docs/
LATENCY.md`). The anonymity-relevant effects of each knob, stated honestly:

| Configuration | Anonymity-relevant effect |
|---|---|
| **3 hops** (fixed) | Per-hop unlinkability against any *single* compromised relay (structural, verified). No *additional* protection against 3-relay collusion. No padding of the concurrent-sender bound. |
| **delay_ms = 0** | No timing decoupling. An observer correlating entry/exit timings sees 1:1 message correspondence in time. Anonymity set = concurrent senders (see §2.1). |
| **delay_ms = 25 / 50** | Adds a *fixed* hold time at entry + middle. Shifts the timing-correlation problem by a **constant** that a global observer can subtract. Provides **no** inter-message ambiguity between senders using the same config, and no ambiguity between real and (nonexistent) dummy traffic. |
| **Relay count scaling (future)** | More relays per path increases the *collusion threshold* and the number of mixes a timing observer must correlate across — but does **not** create anonymity padding. Only cover traffic does. |

**Bottom line, no overclaiming:** at the tested configurations the
deliverable anonymity guarantees are (a) *per-hop path unlinkability* against
a single compromised relay (verified), and (b) an anonymity set *bounded by
concurrent real senders* against a passive observer. The delay knob does not
increase the anonymity set — it increases the *effort* of timing
correlation by a constant factor that a determined global adversary can
calibrate out. The mechanisms that would actually grow the set — cover
traffic, Poisson delay, and a larger relay directory with constrained
selection — are all named future work, not built.

## 4. Timing correlation (the §9 honest admission)

A global passive adversary correlating arrival/departure times can match
senders to receivers. The fixed per-hop delay is a *partial, deterministic*
mitigation (see `docs/LATENCY.md` §3). This is consistent with spec §9's own
admission that global timing correlation is never fully solved; this
implementation does not claim more.

## 5. Deferred items that would materially change this analysis

These are flagged (not silently absent) in `docs/THREAT_MODEL.md` §3.1 and
§6:

1. **Cover traffic** — the single biggest lever: padding the network with
   indistinguishable dummy packets decouples "concurrent senders" from
   "countable traffic" and directly grows the anonymity set. **M4+**
   follow-up.
2. **Poisson-distributed / randomized per-hop delay** — turns the constant
   timing offset into a statistical distribution, the Loopix-style
   mechanism that actually resists timing correlation. **M4+** follow-up.
3. **Directory growth + constrained random path selection (per-operator
   caps)** — raises the collusion threshold (spec §3.2). Currently the path
   is a fixed 3-relay config. **M5+**.
4. **SURB-based anonymous replies** — the recipient currently knows the
   sender (§2.3); SURBs would allow reply without identity disclosure.
   **M5+**.
