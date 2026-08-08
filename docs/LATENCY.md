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
- **Harness:** `tests/latency_measure.rs` (ignored by default — run with
  `cargo test --release --test latency_measure -- --ignored --nocapture`).
- **Environment:** release build, single Linux machine, all three relays +
  sender + receiver on `127.0.0.1`; 30 samples, 5 ms inter-message gap.
  No artificial network delay — this is loopback, i.e. the floor for the
  protocol's per-hop overhead on this hardware.

## Raw samples (run 2026-08-08, release build)

| Sample | t (ms) |
|--------|--------|
| 0  | 2.02 |
| 1  | 2.35 |
| 2  | 2.95 |
| 3  | 3.01 |
| 4  | 3.28 |
| 5  | 3.34 |
| 6  | 3.59 |
| 7  | 3.76 |
| 8  | 3.79 |
| 9  | 4.01 |
| 10 | 4.55 |
| 11 | 4.69 |
| 12 | 4.73 |
| 13 | 4.81 |
| 14 | 4.88 |
| 15 | 4.89 |
| 16 | 4.99 |
| 17 | 5.00 |
| 18 | 5.04 |
| 19 | 5.27 |
| 20 | 5.35 |
| 21 | 5.61 |
| 22 | 5.72 |
| 23 | 6.04 |
| 24 | 6.16 |
| 25 | 6.49 |
| 26 | 6.85 |
| 27 | 6.89 |
| 28 | 7.63 |
| 29 | 9.32 |

## Summary line (raw)

```
summary  min_ms=2.02  mean_ms=4.90  p50_ms=4.89  p95_ms=7.63  max_ms=9.32
```

## Notes for M4

- Raw numbers only here; no interpretation, comparison, or claims yet.
- The sender's identity key used in the run:
  `fb3859afcd895079648d057e33768db46985de24d6f33e8f6d1207536ff4f103`.
- Caveats recorded so M4 analysis can weight them: loopback only, single
  machine, no real network RTT, no contention, release build.
