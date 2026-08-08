//! Client configuration: the relay path and peer→delivery address map, plus
//! each peer's Layer-3 identity keys (the manual/config'd Double Ratchet key
//! exchange — `docs/LIBRARY_SELECTION.md` §5). Path *selection* stays a small
//! TOML file (real gossip propagation is M5+); the trust anchor for those
//! addresses is the signed relay list (`directory::SignedRelayList`, verified
//! in `client::send`).
//!
//! ```toml
//! [relays]
//! entry    = "127.0.0.1:7001"
//! middle   = "127.0.0.1:7002"
//! exit     = "127.0.0.1:7003"
//! delay_ms = 10   # MEAN per-hop mix delay (ms): each hop's delay is sampled
//!                 # from an exponential with this mean (Poisson mixing, §3.2)
//!
//! [peers.bob]
//! addr = "127.0.0.1:9001"   # delivery address of the final relay's client
//! id   = "ab12…"            # bob's Layer-3 identity key (hex) — from `warren ratchet-init`
//! otk  = "cd34…"            # bob's Layer-3 one-time key (hex) — from `warren ratchet-init`
//! ```

use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub relays: Relays,
    #[serde(default)]
    pub peers: std::collections::HashMap<String, Peer>,
    /// M7 K-of-N directory trust policy. Empty keys = no policy (M3 TOFU
    /// mode); with keys set, a relay list is only accepted if attested by at
    /// least `threshold` of them.
    #[serde(default)]
    pub directory: Directory,
}

/// The client's directory trust policy (M7): N independent directory public
/// keys and the K threshold. See `directory::SignedRelayList::verify_directory`
/// for the enforcement semantics and `docs/THREAT_MODEL.md` §1 for the trust
/// note (fixed small N, not decentralized gossip/DHT).
#[derive(Debug, Clone, Deserialize)]
pub struct Directory {
    /// Hex-encoded ed25519 public keys of the N directory signers.
    #[serde(default)]
    pub keys: Vec<String>,
    /// Minimum number of distinct configured keys that must attest a relay
    /// list (K-of-N). Defaults to 2.
    #[serde(default = "default_dir_threshold")]
    pub threshold: usize,
}

fn default_dir_threshold() -> usize {
    crate::directory::DEFAULT_DIR_THRESHOLD
}

impl Default for Directory {
    /// Unconfigured policy: no keys, but the threshold still defaults to K
    /// (2) so a later `[directory]` section that sets keys only has to set
    /// the threshold explicitly if it wants something other than K=2.
    fn default() -> Self {
        Self {
            keys: Vec::new(),
            threshold: crate::directory::DEFAULT_DIR_THRESHOLD,
        }
    }
}

impl Directory {
    pub fn is_configured(&self) -> bool {
        !self.keys.is_empty()
    }

    /// Decode the configured hex pubkeys into raw 32-byte ed25519 keys.
    pub fn parsed_keys(&self) -> Result<Vec<[u8; 32]>> {
        self.keys
            .iter()
            .map(|k| {
                let bytes = hex::decode(k)
                    .map_err(|e| anyhow::anyhow!("bad directory key hex `{k}`: {e}"))?;
                bytes
                    .try_into()
                    .map_err(|_| anyhow::anyhow!("directory key `{k}` must decode to 32 bytes"))
            })
            .collect()
    }
}

/// Default **mean** per-hop mix delay in milliseconds (spec §3.2's
/// "randomized per-hop delay, tunable per user"). Each hop's actual delay is
/// sampled from an exponential distribution with this mean (Poisson mixing,
/// M5 — `mix::exp_delay_ms`), so it is a *distribution*, not a constant
/// offset.
pub const DEFAULT_DELAY_MS: u64 = 10;

#[derive(Debug, Clone, Deserialize)]
pub struct Relays {
    pub entry: String,
    pub middle: String,
    pub exit: String,
    /// **Mean** per-hop delay in ms, carried in the Sphinx header and
    /// enforced by each relay (sleep before forwarding). Each hop's actual
    /// delay is sampled from an exponential distribution with this mean
    /// (Poisson mixing, spec §3.2 — `mix::exp_delay_ms`), so it is a
    /// distribution, not a constant. Set to 0 for minimal latency or raise
    /// it for more mixing; the latency/anonymity tradeoff is measured in
    /// `docs/LATENCY.md`.
    #[serde(default = "default_delay_ms")]
    pub delay_ms: u64,
}

