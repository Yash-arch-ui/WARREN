# Handoff — Warren mixnet + web UI

Read this before touching the repo. Written for a fresh Claude session with zero prior context.

## What this repo is

`WARREN` — Rust mixnet crate (Sphinx routing, Double Ratchet, blind-signature admission tokens, K-of-N relay directory), renamed from `unlink`. Now also has `frontend/` — a Next.js web UI cloned from a different project (`alpha-oversight`, a trade-surveillance dashboard) and remapped to Warren's domain.

Two commits landed on `main` at `github.com/Yash-arch-ui/WARREN` (pushed):
1. `unlink` → `warren` rename + new `src/api.rs` (`warren serve`)
2. `frontend/` — the web UI

## How we got here (for context, not action)

Original ask: connect an existing frontend (alpha-oversight) to this backend, swapping its data layer. Audit showed **zero domain overlap** — alpha-oversight is a surveillance dashboard (cases/rules/verdicts), this crate is a messenger. Redirected to: route alpha-oversight's internal message bus (`Band`) over the mixnet — built most of a `WarrenBand` adapter, then user pivoted again: **clone the frontend's UI/design system into WARREN itself**, remapped to mixnet concepts, since Warren had no frontend of its own. The `WarrenBand` adapter work was reverted from alpha-oversight (that repo is untouched). Everything below is the current, final direction.

## What's done and verified

### Backend (`src/`)
- Full rename `unlink` → `warren`: crate name, bin, `WARREN_HOME`/`WARREN_CONFIG` env vars, `~/.warren` data dir. `unlinkability`/`unlinkable` (crypto terms) deliberately preserved.
- New `src/api.rs` — `warren serve` subcommand: loopback-only HTTP + SSE daemon over the existing tested core. No protocol logic reimplemented; it only calls into `client`/`ratchet`/`credential`/`directory`.
  - Endpoints: `/api/v1/agent/me`, `/peers`, `/status`, `/relays`, `/stats`, `/messages` (GET list + POST send), `/messages/{id}`, `/events`, `/stream` (SSE), `/ratchet/init`, `/tokens/issue`, plus Band-shaped aliases (`/agent/chats/{room}/messages/...`).
  - Chunks messages > ~305 body-bytes across multiple Sphinx packets (`packet_payload_bytes` in `/status` — this is the real per-packet budget, NOT `max_msg_len`, because bodies travel hex-encoded).
  - Reorder buffer for mix-delayed packets (`REORDER_WINDOW` = 1.5s), journal + SSE event hub for the UI.
  - Binds `127.0.0.1` only — hard refusal on any other bind address (holds unlocked wallet/ratchet, no auth).
- **89 tests passing**, 1 ignored, `cargo fmt`/`clippy -D warnings` clean.
- **Known pre-existing flake, not introduced by this work**: `tests/m5_load.rs::concurrent_abuse_rejected_and_relay_stays_responsive` fails ~1/3 runs — it asserts strict FIFO arrival but Poisson mix delays (working as designed) reorder packets. Real test bug, left alone.

### Frontend (`frontend/`)
- Next.js 16 app cloned from alpha-oversight, fully remapped:
  - `lib/types.ts`, `lib/api/client.ts`, `lib/api/queries.ts`, `lib/eventsource/adapter.ts`, `lib/store/useTraceStore.ts`, `lib/desk/{contract,model,controller,nodes}.ts` — all rewritten against Warren's wire contract.
  - Topology graph: directory → issuer → sender → entry → middle → exit → recipient (was: 11-node agent pipeline).
  - New components: `Composer.tsx` (send messages, shows real packet/token cost), `EndpointCards.tsx`, `RelayDirectoryPanel.tsx`, `WireTimeline.tsx`, `PacketDrawer.tsx` (shows verified path on sent messages, explicitly empty on received — that's the anonymity property, not a bug).
  - Landing page + desk UI copy rewritten for mixnet domain (hero, FAQ, feature cards, mock desk art, nonagon diagram — `BandNonagon.tsx` → `PathNonagon.tsx`).
  - 35 tests passing, zero TypeScript errors, `npm run build` succeeds.
- **Verified end-to-end for real**: 3 live relays + 2 `warren serve` daemons, message sent from the actual browser UI, crossed the real mixnet, arrived on the second node's desk via live SSE. Screenshot exists in that session's scratchpad (not preserved here). 10/10 integrity checks passed in headless proof run — see "how to reproduce" below.
- Two real bugs found and fixed during that live run:
  1. Composer's packet-count estimate was wrong (assumed body travels raw; it's hex-encoded, so real budget is ~half). Fixed by daemon reporting `packet_payload_bytes` in `/status`, composer uses it.
  2. Framer Motion crash: 3-keyframe `scale` animation used a spring transition (only 2-keyframe springs supported). Fixed with an eased tween.

