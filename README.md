# UNLINK

A minimal CLI client for a mixnet-routed messenger.

**Current milestone: M5.** Real 3-hop Sphinx routing over local TCP with
**enforced per-hop mix delay** (M1; since M5 **exponential/Poisson** — each
hop's delay is sampled from Exp(mean `delay_ms`)), **constant-rate Poisson
cover traffic** (M5: relays emit dummy Sphinx packets, routed like real
packets, dropped at the exit — wire-indistinguishable and independent of
the token gate), reputation-gated admission with blind-signature tokens
(M2), a signed relay/gossip list verified by the client (M3), Layer-3
message-body encryption with the Olm Double Ratchet (M3, via `vodozemac`),
and the M4/M5 measurements + writeup (`docs/LATENCY.md`,
`docs/ANONYMITY_ANALYSIS.md`, `docs/SPAM_RESISTANCE.md`,
`docs/M4_SUMMARY.md`) are done. Still out of scope: real gossip
*propagation* (M5+), a separate directory authority, full per-mix queue
shaping / loop messages, transport obfuscation.

## Why Rust

The one production-grade, actively-maintained Sphinx mix-packet
implementation is Nymtech's [`sphinx-packet`](https://crates.io/crates/sphinx-packet)
crate (Apache-2.0, v0.7.0), and the Privacy Pass v1 blind-signature primitive
is [`blind-rsa-signatures`](https://crates.io/crates/blind-rsa-signatures)
(MIT, v0.17.2, RFC 9474). There is no maintained pure-TS equivalent of
either. Decisions + alternatives in
[`docs/LIBRARY_SELECTION.md`](docs/LIBRARY_SELECTION.md).

## Try it (3 relays on one machine)

```console
$ cargo build

# Terminal 1–3: run the mix path
$ unlink relay --start --port 7001 --key ~/.unlink/r1.key
$ unlink relay --start --port 7002 --key ~/.unlink/r2.key
$ unlink relay --start --port 7003 --key ~/.unlink/r3.key

# Terminal 4: get admission tokens and write the config
$ unlink token-issue --count 10

# Terminal 5: bob sets up his Layer-3 ratchet identity (prints identity + one-time key)
$ unlink ratchet-init --home ~/.unlink/bob
ratchet identity=<bob-id> one_time=<bob-otk>

# Terminal 4: write the config with the relay path and bob's ratchet keys
$ cat > ~/.unlink/config.toml <<'EOF'
[relays]
entry     = "127.0.0.1:7001"
middle    = "127.0.0.1:7002"
exit      = "127.0.0.1:7003"
delay_ms  = 10   # MEAN per-hop mix delay (ms, spec §3.2): each hop's delay
                 # is sampled from an exponential with this mean (Poisson
                 # mixing, M5); 0 = no delay, tunable per user

[peers.bob]
addr = "127.0.0.1:9001"   # bob's delivery address
id   = "<bob-id>"          # from bob's `unlink ratchet-init`
otk  = "<bob-otk>"         # from bob's `unlink ratchet-init`
EOF

# Terminal 4: build the signed gossip list from the live relays (M3)
$ unlink directory-fetch 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003

# Terminal 5: bob listens; Terminal 4: send through the mix
$ unlink listen 127.0.0.1:9001 --home ~/.unlink/bob
$ unlink send bob "hello through three relays"
```

Admission gate (drop token-less/expired/replayed traffic at the entry relay):
restart the entry relay with `--admit-key ~/.unlink/issuer.pub --epoch <n>`
where `<n>` matches the epoch used by `token-issue`.

`send` refuses to transmit unless every relay on the path appears in
`~/.unlink/relays.json` with a valid self-signature (spec §5.4/§8.5): run
`unlink directory-fetch` once per relay set, and re-run it if a relay
rotates its keys.

## CLI

| Command                              | Status |
|--------------------------------------|--------|
| `unlink keygen`                      | x25519 identity keypair (0600 file) |
| `unlink token-issue [--count N]`     | issue a blind-token batch (M2 dev tool) |
| `unlink directory-fetch <addr>...`   | assemble a verified signed relay list from live relays (M3) |
| `unlink send <peer> <msg>`           | ratchet-encrypt the body, spend one token, build a 3-hop Sphinx packet, verify signed list + handshake claims, send via entry relay |
| `unlink relay --start --port P`      | mix relay: unwrap-and-forward over TCP; `--admit-key`/`--epoch` enable the M2 gate; `--cover-rate N --network e,m,x` enable Poisson cover traffic (M5) |
| `unlink ratchet-init [--home]`       | create Layer-3 Olm account; print identity + one-time key to share with a peer (M3) |
| `unlink listen <addr:port> [--home]` | receive messages delivered by the exit relay, decrypting them with the Layer-3 ratchet |

All file-touching commands take `--home <dir>` (default `$UNLINK_HOME` or
`~/.unlink`); `send` also takes `--config <path>` and `--relays <path>`
(default `<home>/relays.json`).

## Project layout

```
src/
  main.rs       # clap CLI dispatch
  lib.rs        # module map
  client.rs     # keygen, path fetch, Sphinx packet build, send+proof, listen
  ratchet.rs    # Layer-3 Olm Double Ratchet: account + per-peer sessions (M3)
  relay.rs      # unwrap-and-forward loop + admission gate + signed identity claim + cover emitter
  mix.rs        # M5 timing mixing: exponential per-hop delay + Poisson cover scheduling
  directory.rs  # signed relay claims + gossip list verify (M3)
  credential.rs # blind-signature tokens: issuer / wallet / relay admission
  net.rs        # plain-TCP framing (transport obfuscation is M-later)
  config.rs     # client TOML config (relay path + peers, incl. Layer-3 keys)
tests/
  cli_smoke.rs        # CLI-level smoke tests
  m1_routing.rs       # 3 real relays: delivery + no relay sees sender & receiver + delay enforcement
  m2_admission.rs     # valid / replay / out-of-tokens / unlinkability over the wire
  m3_directory.rs     # signed list: valid routing + unsigned/tampered/forged rejection
  m4_ratchet.rs       # full bidirectional Double Ratchet session over the real path
  m5_load.rs          # concurrent token abuse: relay stays responsive, drops correct
  m6_mixing.rs        # Poisson delay on the wire + cover traffic vs. the admission gate (M5)
docs/
  LIBRARY_SELECTION.md    # sphinx-packet (§1) + blind-rsa-signatures (§2) + ed25519 (§4) + vodozemac (§5) + timing mixing (§6)
  THREAT_MODEL.md         # adversary model, credential guarantees, MVP non-goals
  LATENCY.md              # latency data + per-hop-delay tradeoff (M4, M5 updates)
  ANONYMITY_ANALYSIS.md   # anonymity-set analysis at tested configs (M4, M5 updates)
  SPAM_RESISTANCE.md      # token-gating spam-resistance argument (M4)
  M4_SUMMARY.md           # milestone summary: built / follow-ups / out-of-scope
.github/workflows/ci.yml # fmt + clippy + test
```

## Test

```console
$ cargo test          # crypto units, CLI smoke, routing + admission + directory + ratchet + load integration
$ cargo clippy --all-targets -- -D warnings
```

## Security

Read [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) first. Headline: Sphinx
defends against passive observers and single malicious relays (verified in
code, not assumed); blind tokens gate admission with unlinkable redemptions;
the Olm Double Ratchet protects message content with forward secrecy and
break-in recovery (M3); **global timing correlation is explicitly NOT
solved** (spec §9) and remains out of MVP scope.

## License

Apache-2.0.