fn default_delay_ms() -> u64 {
    DEFAULT_DELAY_MS
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

/// Data dir: `$WARREN_HOME` if set, else `~/.warren`.
pub fn warren_home() -> PathBuf {
    if let Ok(home) = std::env::var("WARREN_HOME") {
        return PathBuf::from(home);
    }
    let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    PathBuf::from(home_dir).join(".warren")
}

/// Config path: `$WARREN_CONFIG` if set, else `<home>/config.toml`.
pub fn config_path() -> PathBuf {
    if let Ok(cfg) = std::env::var("WARREN_CONFIG") {
        return PathBuf::from(cfg);
    }
    warren_home().join("config.toml")
}

/// Default client config written by `warren init`: the three localhost
/// relays from the README's single-machine "Try it" walkthrough. `peers` and
/// the M7 `[directory]` policy are deliberately left unconfigured — that is
/// TOFU mode (`Directory::is_configured()` is false), which matches the
/// README flow where `[peers.<name>]` needs the peer's real `ratchet-init`
/// keys and K-of-N directory keys are an opt-in (M7).
pub const DEFAULT_CONFIG_TOML: &str = r#"# WARREN client config — generated by `warren init`.
# Loaded from this file; point elsewhere with $WARREN_CONFIG or --config.

# The 3-hop mix path (entry → middle → exit). These are the addresses of
# relays you run with `warren relay --start --port N`; on one machine all
# three live on localhost. `send` additionally requires each relay to appear,
# self-signed, in <home>/relays.json — build that with:
#   warren directory-fetch 127.0.0.1:7001 127.0.0.1:7002 127.0.0.1:7003
[relays]
entry    = "127.0.0.1:7001"
middle   = "127.0.0.1:7002"
exit     = "127.0.0.1:7003"
delay_ms = 10   # MEAN per-hop mix delay (ms): each hop is sampled from an
                # exponential with this mean (Poisson mixing); 0 = no delay

# Peers you can message (add one block per peer). `addr` is the peer's
# delivery address — where they run `warren listen <addr>`; `id`/`otk` are
# their Layer-3 ratchet keys from `warren ratchet-init`.
# [peers.bob]
# addr = "127.0.0.1:9001"
# id   = "<bob's ratchet identity, 64 hex chars>"
# otk  = "<bob's one-time key, 64 hex chars>"

# M7 K-of-N directory trust policy (optional). Unconfigured (below) = TOFU
# mode: any validly self-signed relay list is accepted. With `keys` set, a
# list is accepted only when >= `threshold` of these ed25519 pubkeys attested
# it — attest at fetch time with `warren directory-fetch ... --dir-key <file>`.
# [directory]
# keys      = ["<hex ed25519 directory pubkey>"]
# threshold = 2
"#;

/// `warren init`: write the default config to `path` (creating parent dirs).
/// Refuses to clobber an existing file unless `force` is set — an existing
/// config is loaded as-is by [`Config::load`], and silently overwriting it
/// would drop the operator's peers/directory policy.
pub fn init(path: &Path, force: bool) -> Result<PathBuf> {
    if path.exists() && !force {
        anyhow::bail!(
            "config already exists at {} (use --force to overwrite)",
            path.display()
        );
    }
    crate::credential::write_private(path, DEFAULT_CONFIG_TOML.as_bytes())?;
    Ok(path.to_path_buf())
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
        assert_eq!(
            cfg.relays.delay_ms, DEFAULT_DELAY_MS,
            "delay_ms must default when omitted (backward compatible)"
        );
        let bob = cfg.peers.get("bob").unwrap();
        assert_eq!(bob.addr, "127.0.0.1:9001");
        assert_eq!(bob.id.len(), 64);
        assert_eq!(bob.otk.len(), 64);
    }

    #[test]
    fn delay_ms_is_tunable() {
        let raw = r#"
[relays]
entry = "127.0.0.1:7001"
middle = "127.0.0.1:7002"
exit = "127.0.0.1:7003"
delay_ms = 250
"#;
        let cfg: Config = toml::from_str(raw).unwrap();
        assert_eq!(cfg.relays.delay_ms, 250);
    }

    #[test]
    fn directory_policy_parses_and_defaults() {
        // No [directory] section → unconfigured TOFU mode (backward compat).
        let raw = r#"
[relays]
entry = "127.0.0.1:7001"
middle = "127.0.0.1:7002"
exit = "127.0.0.1:7003"
"#;
        let cfg: Config = toml::from_str(raw).unwrap();
        assert!(!cfg.directory.is_configured());
        assert_eq!(cfg.directory.threshold, 2, "threshold defaults to 2");

        // Configured with 3 keys + threshold 2 (M7).
        let raw = r#"
[relays]
entry = "127.0.0.1:7001"
middle = "127.0.0.1:7002"
exit = "127.0.0.1:7003"

[directory]
threshold = 2
keys = [
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
]
"#;
        let cfg: Config = toml::from_str(raw).unwrap();
        assert!(cfg.directory.is_configured());
        let parsed = cfg.directory.parsed_keys().unwrap();
        assert_eq!(parsed.len(), 3);
        assert_eq!(cfg.directory.threshold, 2);

        // Bad hex / wrong length keys are rejected at parse time.
        let mut bad = cfg.clone();
        bad.directory.keys[0] = "zz".into();
        assert!(bad.directory.parsed_keys().is_err());
        let mut short = cfg.clone();
        short.directory.keys[1] = "aa".into();
        assert!(short.directory.parsed_keys().is_err());
    }
}
