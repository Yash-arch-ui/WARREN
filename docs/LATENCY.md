# End-to-end latency measurements (M3)

*Status: **raw data only** — per the session brief, no analysis yet; M4 will
interpret this.*

## Methodology

- **Measurement:** full end-to-end send→receive cycle over the **real 3-hop
  relay path** with the full real stack: Layer-3 Olm Double Ratchet
  encryption, M2 admission-token spend, signed-gossip-list + live-handshake
  verification, Sphinx packet wrapping, plain TCP through **three real relay
  processes**, delivery, and Double Ratchet decryption on the receiver.
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
  + delivery. M4 analysis should weight the re-verification cost separately.
- **Per-hop mix delay (spec §3.2) is enforced and measured at two config
  points** (`[relays] delay_ms`): `0 ms` (no enforced delay) and `25 ms`
  (each forwarding relay sleeps 25 ms before forwarding; entry + middle
  enforce it on a 3-hop path, so the expected Δ is ≈ 2 × 25 ms).
- **Harness:** `tests/latency_measure.rs` (ignored by default — run with
  `cargo test --release --test latency_measure -- --ignored --nocapture`).
- **Environment:** release build, single Linux machine, all three relays +
  sender + receiver on `127.0.0.1`; 30 samples per config point, 5 ms
  inter-message gap. No artificial network delay — this is loopback, i.e.
  the floor for the protocol's per-hop overhead on this hardware.

## Raw samples (run 2026-08-08, release build)

### Config point 1: `delay_ms = 0`

| Sample | t (ms) |
|--------|--------|
| 0  | 1.44 |
| 1  | 1.73 |
| 2  | 2.25 |
| 3  | 2.57 |
| 4  | 2.71 |
| 5  | 4.07 |
| 6  | 4.11 |
| 7  | 4.18 |
| 8  | 4.43 |
| 9  | 4.48 |
| 10 | 4.57 |
| 11 | 4.57 |
| 12 | 4.64 |
| 13 | 4.69 |
| 14 | 4.71 |
| 15 | 4.73 |
| 16 | 5.01 |
| 17 | 5.03 |
| 18 | 5.04 |
| 19 | 5.29 |
| 20 | 5.58 |
| 21 | 5.87 |
| 22 | 6.42 |
| 23 | 7.04 |
| 24 | 7.55 |
| 25 | 8.27 |
| 26 | 10.09 |
| 27 | 10.37 |
| 28 | 10.55 |
| 29 | 10.75 |

```
summary  delay_ms=0  min_ms=1.44  mean_ms=5.42  p50_ms=4.73  p95_ms=10.55  max_ms=10.75
```

### Config point 2: `delay_ms = 25`

| Sample | t (ms) |
|--------|--------|
| 0  | 54.27 |
| 1  | 54.96 |
| 2  | 55.02 |
| 3  | 55.44 |
| 4  | 55.53 |
| 5  | 55.57 |
| 6  | 55.77 |
| 7  | 55.92 |
| 8  | 55.98 |
| 9  | 56.04 |
| 10 | 56.14 |
| 11 | 56.30 |
| 12 | 56.47 |
| 13 | 56.51 |
| 14 | 56.58 |
| 15 | 56.74 |
| 16 | 56.90 |
| 17 | 56.96 |
| 18 | 57.10 |
| 19 | 57.27 |
| 20 | 57.39 |
| 21 | 57.48 |
| 22 | 57.92 |
| 23 | 58.03 |
| 24 | 58.25 |
| 25 | 58.40 |
| 26 | 59.28 |
| 27 | 59.45 |
| 28 | 59.85 |
| 29 | 60.74 |

```
summary  delay_ms=25  min_ms=54.27  mean_ms=56.94  p50_ms=56.74  p95_ms=59.85  max_ms=60.74
```

## Raw summary lines

```
summary  delay_ms=0   min_ms=1.44  mean_ms=5.42  p50_ms=4.73  p95_ms=10.55  max_ms=10.75
summary  delay_ms=25  min_ms=54.27  mean_ms=56.94  p50_ms=56.74  p95_ms=59.85  max_ms=60.74
```

(Δ mean ≈ 51.5 ms ≈ the two enforced per-hop delays, entry + middle.)

## Notes for M4

- Raw numbers only here; no interpretation, comparison, or claims yet.
- Sender identity keys used in this run:
  `6160a29ee87f4821cccd54b8a065a761423093c86794c3b080e1e2b258f32b4e`
  (delay 0) and
  `edcbf42e8b4e4d2245ce1814a7af38f27729718c5e72fa8469de986beabd4a4d`
  (delay 25).
- Caveats recorded so M4 analysis can weight them: loopback only, single
  machine, no real network RTT, no contention, release build, per-hop delay
  is fixed (Poisson/randomized delay and cover traffic are named follow-ups,
  see `docs/THREAT_MODEL.md` §3.1).
