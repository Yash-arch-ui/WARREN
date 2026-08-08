# End-to-end latency measurements and the per-hop-delay tradeoff (M4)

*Status: M4 writeup of the raw M3 measurements, per spec §5.5. The raw data
is reproduced below (one consistent run, 2026-08-08, release build); the
tradeoff discussion follows.*

## 1. What is being measured

Full end-to-end send→receive cycle over the **real 3-hop relay path** with
the full real stack: Layer-3 Olm Double Ratchet encryption, M2
admission-token spend, signed-gossip-list + live-handshake verification,
Sphinx packet wrapping, plain TCP through **three real relay processes**,
delivery, and Double Ratchet decryption on the receiver.

- **Definition:** latency = `t_arrival − t_send_returned`, where
  `t_send_returned` is the moment the sender's `send_packet` returns (data
  written into the entry relay's TCP socket — there is no relay ack, so this
  is the honest boundary) and `t_arrival` is the moment the receiver's
  decrypt loop observed the delivered plaintext.
- **What the interval includes:** client-side ratchet encrypt + token spend
  are *outside* it, but **path re-verification is inside it** —
  `send_packet` handshakes all three relays (signed-claim verify + gossip
  cross-check, spec §8.5) on every send before building the packet, so each
  sample includes three extra loopback round-trips plus all three relay hops
  + delivery. This is a real cost of the current design, not an artifact.
- **Harness:** `tests/latency_measure.rs` (ignored by default — run with
  `cargo test --release --test latency_measure -- --ignored --nocapture`).
- **Environment:** release build, single Linux machine, all three relays +
  sender + receiver on `127.0.0.1`; 30 samples per config point, 5 ms
  inter-message gap. No artificial network delay — this is loopback, i.e.
  the floor for the protocol's per-hop overhead on this hardware.

## 2. Raw data — three configuration points of the per-hop mix delay

The per-hop mix delay (spec §3.2, `[relays] delay_ms`) is the knob under
study. Each forwarding relay enforces it by sleeping before forwarding
(`relay::enforce_delay`); on a 3-hop path the entry and middle relays each
contribute one enforced sleep, so the expected Δ between config points is
**2 × delay_ms** (the exit's `FinalHop` carries no delay field in this crate
and delivers immediately).

### delay_ms = 0

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 2.20 | | 15 | 3.88 |
| 1  | 2.27 | | 16 | 3.89 |
| 2  | 2.56 | | 17 | 4.21 |
| 3  | 2.57 | | 18 | 4.22 |
| 4  | 2.76 | | 19 | 4.30 |
| 5  | 2.89 | | 20 | 4.39 |
| 6  | 2.91 | | 21 | 4.45 |
| 7  | 3.12 | | 22 | 4.75 |
| 8  | 3.18 | | 23 | 4.94 |
| 9  | 3.27 | | 24 | 5.69 |
| 10 | 3.41 | | 25 | 5.89 |
| 11 | 3.64 | | 26 | 5.89 |
| 12 | 3.66 | | 27 | 6.77 |
| 13 | 3.78 | | 28 | 6.87 |
| 14 | 3.88 | | 29 | 10.16 |

```
summary  delay_ms=0  min_ms=2.20  mean_ms=4.21  p50_ms=3.88  p95_ms=6.87  max_ms=10.16
```

### delay_ms = 25

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 53.43 | | 15 | 55.25 |
| 1  | 53.44 | | 16 | 55.26 |
| 2  | 53.48 | | 17 | 55.26 |
| 3  | 53.73 | | 18 | 55.33 |
| 4  | 53.82 | | 19 | 55.38 |
| 5  | 53.96 | | 20 | 55.46 |
| 6  | 54.49 | | 21 | 55.68 |
| 7  | 54.49 | | 22 | 55.71 |
| 8  | 54.64 | | 23 | 55.75 |
| 9  | 54.88 | | 24 | 55.96 |
| 10 | 54.92 | | 25 | 56.01 |
| 11 | 55.01 | | 26 | 56.05 |
| 12 | 55.02 | | 27 | 56.22 |
| 13 | 55.17 | | 28 | 56.62 |
| 14 | 55.24 | | 29 | 58.74 |

```
summary  delay_ms=25  min_ms=53.43  mean_ms=55.15  p50_ms=55.25  p95_ms=56.62  max_ms=58.74
```

### delay_ms = 50

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 103.25 | | 15 | 105.84 |
| 1  | 103.75 | | 16 | 105.86 |
| 2  | 104.30 | | 17 | 105.87 |
| 3  | 104.50 | | 18 | 105.90 |
| 4  | 104.89 | | 19 | 105.99 |
| 5  | 104.99 | | 20 | 106.07 |
| 6  | 105.11 | | 21 | 106.32 |
| 7  | 105.21 | | 22 | 106.62 |
| 8  | 105.31 | | 23 | 106.82 |
| 9  | 105.35 | | 24 | 107.69 |
| 10 | 105.38 | | 25 | 107.72 |
| 11 | 105.39 | | 26 | 108.36 |
| 12 | 105.75 | | 27 | 108.80 |
| 13 | 105.77 | | 28 | 109.05 |
| 14 | 105.81 | | 29 | 110.30 |

