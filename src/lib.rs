//! UNLINK — a minimal CLI client for a mixnet-routed messenger.
//!
//! Module map (see `docs/THREAT_MODEL.md` for the threat model these map to):
//! - [`client`]     — identity keygen, path selection, packet build/send, listen
//! - [`relay`]      — Sphinx unwrap-and-forward loop + admission gate + signed identity claim
//! - [`directory`]  — signed relay claims + gossip list verify (M3; see §8.5)
//! - [`credential`] — blind-signature admission tokens (issuer/wallet/relay)
//! - [`ratchet`]    — Layer-3 message-body encryption: Olm Double Ratchet (M3)
//! - [`net`]        — plain-TCP framing (transport obfuscation is M-later)
//! - [`config`]     — client TOML config (relay path + peers)

pub mod client;
pub mod config;
pub mod credential;
pub mod directory;
pub mod net;
pub mod ratchet;
pub mod relay;
