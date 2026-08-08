//! Client configuration: the relay path and peer→delivery address map, plus
//! each peer's Layer-3 identity keys (the manual/config'd Double Ratchet key
//! exchange — `docs/LIBRARY_SELECTION.md` §5). Path *selection* stays a small
//! TOML file (real gossip propagation is M5+); the trust anchor for those
//! addresses is the signed relay list (`directory::SignedRelayList`, verified
//! in `client::send`).
//!
//! ```toml
//! [relays]
//! entry  = "127.0.0.1:7001"
//! middle = "127.0.0.1:7002"
//! exit   = "127.0.0.1:7003"
//!
//! [peers.bob]
//! addr = "127.0.0.1:9001"   # delivery address of the final relay's client
//! id   = "ab12…"            # bob's Layer-3 identity key (hex) — from `unlink ratchet-init`
//! otk  = "cd34…"            # bob's Layer-3 one-time key (hex) — from `unlink ratchet-init`
//! ```

use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub relays: Relays,
    #[serde(default)]
    pub peers: std::collections::HashMap<String, Peer>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Relays {
    pub entry: String,
    pub middle: String,
    pub exit: String,
}

impl Relays {
    /// The full path in mix order (entry → exit).
    pub fn path(&self) -> [&str; 3] {
        [&self.entry, &self.middle, &self.exit]
    }
}

/// One message peer: delivery address + the Layer-3 key material needed to
/// open a Double Ratchet session with them (the manual/config'd exchange).
#[derive(Debug, Clone, Deserialize)]
pub struct Peer {
    /// Delivery address of the peer's listening client.
    pub addr: String,
    /// Peer's Layer-3 curve25519 identity key, hex-encoded (32 bytes).
    pub id: String,
    /// Peer's Layer-3 one-time key, hex-encoded (32 bytes).
    pub otk: String,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("cannot read config `{}`: {e}", path.display()))?;
        let cfg: Config = toml::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("cannot parse config `{}`: {e}", path.display()))?;
        Ok(cfg)
    }
}

/// Data dir: `$UNLINK_HOME` if set, else `~/.unlink`.
pub fn unlink_home() -> PathBuf {
    if let Ok(home) = std::env::var("UNLINK_HOME") {
        return PathBuf::from(home);
    }
    let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home_dir).join(".unlink")
}

/// Config path: `$UNLINK_CONFIG` if set, else `<home>/config.toml`.
pub fn config_path() -> PathBuf {
    if let Ok(cfg) = std::env::var("UNLINK_CONFIG") {
        return PathBuf::from(cfg);
    }
    unlink_home().join("config.toml")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_config() {
        let raw = r#"
[relays]
entry = "127.0.0.1:7001"
middle = "127.0.0.1:7002"
exit = "127.0.0.1:7003"

[peers.bob]
addr = "127.0.0.1:9001"
id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
otk = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
"#;
        let cfg: Config = toml::from_str(raw).unwrap();
        assert_eq!(
            cfg.relays.path(),
            ["127.0.0.1:7001", "127.0.0.1:7002", "127.0.0.1:7003"]
        );
        let bob = cfg.peers.get("bob").unwrap();
        assert_eq!(bob.addr, "127.0.0.1:9001");
        assert_eq!(bob.id.len(), 64);
        assert_eq!(bob.otk.len(), 64);
    }
}
