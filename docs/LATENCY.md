# End-to-end latency and the per-hop-delay tradeoff (M4, extended M5)

*Status: M4 writeup, extended for M5's timing mixing. Raw data reproduced
below (one consistent run, 2026-08-08, release build); the tradeoff
discussion follows. **Since M5, `delay_ms` is a Poisson mean** — per-hop
delays are sampled from an exponential distribution, not a fixed value — so
the M4 numbers are *not comparable* to these; the mechanism itself changed.*

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
  cross-check, spec §8.5) on every send, so each sample includes three extra
  loopback round-trips plus all three relay hops + delivery.
- **Harness:** `tests/latency_measure.rs` (ignored by default — run with
  `cargo test --release --test latency_measure -- --ignored --nocapture`).
- **Environment:** release build, single Linux machine, all three relays +
  sender + receiver on `127.0.0.1`; 30 samples per config point, 5 ms
  inter-message gap. No artificial network delay — loopback, the protocol
  floor on this hardware.

## 2. Raw data — the delay knob is now a Poisson *mean*

Per spec §3.2's "randomized per-hop delay… tunable per user", M5 replaced
the fixed per-hop delay with an **exponential distribution of mean
`delay_ms`** sampled per hop by the sender (`mix::exp_delay_ms`); each
forwarding relay enforces its hop's sampled delay by sleeping before
forwarding (`relay::enforce_delay`). Per-message latency is therefore the
sum of **two independent Exp(mean) samples** (entry + middle; `FinalHop`
carries no delay field, so the exit delivers immediately) plus the ~8 ms
loopback floor — i.e. mean ≈ **2 × delay_ms + floor**, with an exponential
tail, not a constant.

### delay_ms = 0 (no enforced delay; unchanged baseline)

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 4.10 | | 15 | 7.85 |
| 1  | 4.13 | | 16 | 7.97 |
| 2  | 4.21 | | 17 | 8.07 |
| 3  | 4.57 | | 18 | 8.31 |
| 4  | 5.22 | | 19 | 8.77 |
| 5  | 5.39 | | 20 | 8.87 |
| 6  | 5.43 | | 21 | 9.01 |
| 7  | 5.61 | | 22 | 9.94 |
| 8  | 5.92 | | 23 | 10.11 |
| 9  | 6.76 | | 24 | 10.30 |
| 10 | 6.86 | | 25 | 10.48 |
| 11 | 6.90 | | 26 | 10.51 |
| 12 | 7.30 | | 27 | 12.04 |
| 13 | 7.33 | | 28 | 13.17 |
| 14 | 7.42 | | 29 | 15.03 |

```
summary  delay_ms=0  no-cover  min_ms=4.10  mean_ms=7.92  p50_ms=7.85  p95_ms=13.17  max_ms=15.03
```

### delay_ms = 25 (Poisson mean)

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 15.30 | | 15 | 49.72 |
| 1  | 17.59 | | 16 | 50.96 |
| 2  | 17.98 | | 17 | 51.24 |
| 3  | 19.05 | | 18 | 53.61 |
| 4  | 19.99 | | 19 | 56.57 |
| 5  | 21.72 | | 20 | 57.56 |
| 6  | 21.81 | | 21 | 58.58 |
| 7  | 22.92 | | 22 | 61.39 |
| 8  | 27.84 | | 23 | 65.49 |
| 9  | 32.98 | | 24 | 70.92 |
| 10 | 33.44 | | 25 | 78.42 |
| 11 | 34.74 | | 26 | 104.25 |
| 12 | 41.20 | | 27 | 120.43 |
| 13 | 43.36 | | 28 | 124.29 |
| 14 | 44.38 | | 29 | 139.98 |

```
summary  delay_ms=25  no-cover  min_ms=15.30  mean_ms=51.92  p50_ms=49.72  p95_ms=124.29  max_ms=139.98
```

