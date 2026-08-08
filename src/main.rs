use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::{Arc, Mutex};

use clap::{Parser, Subcommand};
use warren::{client, config, credential, relay};

/// WARREN — a minimal CLI client for a mixnet-routed messenger.
///
/// M1: real 3-hop Sphinx routing over local TCP. M2: blind-signature
/// admission tokens. M3: signed relay claims + verified gossip list (real
/// gossip *propagation* is M5+, per spec §5.4) and Layer-3 Double Ratchet
/// message-body encryption (Olm via `vodozemac`).
#[derive(Parser)]
#[command(name = "warren", version, about, arg_required_else_help = true)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Write a default config.toml (relay path, commented peers/directory
    /// policy) into the data dir; the base for local single-machine testing
    Init {
        #[arg(long, help = "data dir (default $WARREN_HOME or ~/.warren)")]
        home: Option<PathBuf>,
        #[arg(
            long,
            help = "write the config to this exact path (default <home>/config.toml)"
        )]
        config: Option<PathBuf>,
        #[arg(long, help = "overwrite an existing config.toml")]
        force: bool,
    },
    /// Generate an identity keypair (x25519) in the data dir
    Keygen {
        #[arg(long, help = "data dir (default $WARREN_HOME or ~/.warren)")]
        home: Option<PathBuf>,
    },
    /// Issue a batch of blind-signature admission tokens (M2 dev tool; M6:
    /// requires a proof of work unless --pow-bits 0)
    TokenIssue {
        #[arg(long, default_value_t = credential::DEFAULT_BATCH_SIZE)]
        count: usize,
        #[arg(long, help = "epoch (default: current day)")]
        epoch: Option<u64>,
        #[arg(
            long,
            default_value_t = warren::pow::DEFAULT_POW_BITS,
            help = "proof-of-work difficulty (leading zero bits; 0 disables the gate)"
        )]
        pow_bits: u32,
        #[arg(
            long,
            default_value = "local-user",
            help = "pseudonymous client id the batch is granted to"
        )]
        client_id: String,
        #[arg(long)]
        home: Option<PathBuf>,
    },
    /// Send a message to a peer through the 3-hop mix path
    Send {
        /// Peer label (looked up under [peers] in the config)
        peer: String,
        /// Message body
        msg: String,
        #[arg(long)]
        home: Option<PathBuf>,
        #[arg(long)]
        config: Option<PathBuf>,
        /// Signed gossip list (default <home>/relays.json)
        #[arg(long)]
        relays: Option<PathBuf>,
    },
    /// Assemble a signed relay list from live relays (first-use bootstrap).
    /// With `--dir-key`, the listed keys additionally attest the list (M7
    /// K-of-N directory): the client accepts it only if ≥K of its configured
    /// directory keys did.
    DirectoryFetch {
        /// Relay addresses to query, e.g. 127.0.0.1:7001
        relays: Vec<String>,
        /// Write the verified list here (default <home>/relays.json)
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long)]
        home: Option<PathBuf>,
        /// ed25519 directory signing keys (files of 32 raw bytes); repeat to
        /// attest with several of the N keys
        #[arg(long = "dir-key")]
        dir_keys: Vec<PathBuf>,
    },
    /// Print this client's Layer-3 Double Ratchet keys to share with a peer
    RatchetInit {
        #[arg(long)]
        home: Option<PathBuf>,
    },
    /// Listen for messages delivered to this client
    Listen {
        /// Local address to listen on, e.g. 127.0.0.1:9001
        addr: String,
        #[arg(long)]
        home: Option<PathBuf>,
    },
    /// Run a loopback HTTP API over this client (send/receive/status), so a
    /// local process can use the mixnet as a message transport
    Serve {
        #[arg(long, default_value_t = 8800, help = "HTTP port on 127.0.0.1")]
        port: u16,
        #[arg(
            long,
            default_value = "127.0.0.1:9001",
            help = "loopback address the exit relay delivers to"
        )]
        listen: String,
        #[arg(long)]
        home: Option<PathBuf>,
        #[arg(long)]
        config: Option<PathBuf>,
        /// Signed gossip list (default <home>/relays.json)
        #[arg(long)]
        relays: Option<PathBuf>,
    },
    /// Run as a mix relay node
    Relay {
        #[arg(long)]
        start: bool,
        #[arg(long, default_value_t = 7001, help = "listen port (0 = ephemeral)")]
        port: u16,
        #[arg(
            long,
            default_value = "127.0.0.1",
            help = "interface to bind (use 0.0.0.0 for a publicly reachable relay)"
        )]
        bind: String,
        #[arg(
            long,
            help = "public host:port to sign into the claim (default: the bound address; \
                     required when binding 0.0.0.0 so clients can look the relay up)"
        )]
        advertise: Option<String>,
        #[arg(long, help = "relay x25519 key file (auto-generated if missing)")]
        key: Option<PathBuf>,
        #[arg(long, help = "issuer public key (PEM); enables M2 admission gate")]
        admit_key: Option<PathBuf>,
        #[arg(long, help = "admission epoch (default: current day)")]
        epoch: Option<u64>,
        #[arg(long, help = "cover traffic rate (packets/s, Poisson; 0 = off)")]
        cover_rate: Option<f64>,
        #[arg(long, help = "mean per-hop delay for cover packets (ms; default 10)")]
        cover_delay_ms: Option<u64>,
        #[arg(
            long,
            help = "mix chain this relay belongs to, comma-separated in order (required with --cover-rate)"
        )]
        network: Option<String>,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli.command) {
        Ok(out) => {
            println!("{out}");
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("error: {err:#}");
            ExitCode::FAILURE
        }
    }
}

