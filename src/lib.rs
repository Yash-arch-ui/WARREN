//! UNLINK — a minimal CLI client for a mixnet-routed messenger.
//!
//! Module map (see `docs/THREAT_MODEL.md` for the threat model these map to):
//! - [`client`]     — identity keygen, path selection, packet build/send, listen
//! - [`relay`]      — Sphinx unwrap-and-forward loop + admission gate + signed identity claim
//! - [`directory`]  — signed relay claims + gossip list verify (M3) + K-of-N directory attestations (M7)
//! - [`credential`] — blind-signature admission tokens (issuer/wallet/relay)
//! - [`ratchet`]    — Layer-3 message-body encryption: Olm Double Ratchet (M3)
//! - [`mix`]        — mix timing (M5): exponential per-hop delay + cover traffic
//! - [`pow`]        — SHA-256 proof-of-work for token-batch bootstrap (M6)
//! - [`net`]        — plain-TCP framing with TLS-record-layer wire dressing (M8)
//! - [`config`]     — client TOML config (relay path, peers, M7 directory policy)

pub mod client;
pub mod config;
pub mod credential;
pub mod directory;
pub mod mix;
pub mod net;
pub mod pow;
pub mod ratchet;
pub mod relay;
