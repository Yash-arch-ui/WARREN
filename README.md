# UNLINK (Warren)

**A messaging system where no one — not even the people running the network — can tell who's talking to whom.**

> Track: Censorship Resistance

---

## The Problem

Signal and apps like it encrypt *what* you say. They do this well — nobody can read your messages in transit. But the servers running those apps still see *who you're contacting and when*, even though they can't read the content. That connection graph alone — not the message, just the metadata — is enough to identify an activist, a journalist's source, or a whistleblower. And because these apps run through one company's infrastructure, that metadata sits at a single point that can be subpoenaed, seized, or blocked outright, regardless of how good the encryption is.

**UNLINK removes that gap.** It hides not just *what* is said, but *who is talking to whom* — a property Signal cannot reach no matter how much its client-side encryption improves, because the limitation isn't cryptographic. It's architectural: one operator, one set of servers, one vantage point.

---

## How It Works

**In plain terms:** instead of your message going straight from you to the other person, it bounces through three separate relay computers first, wrapped in layers of encryption like a sealed envelope inside another sealed envelope inside another one. Each relay can only peel off one layer and see "send this to the next hop" — never both ends of the conversation. Nobody, including the people running the relays, ever knows both who sent a message and who received it.

To stop the network being flooded with spam — the usual failure mode for anonymous systems — senders spend a small anonymous token to send each message, earned by doing a bit of real computational work. This proves you're a legitimate sender without revealing who you are.

**Technical summary, for reviewers:**