## What's NOT done

**`frontend/app/how-it-works/` and `frontend/components/how-it-works/*`, `frontend/components/desk/showcase/*`, `frontend/content/legal/*`** — roughly 4,200+ lines still describe alpha-oversight (market manipulation, adversarial red-team agents, verdicts, compliance). It **builds and typechecks fine**, it's just the wrong narrative. This is prose-rewriting work, not mechanical — needs someone (or a session) to actually write new copy for:
- `/how-it-works` page and all its sections (`EvasionStory.tsx`, `StorySections.tsx`, `PipelineFlow.tsx`, `AgentRoster.tsx`, diagram components)
- Desk showcase components (`DeskShowcaseHero.tsx`, `DataFlow.tsx`, `HighImpact.tsx`, `RunningItLive.tsx`, `ServerSurface.tsx`)
- `content/legal/privacy.ts` and `terms.ts` (currently alpha-oversight's legal text)

Tracked as task #9 in the session that did this work: "Rewrite /how-it-works + desk showcase + legal copy."

**11 ESLint errors** — inherited from the original alpha-oversight codebase (verified `HiwHeader.tsx` etc. are byte-identical to source), not introduced here. Not urgent, but real.

**Nothing is committed beyond the two pushed commits.** No `.env` files exist anywhere in the repo (checked before push).

## Deploy status

Pushed to GitHub (`Yash-arch-ui/WARREN`, `main`). Not deployed anywhere yet. Deploy guidance already given to the user:
- **Railway**: run `warren relay` instances publicly (3 needed for entry/middle/exit — no secrets, safe to expose). Do **not** expose `warren serve` publicly — it's loopback-only by design (unlocked wallet + no auth). It's meant to run on each user's own machine.
- **Vercel**: deploy `frontend/` (root dir = `frontend/`). `NEXT_PUBLIC_API_BASE` has to point at `http://127.0.0.1:<port>` — a hosted frontend can only work if each visitor runs their own local `warren serve` and points their browser at localhost. This is **not** a normal SaaS deploy shape; flagged to the user already.
- If the user wants a real public product (no per-user local daemon), that needs an auth layer on `warren serve` or a multi-tenant redesign — out of scope of what's built.

## How to reproduce the end-to-end proof

```bash
cargo build --release
# bring up 3 relays (entry gets --admit-key, middle/exit do not — gate is
# consumed at entry, gating downstream relays drops every legit packet)
# bring up two `warren serve` daemons (alice :8801, bob :9301 deliver;
#   bob :8802, :9302 deliver), cross-configured [peers] in each other's TOML
# POST http://127.0.0.1:8801/api/v1/messages {"peer":"bob","content":"..."}
# GET  http://127.0.0.1:8802/api/v1/messages  -> should show DELIVERED, hops: []
```

Full working harness (relay spawn, key exchange, directory-fetch, assertions) existed as a throwaway script in a previous session's scratchpad — not committed to the repo. Recreate from `tests/m9_serve.rs` if needed, which exercises the same path in-process.

## Quick orientation for a new session

- `src/api.rs` — read this first for the backend surface. Doc comment at top explains the design.
- `frontend/lib/desk/contract.ts` — the frozen seam every UI component reads through. Read this before touching any desk component.
- `frontend/lib/types.ts` — wire contract, mirrors `src/api.rs` JSON verbatim.
- Rename is repo-wide; `grep -ri unlink` should return nothing except `unlinkability`/`unlinkable`.