fn run(cmd: Command) -> anyhow::Result<String> {
    match cmd {
        Command::Init {
            home,
            config,
            force,
        } => {
            // --config wins; else --home (data dir); else the default path
            // ($WARREN_CONFIG, or <$WARREN_HOME|~/.warren>/config.toml).
            let path = match (config, home) {
                (Some(p), _) => p,
                (None, Some(h)) => h.join("config.toml"),
                (None, None) => config::config_path(),
            };
            let written = config::init(&path, force)?;
            Ok(format!(
                "wrote default config to {} (relay path 127.0.0.1:7001 → 7002 → 7003; \
                 add contacts under [peers] in the file)",
                written.display()
            ))
        }

        Command::Keygen { home } => client::keygen(&home.unwrap_or_else(config::warren_home)),

        Command::TokenIssue {
            count,
            epoch,
            pow_bits,
            client_id,
            home,
        } => {
            let home = home.unwrap_or_else(config::warren_home);
            warren::api::token_issue(
                count,
                epoch.map(credential::Epoch),
                pow_bits,
                &client_id,
                &home,
            )
        }

        Command::Send {
            peer,
            msg,
            home,
            config,
            relays,
        } => {
            let home = home.unwrap_or_else(config::warren_home);
            let relays = relays.unwrap_or_else(|| client::relays_path(&home));
            client::send(
                &peer,
                &msg,
                &home,
                &config.unwrap_or_else(config::config_path),
                &relays,
            )
        }

        Command::DirectoryFetch {
            relays,
            out,
            home,
            dir_keys,
        } => {
            let home = home.unwrap_or_else(config::warren_home);
            let out = out.unwrap_or_else(|| client::relays_path(&home));
            let addrs: Vec<&str> = relays.iter().map(String::as_str).collect();
            let mut list = warren::directory::fetch_claims_from(&addrs)?;
            // M7: each --dir-key attests the assembled list with one of the N
            // directory keys. The client enforces the K-of-N threshold.
            for path in &dir_keys {
                let raw = std::fs::read(path).map_err(|e| {
                    anyhow::anyhow!("cannot read directory key `{}`: {e}", path.display())
                })?;
                let bytes: [u8; 32] = raw.as_slice().try_into().map_err(|_| {
                    anyhow::anyhow!(
                        "directory key `{}` must contain exactly 32 raw bytes",
                        path.display()
                    )
                })?;
                let sk = ed25519_dalek::SigningKey::from_bytes(&bytes);
                list.attestations.push(list.sign_attestation(&sk));
            }
            list.save(&out)?;
            Ok(format!(
                "verified {} relay claim(s) with {} directory attestation(s) → {}",
                list.entries.len(),
                list.attestations.len(),
                out.display()
            ))
        }

        Command::RatchetInit { home } => {
            let home = home.unwrap_or_else(config::warren_home);
            let (id, otk) = warren::ratchet::RatchetClient::init(&home)?;
            Ok(format!(
                "ratchet identity={id} one_time={otk}\nshare these with your peer and add them \
                 under [peers.<name>] in their config (id/otk)"
            ))
        }

        Command::Listen { addr, home } => {
            let home = home.unwrap_or_else(config::warren_home);
            client::listen(&addr, &home)
        }

        Command::Serve {
            port,
            listen,
            home,
            config,
            relays,
        } => {
            let home = home.unwrap_or_else(config::warren_home);
            let relays = relays.unwrap_or_else(|| client::relays_path(&home));
            warren::api::serve(
                port,
                &listen,
                &home,
                &config.unwrap_or_else(config::config_path),
                &relays,
            )
        }

        Command::Relay {
            start,
            port,
            bind,
            advertise,
            key,
            admit_key,
            epoch,
            cover_rate,
            cover_delay_ms,
            network,
        } => {
            if !start {
                anyhow::bail!(
                    "`warren relay` requires `--start` (relay subcommands land with gossip propagation, M5+)"
                )
            }
            let epoch = epoch.map(credential::Epoch);
            let admission = match &admit_key {
                Some(path) => {
                    let pem = std::fs::read_to_string(path)?;
                    let epoch = epoch.unwrap_or_else(credential::Epoch::now);
                    let admission = credential::RelayAdmission::from_pem(&pem, epoch)?;
                    Some(Arc::new(Mutex::new(admission)))
                }
                None => None,
            };
            // Cover traffic (M5): only when a positive rate is requested. The
            // relay needs its own position in the chain to route cover through
            // its successors, so --network is required (relays have no
            // directory yet — M5+).
            let cover = match cover_rate {
                Some(rate) if rate > 0.0 => {
                    let network: Vec<String> = network
                        .as_deref()
                        .map(|n| {
                            n.split(',')
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty())
                                .collect()
                        })
                        .ok_or_else(|| {
                            anyhow::anyhow!(
                                "--cover-rate requires --network (the mix chain, in order)"
                            )
                        })?;
                    Some(relay::CoverConfig {
                        rate_per_sec: rate,
                        delay_mean_ms: cover_delay_ms.unwrap_or(config::DEFAULT_DELAY_MS),
                        network,
                    })
                }
                _ => None,
            };
            relay::start(
                &bind,
                port,
                advertise.as_deref(),
                key.as_deref(),
                admission,
                cover,
            )?;
            Ok("relay stopped".into())
        }
    }
}
