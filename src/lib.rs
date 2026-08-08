//! UNLINK — a minimal CLI client for a mixnet-routed messenger.
//!
//! Module map (see `docs/THREAT_MODEL.md` for the threat model these map to):
//! - [`client`]     — identity keygen, path selection, packet build/send, listen
//! - [`relay`]      — Sphinx unwrap-and-forward loop + admission gate
//! - [`directory`]  — signed relay list fetch + verify (stub; M-later)
//! - [`credential`] — blind-signature admission tokens (issuer/wallet/relay)
//! - [`net`]        — plain-TCP framing (transport obfuscation is M-later)
//! - [`config`]     — client TOML config (relay path + peers)

pub mod client;
pub mod config;
pub mod credential;
pub mod directory;
pub mod net;
pub mod relay;
