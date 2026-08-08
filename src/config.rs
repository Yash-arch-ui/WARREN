//! Client configuration: the hardcoded M1/M2 relay path and peer→delivery
//! address map. Directory/gossip discovery is out of scope for M1/M2, so the
//! client reads a small TOML file instead.
//!
//! ```toml
//! [relays]
//! entry  = "127.0.0.1:7001"
//! middle = "127.0.0.1:7002"
//! exit   = "127.0.0.1:7003"
//!
//! [peers]
//! bob = "127.0.0.1:9001"   # delivery address of the final relay's client
//! ```

use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub relays: Relays,
    #[serde(default)]
    pub peers: std::collections::HashMap<String, String>,
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

[peers]
bob = "127.0.0.1:9001"
"#;
        let cfg: Config = toml::from_str(raw).unwrap();
        assert_eq!(
            cfg.relays.path(),
            ["127.0.0.1:7001", "127.0.0.1:7002", "127.0.0.1:7003"]
        );
        assert_eq!(
            cfg.peers.get("bob").map(String::as_str),
            Some("127.0.0.1:9001")
        );
    }
}