```
summary  delay_ms=50  min_ms=103.25  mean_ms=106.07  p50_ms=105.84  p95_ms=109.05  max_ms=110.30
```

### Summary table

| delay_ms | min (ms) | mean (ms) | p50 (ms) | p95 (ms) | max (ms) |
|----------|----------|-----------|----------|----------|----------|
| 0        | 2.20     | 4.21      | 3.88     | 6.87     | 10.16    |
| 25       | 53.43    | 55.15     | 55.25    | 56.62    | 58.74    |
| 50       | 103.25   | 106.07    | 105.84   | 109.05   | 110.30   |

Δ mean, 0→25: **+50.9 ms**; Δ mean, 25→50: **+50.9 ms**. Both ≈ **2 × 25 ms
= 50 ms**, exactly the two enforced per-hop sleeps (entry + middle). The
per-hop delay mechanism is *linear and predictable*: each millisecond of
configured per-hop delay costs ≈ 2 ms of end-to-end latency on a 3-hop path.

The harness also prints the per-run sender/receiver identity keys (random
per run); they are irrelevant to the timing data and not reproduced here.
The raw output of the harness is the source of truth for the tables above.

## 3. The tradeoff: what the delay knob costs vs. what it buys

### What it costs (measured)

- **Linear latency.** Every 1 ms of per-hop delay adds ≈ 2 ms end-to-end
  (the two forwarding hops). At delay_ms = 50, a message takes ~106 ms mean
  on loopback — roughly 25× the no-delay floor (~4 ms). The cost is paid on
  **every message**, including replies, so interactive use degrades quickly:
  a two-message exchange at delay_ms = 50 costs ~212 ms before the responder
  can even decrypt.
- **Throughput coupling.** The measured numbers use a 5 ms inter-message
  gap; with a per-hop delay larger than the send gap, packets queue inside
  the relay path (thread-per-connection, one sleep per connection), so
  sustained send rates above `1/delay_ms` per relay will see latency grow
  beyond the clean linear curve (observed in an earlier noisy run: the
  delay=50 tail reached 300–400 ms under load). The knob is a
  latency-vs-mixing tradeoff, *not* a free lunch at scale.
- **Unchanged protocol floor.** The ~4 ms no-delay floor itself includes the
  three relay-handshake round-trips of path re-verification (spec §8.5) on
  every send — a fixed cost the delay knob does not remove.

### What it's meant to buy (and the honest limit)

The purpose of per-hop delay in mixnet architecture is to **decouple the
timing of packet arrivals from departures at each relay**, so a passive
observer correlating entry-side timings with exit-side timings gets a
fuzzier match. The measured knob does exactly the *deterministic* half of
that: a fixed hold time at entry and middle.

**But per-hop delay alone provides limited real protection against a global
timing adversary**, and this writeup does not claim otherwise:

1. **Fixed delay is fully predictable.** A fixed hold time per hop is just a
   constant offset added to every packet. An adversary who knows the
   configuration (it's per-user config, and even if not, it can be learned
   by observation) can subtract it. Constant offsets do **not** create
   timing ambiguity between two senders who use the same config.
2. **No cover traffic.** With no dummy packets, the observer can count real
   messages: a burst of N packets in equals a burst of N packets out. The
   anonymity set for a given message is bounded by the number of *concurrent
   real senders*, not padded by decoy traffic (see
   `docs/ANONYMITY_ANALYSIS.md`).
3. **No Poisson jitter.** A fixed delay produces no exponential-interarrival
   pattern, so batch/mix-queue analysis is straightforward. Loopix/Nym-style
   Poisson-distributed delay is the mechanism that actually creates the
   statistical ambiguity; it is a **named M4+ follow-up**
   (`docs/THREAT_MODEL.md` §3.1), not built here.
4. **Consistent with §9.** The spec itself (spec §9) admits global timing
   correlation is *never fully solved*; this implementation's fixed per-hop
   delay is a *partial, deterministic* step toward it and does not
   contradict that admission.

**Net statement:** the delay knob buys a *measured, linear* latency cost and
a *bounded, partial* timing-decoupling benefit. It is a genuine Layer-1
mechanism (beyond original M1 scope, where delay was carried but not
enforced), but the real timing-correlation defense — cover traffic +
Poisson-distributed delay — remains explicitly unbuilt and named as the top
M4+ follow-up.

## 4. Notes for M4 consumers

- All numbers are loopback, single-machine, release build — the protocol
  floor, not a deployment prediction.
- Run-to-run variance on the no-delay point is a few ms (OS scheduling on
  the shared sender/receiver loop); the delay-dominated points are tight
  (sub-ms spread at p95) because the enforced sleeps dominate.
- The path re-verification cost (three handshakes per send) is a candidate
  optimization target for a future milestone (e.g., per-session pinned
  keys), separate from the timing-mixing story.