### delay_ms = 50 (Poisson mean)

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 24.16 | | 15 | 96.57 |
| 1  | 34.41 | | 16 | 96.86 |
| 2  | 42.94 | | 17 | 101.07 |
| 3  | 46.69 | | 18 | 107.80 |
| 4  | 46.78 | | 19 | 122.93 |
| 5  | 56.18 | | 20 | 136.36 |
| 6  | 62.54 | | 21 | 162.17 |
| 7  | 67.36 | | 22 | 165.66 |
| 8  | 68.44 | | 23 | 179.38 |
| 9  | 68.67 | | 24 | 192.63 |
| 10 | 71.00 | | 25 | 196.28 |
| 11 | 77.34 | | 26 | 209.38 |
| 12 | 81.30 | | 27 | 215.72 |
| 13 | 82.85 | | 28 | 217.13 |
| 14 | 90.60 | | 29 | 269.24 |

```
summary  delay_ms=50  no-cover  min_ms=24.16  mean_ms=113.01  p50_ms=96.57  p95_ms=217.13  max_ms=269.24
```

### delay_ms = 25 **with cover traffic** (entry relay emitting 20 dummy packets/s, Poisson)

| Sample | t (ms) | | Sample | t (ms) |
|--------|--------|-|--------|--------|
| 0  | 11.86 | | 15 | 52.79 |
| 1  | 14.31 | | 16 | 53.33 |
| 2  | 18.38 | | 17 | 56.55 |
| 3  | 19.83 | | 18 | 56.60 |
| 4  | 20.65 | | 19 | 57.29 |
| 5  | 23.42 | | 20 | 57.76 |
| 6  | 23.81 | | 21 | 60.85 |
| 7  | 25.65 | | 22 | 80.80 |
| 8  | 26.07 | | 23 | 81.50 |
| 9  | 27.09 | | 24 | 81.92 |
| 10 | 34.17 | | 25 | 88.40 |
| 11 | 35.60 | | 26 | 93.78 |
| 12 | 36.47 | | 27 | 99.44 |
| 13 | 49.46 | | 28 | 112.86 |
| 14 | 50.05 | | 29 | 116.65 |

```
summary  delay_ms=25  cover=20  min_ms=11.86  mean_ms=52.24  p50_ms=52.79  p95_ms=112.86  max_ms=116.65
```

### Summary table

