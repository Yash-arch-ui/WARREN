use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::{Arc, Mutex};

use clap::{Parser, Subcommand};
use unlink::{client, config, credential, relay};

/// UNLINK — a minimal CLI client for a mixnet-routed messenger.
///
/// M1: real 3-hop Sphinx routing over local TCP. M2: blind-signature
/// admission tokens. M3: signed relay claims + verified gossip list (real
/// gossip *propagation* is M5+, per spec §5.4) and Layer-3 Double Ratchet
/// message-body encryption (Olm via `vodozemac`).
#[derive(Parser)]
#[command(name = "unlink", version, about, arg_required_else_help = true)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Generate an identity keypair (x25519) in the data dir
    Keygen {
        #[arg(long, help = "data dir (default $UNLINK_HOME or ~/.unlink)")]
        home: Option<PathBuf>,
    },
    /// Issue a batch of blind-signature admission tokens (M2 dev tool)
    TokenIssue {
        #[arg(long, default_value_t = credential::DEFAULT_BATCH_SIZE)]
        count: usize,
        #[arg(long, help = "epoch (default: current day)")]
        epoch: Option<u64>,
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
    /// Assemble a signed relay list from live relays (first-use bootstrap)
    DirectoryFetch {
        /// Relay addresses to query, e.g. 127.0.0.1:7001
        relays: Vec<String>,
        /// Write the verified list here (default <home>/relays.json)
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long)]
        home: Option<PathBuf>,
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
    /// Run as a mix relay node
    Relay {
        #[arg(long)]
        start: bool,
        #[arg(long, default_value_t = 7001, help = "listen port (0 = ephemeral)")]
        port: u16,
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
        Command::Keygen { home } => client::keygen(&home.unwrap_or_else(config::unlink_home)),

        Command::TokenIssue { count, epoch, home } => {
            let home = home.unwrap_or_else(config::unlink_home);
            token_issue(count, epoch.map(credential::Epoch), &home)
        }

        Command::Send {
            peer,
            msg,
            home,
            config,
            relays,
        } => {
            let home = home.unwrap_or_else(config::unlink_home);
            let relays = relays.unwrap_or_else(|| client::relays_path(&home));
            client::send(
                &peer,
                &msg,
                &home,
                &config.unwrap_or_else(config::config_path),
                &relays,
            )
        }

        Command::DirectoryFetch { relays, out, home } => {
            let home = home.unwrap_or_else(config::unlink_home);
            let out = out.unwrap_or_else(|| client::relays_path(&home));
            let addrs: Vec<&str> = relays.iter().map(String::as_str).collect();
            let list = unlink::directory::fetch_claims_from(&addrs)?;
            list.save(&out)?;
            Ok(format!(
                "verified {} relay claim(s) → {}",
                list.entries.len(),
                out.display()
            ))
        }

        Command::RatchetInit { home } => {
            let home = home.unwrap_or_else(config::unlink_home);
            let (id, otk) = unlink::ratchet::RatchetClient::init(&home)?;
            Ok(format!(
                "ratchet identity={id} one_time={otk}\nshare these with your peer and add them \
                 under [peers.<name>] in their config (id/otk)"
            ))
        }

        Command::Listen { addr, home } => {
            let home = home.unwrap_or_else(config::unlink_home);
            client::listen(&addr, &home)
        }

        Command::Relay {
            start,
            port,
            key,
            admit_key,
            epoch,
            cover_rate,
            cover_delay_ms,
            network,
        } => {
            if !start {
                anyhow::bail!(
                    "`unlink relay` requires `--start` (relay subcommands land with gossip propagation, M5+)"
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
            relay::start(port, key.as_deref(), admission, cover)?;
            Ok("relay stopped".into())
        }
    }
}

/// Local dev-tool issuance: plays both issuer and client roles. The bootstrap
/// (who deserves a batch) is a stub — one batch per client-id, per spec §4
/// open question (see `docs/THREAT_MODEL.md` §5).
fn token_issue(
    count: usize,
    epoch: Option<credential::Epoch>,
    home: &std::path::Path,
) -> anyhow::Result<String> {
    let epoch = epoch.unwrap_or_else(credential::Epoch::now);
    // Reuse the persisted issuer key so re-running `token-issue` does not
    // silently invalidate relays already configured with `--admit-key`.
    let mut issuer = credential::Issuer::load_or_new(Some(&home.join("issuer.pem")), epoch)?;
    issuer.grant_batch("local-user")?; // M2 bootstrap stub

    let mut wallet = credential::ClientTokenWallet::new(epoch, issuer.public_key_pem()?);
    wallet.request_batch(&issuer, count)?;

    wallet.save(&home.join("wallet.json"))?;
    // Persist the issuer keypair so relays can be configured with --admit-key
    // and so a later epoch can re-issue (M-later).
    credential::write_private(
        &home.join("issuer.pem"),
        issuer.private_key_pem()?.as_bytes(),
    )?;
    credential::write_private(
        &home.join("issuer.pub"),
        issuer.public_key_pem()?.as_bytes(),
    )?;

    Ok(format!(
        "issued {count} admission tokens for epoch {} → {}",
        epoch.0,
        home.join("wallet.json").display()
    ))
}
