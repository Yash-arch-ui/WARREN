# WARREN

A minimal CLI client for a mixnet-routed messenger.

**Current milestone: M8.** Real 3-hop Sphinx routing over local TCP with
**enforced per-hop mix delay** (M1; since M5 **exponential/Poisson** — each
hop's delay is sampled from Exp(mean `delay_ms`)), **constant-rate Poisson
cover traffic** (M5: relays emit dummy Sphinx packets, routed like real
packets, dropped at the exit — wire-indistinguishable and independent of
the token gate), reputation-gated admission with blind-signature tokens
(M2), **proof-of-work token-batch bootstrap** (M6: the issuer grants one
batch per (client, epoch) only after a tunable PoW solve, `--pow-bits` —
the spec §4/§9 answer to who deserves a batch), a signed relay/gossip list
verified by the client (M3) with a **K-of-N multi-signer directory** (M7:
N independent directory keys, default 3, and a client-side threshold K,
default 2 — a list is accepted only when ≥K of them attest it, so no
single key can steer routing), Layer-3 message-body encryption with the
Olm Double Ratchet (M3, via `vodozemac`), **TLS-record-layer wire
dressing** (M8: every frame rides in a TLS 1.2 application-data record
shell — defeats naive DPI shape-fingerprinting; not a real TLS session,
so no claim against active probing), and the M4–M6 measurements + writeup
(`docs/LATENCY.md`, `docs/ANONYMITY_ANALYSIS.md`,
`docs/SPAM_RESISTANCE.md`, `docs/M4_SUMMARY.md`) are done. Still out of
scope: real gossip/DHT *propagation* and per-operator path caps (the
K-of-N directory is deliberately a fixed small N — see
`docs/THREAT_MODEL.md` §6), full per-mix queue shaping / loop messages,
pluggable-transport-grade obfuscation (obfs4-equivalent), memory-hard PoW
/ reputation bootstrap (the M6 PoW is an honest cost floor, not a Sybil
wall — `docs/SPAM_RESISTANCE.md` §3.1).

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
$ warren relay --start --port 7001 --key ~/.warren/r1.key
$ warren relay --start --port 7002 --key ~/.warren/r2.key
$ warren relay --start --port 7003 --key ~/.warren/r3.key

# Terminal 4: get admission tokens and write the config
# (M6: token-issue mines a proof of work; --pow-bits N tunes it, 0 disables)
$ warren token-issue --count 10

# Terminal 5: bob sets up his Layer-3 ratchet identity (prints identity + one-time key)
$ warren ratchet-init --home ~/.warren/bob
ratchet identity=<bob-id> one_time=<bob-otk>

# Terminal 4: write the config with the relay path and bob's ratchet keys
$ cat > ~/.warren/config.toml <<'EOF'
[relays]
entry     = "127.0.0.1:7001"
middle    = "127.0.0.1:7002"
exit      = "127.0.0.1:7003"
delay_ms  = 10   # MEAN per-hop mix delay (ms, spec §3.2): each hop's delay
                 # is sampled from an exponential with this mean (Poisson
                 # mixing, M5); 0 = no delay, tunable per user

[peers.bob]
addr = "127.0.0.1:9001"   # bob's delivery address
id   = "<bob-id>"          # from bob's `warren ratchet-init`
otk  = "<bob-otk>"         # from bob's `warren ratchet-init`
EOF

# Terminal 4: build the signed gossip list from the live relays (M3)
$ warren directory-fetch 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003

# Terminal 5: bob listens; Terminal 4: send through the mix
$ warren listen 127.0.0.1:9001 --home ~/.warren/bob
$ warren send bob "hello through three relays"
```

Admission gate (drop token-less/expired/replayed traffic at the entry relay):
restart the entry relay with `--admit-key ~/.warren/issuer.pub --epoch <n>`
where `<n>` matches the epoch used by `token-issue`.

`send` refuses to transmit unless every relay on the path appears in
`~/.warren/relays.json` with a valid self-signature (spec §5.4/§8.5): run
`warren directory-fetch` once per relay set, and re-run it if a relay
rotates its keys.

K-of-N directory (M7): with a `[directory]` section in `config.toml`
(`keys = ["<hex ed25519 pubkey>", …]`, `threshold = 2`), `send` also
refuses any list not attested by at least `threshold` of the `keys`. Attest
a list at fetch time with `warren directory-fetch … --dir-key
<32-byte-key-file>`, once per directory key.

## CLI

| Command                              | Status |
|--------------------------------------|--------|
| `warren keygen`                      | x25519 identity keypair (0600 file) |
| `warren token-issue [--count N] [--pow-bits B] [--client-id ID]` | issue a blind-token batch, PoW-gated (M2+M6) |
| `warren directory-fetch <addr>... [--dir-key <file>]...` | assemble a verified signed relay list from live relays; each `--dir-key` attests it with one of the N directory keys (M3 + M7) |
| `warren send <peer> <msg>`           | ratchet-encrypt the body, spend one token, build a 3-hop Sphinx packet, verify signed list + handshake claims, send via entry relay |
| `warren relay --start --port P`      | mix relay: unwrap-and-forward over TCP; `--admit-key`/`--epoch` enable the M2 gate; `--cover-rate N --network e,m,x` enable Poisson cover traffic (M5); `--bind 0.0.0.0`/`--advertise host:port` make a relay publicly reachable (deployment) |
| `warren ratchet-init [--home]`       | create Layer-3 Olm account; print identity + one-time key to share with a peer (M3) |
| `warren listen <addr:port> [--home]` | receive messages delivered by the exit relay, decrypting them with the Layer-3 ratchet |
| `warren serve [--port] [--listen]`   | loopback HTTP API over this client, so a local process can use the mixnet as a message transport (M9) |

### `warren serve`

A local process can drive the mixnet over HTTP instead of the CLI:

```
$ warren serve --port 8801 --listen 127.0.0.1:9001 --home ~/.warren/rnd
```

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/v1/agent/me` | this client's ratchet identity, delivery address, token count |
| `GET`  | `/api/v1/agent/peers` | peers from `[peers]` in the config |
| `GET`  | `/api/v1/status` | relay path, directory entries/attestations/threshold, tokens |
| `POST` | `/api/v1/agent/chats/{room}/messages` | `{"content":…,"peer":…}` → `{"data":{"id":…}}` |
| `GET`  | `/api/v1/agent/chats/{room}/messages/next` | next delivered message, or `204` when empty |
| `POST` | `/api/v1/agent/chats/{room}/messages/{id}/processing`, `…/processed` | ack a delivered message |
| `POST` | `/api/v1/ratchet/init`, `/api/v1/tokens/issue` | setup, mirroring the matching subcommands |

Both the API port and `--listen` (where the exit relay delivers) are **loopback
only** — this surface holds an unlocked wallet and ratchet account and has no
authentication of its own.

Two properties are worth knowing before building on it. A message larger than
`MAX_MSG_LEN` (~705 B) is split across several Sphinx packets, and **each
packet spends one admission token**. And because per-hop mix delays reorder
packets by design, delivery order is restored best-effort: a message waits up
to `REORDER_WINDOW` (1.5 s) for an earlier sibling before being released out of
order rather than stalling behind it.

All file-touching commands take `--home <dir>` (default `$WARREN_HOME` or
`~/.warren`); `send` also takes `--config <path>` and `--relays <path>`
(default `<home>/relays.json`).

> **Renamed from `unlink`.** The binary, crate, data dir and environment
> variables all changed: `~/.unlink` → `~/.warren`, `UNLINK_HOME` →
> `WARREN_HOME`, `UNLINK_CONFIG` → `WARREN_CONFIG`. An existing data dir is
> not migrated automatically — move it, or point `WARREN_HOME` at it.

## Project layout

```
src/
  main.rs       # clap CLI dispatch
  lib.rs        # module map
  client.rs     # keygen, path fetch, Sphinx packet build, send+proof, listen
  ratchet.rs    # Layer-3 Olm Double Ratchet: account + per-peer sessions (M3)
  relay.rs      # unwrap-and-forward loop + admission gate + signed identity claim + cover emitter
  mix.rs        # M5 timing mixing: exponential per-hop delay + Poisson cover scheduling
  pow.rs        # M6 proof-of-work: challenge binding, mining, verification (SHA-256)
  directory.rs  # signed relay claims + gossip list verify (M3) + K-of-N directory attestations (M7)
  credential.rs # blind-signature tokens: issuer / wallet / relay admission + PoW-gated bootstrap
  net.rs        # plain-TCP framing with TLS-record-layer wire dressing (M8)
  config.rs     # client TOML config (relay path + peers, incl. Layer-3 keys)
tests/
  cli_smoke.rs        # CLI-level smoke tests
  m1_routing.rs       # 3 real relays: delivery + no relay sees sender & receiver + delay enforcement
  m2_admission.rs     # valid / replay / out-of-tokens / unlinkability over the wire
  m3_directory.rs     # signed list: valid routing + unsigned/tampered/forged rejection
  m4_ratchet.rs       # full bidirectional Double Ratchet session over the real path
  m5_load.rs          # concurrent token abuse: relay stays responsive, drops correct
  m6_mixing.rs        # Poisson delay on the wire + cover traffic vs. the admission gate (M5)
  m7_bootstrap.rs     # PoW bootstrap: enforcement, linear attacker scaling, legit-user usability (M6)
  m8_directory.rs     # K-of-N directory: 1-of-3 refused, 2-of-3 routes, forged rejected (M7)
docs/
  LIBRARY_SELECTION.md    # sphinx-packet (§1) + blind-rsa-signatures (§2) + ed25519 (§4) + vodozemac (§5) + timing mixing (§6) + PoW (§7)
  THREAT_MODEL.md         # adversary model, credential guarantees, MVP non-goals
  LATENCY.md              # latency data + per-hop-delay tradeoff (M4, M5 updates)
  ANONYMITY_ANALYSIS.md   # anonymity-set analysis at tested configs (M4, M5 updates)
  SPAM_RESISTANCE.md      # token-gating + PoW-bootstrap spam-resistance argument (M4, M6 updates)
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
break-in recovery (M3); PoW-gated batch bootstrap puts a computational
cost floor on mass identity-minting (M6 — an honest cost floor, not a
Sybil wall); M8 wire dressing raises the cost of naive DPI
shape-fingerprinting (bounded — record-shaped, not a real TLS session);
**global timing correlation is explicitly NOT solved** (spec §9) and
remains out of MVP scope.

## License

Apache-2.0.