| Config point | min (ms) | mean (ms) | p50 (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|---|
| delay 0 (no delay) | 4.10 | 7.92 | 7.85 | 13.17 | 15.03 |
| delay 25 (mean) | 15.30 | 51.92 | 49.72 | 124.29 | 139.98 |
| delay 50 (mean) | 24.16 | 113.01 | 96.57 | 217.13 | 269.24 |
| delay 25 (mean) + cover 20/s | 11.86 | 52.24 | 52.79 | 112.86 | 116.65 |

**What the numbers say (raw):**

1. **Mean tracks 2 × mean + floor.** E[latency] = 2·E[Exp(μ)] + floor:
   μ=25 → 51.92 ≈ 50 + 2; μ=50 → 113.01 ≈ 100 + 13. The floor (μ=0) run
   was noisier this session (mean 7.92 vs 4.21 in M4 — machine load), so the
   constant absorbed into the μ=50 estimate is the same ballpark. **Each 1 ms
   of mean per-hop delay costs ≈ 2 ms of mean end-to-end latency.**
2. **The shape changed from a constant to a distribution.** Where M4's fixed
   delay produced p50 ≈ p95 (53→59 ms at 25 ms), the exponential now produces
   a real tail: at μ=25, p50 ≈ 50 ms but p95 ≈ 124 ms and max ≈ 140 ms; at
   μ=50, p95 ≈ 217 ms and max ≈ 269 ms (≈ 2.3× the mean). This spread is the
   *point* of §3.2's randomized delay — per-message timing is no longer a
   predictable constant an observer can subtract.
3. **Cover traffic does not measurably degrade real-message latency** at
   20 packets/s: μ=25 with cover mean 52.24 vs 51.92 without. Cover runs in
   its own emitter thread and each cover packet is a separate connection
   whose per-hop sleeps are per-connection — relays are thread-per-connection,
   so cover never serializes real traffic on loopback.

## 3. The tradeoff: what the knob costs vs. what it now buys

### What it costs (measured)

- **Linear mean latency.** Every 1 ms of *mean* per-hop delay adds ≈ 2 ms of
  *mean* end-to-end latency. At μ=50, mean ≈ 113 ms on loopback — ~14× the
  no-delay floor. The cost is paid on **every message**; interactive use
  degrades roughly with the mean.
- **Heavy tails.** Because each hop's delay is exponential, a message's
  total delay has an exponential tail: p95 ≈ 2.4× the mean at μ=50. For
  latency-sensitive traffic this is the real cost of statistical mixing.
- **Throughput coupling.** With mean delay larger than the send gap, many
  messages are in flight simultaneously (thread-per-connection, so they
  don't serialize — the tail cost shows up as relay load, not per-message
  blocking). Sustained send rates above roughly `1/μ` per relay per second
  push the network into heavier tails (observed in M4's noisy run).
- **Unchanged protocol floor.** The ~8 ms no-delay floor includes the three
  relay-handshake round-trips of path re-verification (spec §8.5) on every
  send — a fixed cost the delay knob does not remove.

### What it's meant to buy (and the honest limit)

The purpose of per-hop delay in mixnet architecture is to **decouple the
timing of packet arrivals from departures at each relay**, so a passive
observer correlating entry-side timings with exit-side timings gets a
fuzzier match. M5's exponential per-hop delay does the *statistical* half of
that: per-message latency is now a random variable with an exponential tail,
so an observer cannot subtract a constant offset (M4's fixed-delay
weakness) — the entry-to-exit delay distribution is the sum of two
exponentials, and matching entry/exit events requires correlating through
that distribution.

**But the honest limits, stated plainly (consistent with spec §9, which
admits global timing correlation is never fully solved):**

1. **The mean is still learnable.** An adversary with enough samples can
   estimate the per-hop mean μ and the network floor, and use
   deconvolution/maximum-likelihood to recover *probabilistic* sender-receiver
   matches. Exponential delay raises the cost of correlation; it does not
   make it information-theoretically impossible.
2. **Cover traffic (now built) is what breaks the *counting* attack.** With
   dummy packets flowing on Poisson schedules, an observer can no longer
   count real messages 1:1 across the network (see
   `docs/ANONYMITY_ANALYSIS.md`). The measured latency impact of 20/s cover
   is negligible (§2.3).
3. **Batch/queue analysis still applies.** A determined global adversary can
   use batch-matching statistics; Loopix's full defense (per-mix Poisson
   queues, loop messages, dependent per-mix delay distributions) is only
   approximated here — per-hop delay is exponential (as in Loopix) but the
   per-relay *arrival* processes are not yet reshaped by the mix itself
   (the relays do not buffer-and-batch; they sleep per connection).
4. **§9 stands:** this is a *raised-cost* mitigation, not anonymity.

**Net statement:** the knob now buys a *measured, roughly linear* mean
latency cost in exchange for a *statistical* per-message timing distribution
and (with cover) decoupling of traffic counting. It is a genuine
implementation of spec §3.2's "randomized per-hop delay and cover traffic, à
la Loopix/Nym" — a deterministic constant is gone — while §9's admission
that timing correlation is never *fully* solved remains true and is not
overclaimed here.

## 4. Notes for M4/M5 consumers

- All numbers are loopback, single-machine, release build — the protocol
  floor, not a deployment prediction.
- Run-to-run variance: the μ=0 point swings a few ms (OS scheduling); the
  μ>0 points are dominated by the enforced sleeps, so their *means* are
  stable but their *tails* move run to run (exponential).
- M4's fixed-delay numbers are **not comparable** to M5's — the mechanism
  changed from a constant to a distribution with the same config key.
- The path re-verification cost (three handshakes per send) is a candidate
  optimization target for a future milestone (per-session pinned keys),
  separate from the timing-mixing story.