| Layer | What it does |
|---|---|
| **Mix routing** | 3-hop Sphinx onion routing (entry → middle → exit). Each relay strips exactly one encryption layer and learns only the previous and next hop — never both ends. Verified in code, not assumed: tests confirm no single relay's logs ever contain both sender-side and receiver-side data. |
| **Content encryption** | Double Ratchet via `vodozemac` (Matrix's Olm implementation) — forward secrecy and break-in recovery, verified against the crate's actual guarantees, not its name. |
| **Anonymous admission** | Blind-signature tokens (RFC 9474 / Privacy Pass) gate message sending. Cross-redemption unlinkability verified in tests — a relay cannot correlate two messages spent from the same token batch. Bootstrapped via proof-of-work: minting a batch costs real compute, scaling attacker cost with attacker resources rather than requiring identity. |
| **Timing resistance** | Per-hop delay is Poisson-distributed (not fixed), plus real cover traffic — dummy packets indistinguishable from real ones on the wire, dropped only at the exit hop. Distribution shape and cover/real indistinguishability are both verified with statistical tests, not assumed. |
| **Relay trust** | The relay directory is signed by K-of-N independent keys (default 2-of-3), not a single operator — no one party controls routing integrity. |
| **Wire-level obfuscation** | Packets are wrapped in TLS-record-shaped framing so passive network observers see traffic that structurally resembles ordinary HTTPS rather than a distinctive custom protocol. |

**What this honestly does *not* solve** (stated plainly, not hidden): no mixnet at reasonable latency fully defeats a global adversary correlating traffic by timing — this raises the cost, it doesn't eliminate the risk. Proof-of-work bootstrapping raises the cost of Sybil attacks but scales with attacker compute, not a hard identity wall. Full details in `docs/THREAT_MODEL.md`.

---

## No Database — On Purpose

There is deliberately **no central database anywhere in this system** — not for messages, not for user accounts, not for the relay directory, not for anything. This isn't an oversight; it's a direct consequence of the threat model:

- **A database is a target.** Anything stored centrally can be subpoenaed, seized, or leaked. A messenger that hides metadata in transit but logs it to a database defeats its own purpose.
- **No accounts, no user table.** Identity here is a locally-held keypair, not a row in a database somewhere. There's nothing to breach because there's nothing centrally stored to breach.
- **The relay directory is signed data, not a database record.** Trust in the relay list comes from multiple independent cryptographic signatures (K-of-N), not from a row in a table controlled by one operator.
- **State lives on the client, not the server.** Wallet, ratchet sessions, and keys are stored locally on each user's own machine (`~/.warren/`) and nowhere else.

If this system used a central database, it would just be Signal again — a nicer metadata story on paper, but still one place an adversary could point at.

---

## Why This Isn't Deployed as a Normal Hosted Backend

The client/API layer (`warren serve`) is **intentionally loopback-only** — it binds to `127.0.0.1` and refuses to bind publicly. This is deliberate, not a limitation we ran out of time to fix:

- `warren serve` holds an **unlocked wallet of anonymous tokens** with no authentication layer. Exposing that publicly would mean anyone on the internet could spend your tokens or worse. A local-only daemon has no such exposure.
- More fundamentally: **a project whose entire thesis is "remove the single trusted operator" shouldn't turn around and ask you to trust a single hosted instance of itself.** Hosting the live backend centrally would be a quiet contradiction of the whole pitch.

**What actually is deployed:**
- **Railway** — the mix relay network itself (entry, middle, exit nodes). These are infrastructure, not the trust boundary — they never see both ends of a conversation, and are explicitly *meant* to be run by many independent operators over time, not just us.
- **Vercel** — the frontend UI, viewable in an illustrative/demo mode so anyone can see the interface without needing to run anything locally.

**The real, live, message-routing system runs locally** — anyone can run it themselves in a few minutes using the steps below, which is a stronger proof than a hosted demo link: it shows there's no hidden server-side magic, just the same code anyone can inspect and run.

---

## Quickstart — Run It Yourself

You'll need [Rust and Cargo](https://www.rust-lang.org/tools/install) installed. Then:

```bash
# 1. Clone and build
git clone <repo-url>
cd UNLINK
cargo build --release

# 2. Set up your local config (relay addresses, defaults)
./target/release/warren init

# 3. Start the three mix relays (run each in its own terminal, leave them running)
./target/release/warren relay --start --port 7001
./target/release/warren relay --start --port 7002
./target/release/warren relay --start --port 7003

# 4. Assemble the signed relay directory from the running relays
./target/release/warren directory-fetch 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003

# 5. Generate your identity keys for encrypted messaging
./target/release/warren ratchet-init
# → prints your identity/one-time keys; share these with a peer to exchange messages

# 6. Get a batch of anonymous sending tokens (instant, no proof-of-work, for local testing)
./target/release/warren token-issue --pow-bits 0

# 7. Send a real message through the live 3-hop mix network
./target/release/warren send <peer-name> "hello from the mix network"
# → prints the actual routing path: 127.0.0.1:7001 → 127.0.0.1:7002 → 127.0.0.1:7003
```

To receive messages, run `warren listen 127.0.0.1:<port>` and add the sender as a peer in your `~/.warren/config.toml` — see `docs/` for the full peer-setup walkthrough.

Optionally, run the frontend locally for the visual interface:
```bash
cd frontend
npm install
npm run dev
```

---

## Project Status

**Built and tested end-to-end:** 3-hop anonymous mix routing, Double Ratchet content encryption, anonymous spam-resistant admission tokens, Poisson-jittered delay with real cover traffic, multi-signer relay directory trust, and wire-level traffic disguising. All of this has been verified with a real automated test suite — not just claimed.

**Explicitly out of scope for this submission** (a deliberate hackathon scope decision, not something abandoned): group messaging, mobile clients, a full decentralized gossip/DHT directory (a smaller K-of-N signed list is used instead), a zk-SNARK-based reputation system (proof-of-work is used instead), and formal mathematical security proofs. Each of these is named explicitly in `docs/THREAT_MODEL.md` as real, buildable future work — not a gap we're pretending doesn't exist.

---

## Testing & Verification

The full test suite can be run with:
```bash
cargo test
```

For anyone who wants the real numbers behind the claims above, rather than taking them on faith:
- `docs/THREAT_MODEL.md` — what this system defends against, and what it honestly does not
- `docs/LATENCY.md` — measured end-to-end latency at multiple mixing configurations
- `docs/ANONYMITY_ANALYSIS.md` — what the anonymity set actually means for what's built
- `docs/SPAM_RESISTANCE.md` — the real, measured argument for how anonymous admission tokens resist abuse

---

## Why This Fits Censorship Resistance

Censorship isn't just blocked content — it's an adversary's ability to identify who's communicating and to detect and shut down the channel itself. UNLINK is built directly against both:

- **No single operator to compel.** No company, no server, no database to subpoena, seize, or order offline.
- **No metadata graph to hand over.** Even under full legal or technical pressure on a relay operator, there's no connection graph sitting anywhere to seize — it never existed in the first place.
- **No easy network fingerprint to block.** Traffic is disguised to resist casual DPI-based blocking, and relay trust is split across multiple independent signers rather than one.
- **No identity requirement that can be weaponized.** Spam resistance doesn't require anyone to prove who they are, so there's no identity layer for a censor to exploit or demand access to.
