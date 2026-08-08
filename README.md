# UNLINK

A minimal CLI client for a mixnet-routed messenger.

**Current milestone: M2.** Real 3-hop Sphinx routing over local TCP (M1) and
reputation-gated admission with blind-signature tokens (M2) are implemented
and tested. Still out of scope: directory/gossip relay discovery, Double
Ratchet content encryption, transport obfuscation, timing mixing.

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
$ cat > ~/.unlink/config.toml <<'EOF'
[relays]
entry  = "127.0.0.1:7001"
middle = "127.0.0.1:7002"
exit   = "127.0.0.1:7003"
[peers]
bob = "127.0.0.1:9001"
EOF

# Terminal 5: bob listens; Terminal 4: send through the mix
$ unlink listen 127.0.0.1:9001
$ unlink send bob "hello through three relays"
```

Admission gate (drop token-less/expired/replayed traffic at the entry relay):
restart the entry relay with `--admit-key ~/.unlink/issuer.pub --epoch <n>`
where `<n>` matches the epoch used by `token-issue`.

## CLI

| Command                              | Status |
|--------------------------------------|--------|
| `unlink keygen`                      | x25519 identity keypair (0600 file) |
| `unlink token-issue [--count N]`     | issue a blind-token batch (M2 dev tool) |
| `unlink send <peer> <msg>`           | spend one token, build a 3-hop Sphinx packet, send via entry relay |
| `unlink relay --start --port P`      | mix relay: unwrap-and-forward over TCP; `--admit-key`/`--epoch` enable the M2 gate |
| `unlink listen <addr:port>`          | receive messages delivered by the exit relay |

All file-touching commands take `--home <dir>` (default `$UNLINK_HOME` or
`~/.unlink`); `send` also takes `--config <path>`.

## Project layout

```
src/
  main.rs       # clap CLI dispatch
  lib.rs        # module map
  client.rs     # keygen, path fetch, Sphinx packet build, send+proof, listen
  relay.rs      # unwrap-and-forward loop + admission gate
  directory.rs  # signed relay list fetch + verify (stub; M-later)
  credential.rs # blind-signature tokens: issuer / wallet / relay admission
  net.rs        # plain-TCP framing (transport obfuscation is M-later)
  config.rs     # client TOML config (relay path + peers)
tests/
  cli_smoke.rs        # CLI-level smoke tests
  m1_routing.rs       # 3 real relays: delivery + no relay sees sender & receiver
  m2_admission.rs     # valid / replay / out-of-tokens / unlinkability over the wire
docs/
  LIBRARY_SELECTION.md  # sphinx-packet (§1) + blind-rsa-signatures (§2) decisions
  THREAT_MODEL.md       # adversary model, credential guarantees, MVP non-goals
.github/workflows/ci.yml # fmt + clippy + test
```

## Test

```console
$ cargo test          # 29 tests: crypto units, CLI smoke, 3-hop + admission integration
$ cargo clippy --all-targets -- -D warnings
```

## Security

Read [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) first. Headline: Sphinx
defends against passive observers and single malicious relays (verified in
code, not assumed); blind tokens gate admission with unlinkable redemptions;
**global timing correlation is explicitly NOT solved** (spec §9) and remains
out of MVP scope.

## License

Apache-2.0.
