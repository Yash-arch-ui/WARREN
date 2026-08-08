# Anonymity-set analysis (M4)

*Status: M4 writeup, per spec §5.5. This document states precisely what
"anonymity set" means for what is actually built — no more than that.*

## 1. What is actually built (the anchor for everything below)

The anonymity machinery that exists today is **Sphinx per-hop
unlinkability** over a **3-hop path**, **exponential (Poisson) per-hop
delay**, **cover traffic**, and token-gated admission:

- `client` builds a 3-hop Sphinx packet; each relay peels one layer and
  learns only its immediate predecessor/successor (`src/client.rs`,
  `src/relay.rs`). Verified in code (`client::tests::
  three_hop_per_hop_visibility`) and over the wire
  (`tests/m1_routing.rs`: no relay log contains both the sender's and
  receiver's side of the path).
- Relays **enforce** a per-hop mix delay (`[relays] delay_ms`,
  `relay::enforce_delay`). Since M5 each hop's delay is **sampled from an
  exponential distribution** with the configured mean (Poisson mixing,
  spec §3.2; `mix::exp_delay_ms`) — a distribution, not a constant,
  tunable per user.
- **Cover traffic is built (M5):** a relay configured with
  `--cover-rate <n>` emits dummy Sphinx packets on a constant-rate Poisson
  schedule, routed through its successors and dropped at the exit
  (`relay::cover_loop`, `mix::poisson_interarrival_ms`). Cover packets are
  byte-size-indistinguishable from real packets (Sphinx is constant-size —
  pinned by `mix::tests::sphinx_packets_constant_size_across_path_lengths`)
  and use the same empty-proof relay-to-relay framing, so a wire observer
  cannot tell them apart (`tests/m6_mixing.rs`: the middle relay forwards
  them identically and cannot mark them).
- The **signed gossip list** pins relay identity keys (spec §8.5); a
  substituted relay is rejected before send.

## 2. What "anonymity set" means here

For a given message, the anonymity set is the set of possible senders (or
receivers) that the adversary's observations are consistent with, *given the
machinery that actually exists*.

### 2.1 Against a passive wire observer (no relay compromise)

Sphinx hides which hops carry the packet and who sent it to whom: the
observer sees fixed-size, layer-encrypted packets. **The anonymity set for
the sender is, in principle, all users of the network who could have sent a
message at that time.** Two distinct effects bound the *practical* set:

- **Cover traffic (built, M5) pads the set.** Relays emit dummy packets on
  Poisson schedules, so the traffic an observer can count at the network
  edge is decoupled from *real* senders: an observer cannot tell cover from
  real, so every cover packet expands the candidate set for a given
  message. The M4-era limitation ("the set is bounded by concurrent real
  senders, not padded") no longer applies — the set is **padded**, not just
  bounded.
- **Timing still leaks within the padded set.** With a single real sender
  and heavy cover, the observer sees many packets but can still correlate
  entry and exit events with *probabilistic* confidence using the delay
  distribution and the network floor. Exponential per-hop delay raises that
  cost (a constant is no longer subtractable); it does not eliminate it
  (see §4 and `docs/LATENCY.md` §3).

The honest statement: **the anonymity set today is padded by cover traffic
— not merely bounded by concurrent real senders — but it is still finite**
and proportional to the cover volume (plus real traffic) at the time of a
message, not to "all users of the network ever". Cover volume is a tunable
cost (`--cover-rate`).

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
them. WARREN is a pseudonymous messenger, not an anonymous-posting system;
that is by design (the peer you message is in your config, and the ratchet
session pins your identity to them).

## 3. How relay count and delay interact at the tested configurations

The tested configurations are: 3 hops, delay_ms ∈ {0, 25, 50} (`docs/
LATENCY.md`). The anonymity-relevant effects of each knob, stated honestly:

| Configuration | Anonymity-relevant effect |
|---|---|
| **3 hops** (fixed) | Per-hop unlinkability against any *single* compromised relay (structural, verified). No *additional* protection against 3-relay collusion. |
| **delay_ms = 0** | No timing decoupling. An observer correlating entry/exit timings sees 1:1 message correspondence in time; cover padding (if enabled) still prevents *counting*. Anonymity set = concurrent real senders + cover volume (§2.1). |
| **delay_ms = 25 / 50 (mean)** | Per-hop delays are **exponential** (M5): per-message timing is a distribution with an exponential tail, so there is no constant offset an observer can subtract. Raises the *cost* of timing correlation (probabilistic; not eliminated — §4). |
| **cover-rate > 0** | Constant-rate Poisson dummy packets pad network volume: counting attacks fail (output volume decoupled from real senders), expanding the candidate set. No measurable real-message latency cost at 20/s (`docs/LATENCY.md` §2). |
| **Relay count scaling (future)** | More relays per path increases the *collusion threshold* and the number of mixes a timing observer must correlate across — but does **not** create anonymity padding beyond what cover already provides. |

**Bottom line, no overclaiming:** at the tested configurations the
deliverable anonymity guarantees are (a) *per-hop path unlinkability* against
a single compromised relay (verified), (b) a *cover-padded* anonymity set
against a passive observer (bounded by cover volume + concurrent real
traffic, not by real senders alone), and (c) *raised* — not eliminated —
timing-correlation cost from exponential per-hop delay. What would still
materially grow the set (a larger relay directory with constrained
selection, SURB-based anonymous replies) remains named future work (§5);
what the docs previously listed as unbuilt — cover traffic and Poisson
delay — is now built and measured.

## 4. Timing correlation (the §9 honest admission)

A global passive adversary correlating arrival/departure times can match
senders to receivers. The fixed per-hop delay is a *partial, deterministic*
mitigation (see `docs/LATENCY.md` §3). This is consistent with spec §9's own
admission that global timing correlation is never fully solved; this
implementation does not claim more.

## 5. Built in M5, and what still remains

**Built and measured in M5** (no longer deferred; flagged in
`docs/THREAT_MODEL.md` §3.1):

1. **Cover traffic** — constant-rate Poisson dummy packets, wire-size
   indistinguishable from real ones, dropped at the exit; verified over the
   real path in `tests/m6_mixing.rs`. This is the single biggest lever for
   anonymity-set growth and it is now in place.
2. **Poisson-distributed / randomized per-hop delay** — exponential
   per-hop delays (Loopix-style) replacing the fixed constant; shape pinned
   deterministically in `mix::tests`, observed on the wire in
   `tests/m6_mixing.rs`.

**Still deferred** (flagged in `docs/THREAT_MODEL.md` §6):

1. **Directory growth + constrained random path selection (per-operator
   caps)** — raises the collusion threshold (spec §3.2). Currently the path
   is a fixed 3-relay config. **M5+**.
2. **SURB-based anonymous replies** — the recipient currently knows the
   sender (§2.3); SURBs would allow reply without identity disclosure.
   **M5+**.
3. **Loopix's full per-mix queueing** — relays buffer-and-sleep per
   connection today (exponential hold per hop, as in Loopix), but the mix
   does not yet reshape its own *arrival* process (batched mixing, loop
   messages). The per-hop delay + cover combination is the core of §3.2; the
   remaining queue-shaping details are M5+ refinements.
