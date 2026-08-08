//! Shared helpers for the integration tests: spawn real relay processes,
//! receive delivered messages, write configs, run the `unlink send` CLI.
//!
//! Each integration-test binary only uses a subset of these helpers, so
//! dead-code warnings across targets are expected.
#![allow(dead_code)]

use std::io::BufRead;
use std::io::BufReader;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::time::{Duration, Instant};

static COUNTER: AtomicUsize = AtomicUsize::new(0);

pub struct TempDir(pub PathBuf);

impl TempDir {
    pub fn new(tag: &str) -> Self {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let p = std::env::temp_dir().join(format!("unlink-test-{tag}-{}-{n}", std::process::id()));
        std::fs::create_dir_all(&p).unwrap();
        TempDir(p)
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// A real relay process with a stdout log pipe. Every line is kept in a
/// history (so assertions can inspect lines already consumed by `wait_log`)
/// and is also pushed to a blocking channel for `wait_log`.
pub struct RelayProcess {
    child: Child,
    pub addr: String,
    pub pubkey_hex: String,
    /// The relay's self-signed claim, captured from its startup output.
    pub claim: unlink::directory::RelayClaim,
    logs: mpsc::Receiver<String>,
    history: Arc<Mutex<Vec<String>>>,
}

impl RelayProcess {
    /// Spawn `unlink relay --start --port 0 <extra args>` and wait until it
    /// reports its actual address + public key.
    pub fn spawn(extra: &[&str]) -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_unlink"))
            .arg("relay")
            .arg("--start")
            .arg("--port")
            .arg("0")
            .args(extra)
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("failed to spawn relay process");

        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        let history = Arc::new(Mutex::new(Vec::new()));
        let history_rx = history.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let line = line.unwrap_or_default();
                history_rx.lock().unwrap().push(line.clone());
                if tx.send(line).is_err() {
                    break;
                }
            }
        });

        let deadline = Instant::now() + Duration::from_secs(20);
        let mut addr = String::new();
        let mut pubkey_hex = String::new();
        let mut claim = None;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            match rx.recv_timeout(remaining) {
                Ok(line) if line.contains("listening on") => {
                    let rest = line.split("listening on ").nth(1).unwrap();
                    let (a, pk) = rest.split_once(" sphinx=").unwrap();
                    addr = a.to_string();
                    pubkey_hex = pk.trim().to_string();
                }
                Ok(line) if line.starts_with("relay claim: ") => {
                    let json = line.trim_start_matches("relay claim: ");
                    claim = Some(unlink::directory::RelayClaim::from_json_str(json).unwrap());
                }
                Ok(_) => {}
                Err(_) => {
                    // Reap the child before panicking so the timeout path
                    // does not leave a zombie relay process behind.
                    let _ = child.kill();
                    let _ = child.wait();
                    panic!("relay did not report 'listening on' + 'relay claim' within 20s");
                }
            }
            if !addr.is_empty()
                && let Some(claim) = claim
            {
                return RelayProcess {
                    child,
                    addr,
                    pubkey_hex,
                    claim,
                    logs: rx,
                    history,
                };
            }
        }
    }

    /// Wait for a log line containing `needle` (consuming lines).
    pub fn wait_log(&self, needle: &str, timeout: Duration) -> bool {
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            match self.logs.recv_timeout(remaining) {
                Ok(line) if line.contains(needle) => return true,
                Ok(_) => continue,
                Err(_) => return false,
            }
        }
    }

    /// All log lines ever received (including ones consumed by `wait_log`).
    pub fn all_logs(&self) -> Vec<String> {
        self.history.lock().unwrap().clone()
    }

    pub fn is_alive(&mut self) -> bool {
        self.child.try_wait().ok().flatten().is_none()
    }
}

impl Drop for RelayProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// The "destination client": a TCP listener that collects delivered
/// messages, **decrypting each with the Layer-3 Double Ratchet** (the
/// receiver half of a real `unlink listen`). `home` must have been
/// `ratchet-init`'d and hold the account whose one-time key the sender used.
pub struct Receiver {
    pub addr: String,
    received: Arc<Mutex<Vec<String>>>,
}

impl Receiver {
    pub fn start(home: &Path) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let received = Arc::new(Mutex::new(Vec::new()));
        let rx = received.clone();
        let home = home.to_path_buf();
        std::thread::spawn(move || {
            let mut ratchet = unlink::ratchet::RatchetClient::load(&home).unwrap();
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                if let Ok(Some((unlink::net::FRAME_DELIVER, body))) =
                    unlink::net::recv_frame(&mut s)
                    && let Ok((_sender, pt)) = ratchet.decrypt(&body)
                {
                    rx.lock()
                        .unwrap()
                        .push(String::from_utf8_lossy(&pt).into_owned());
                }
            }
        });
        Receiver { addr, received }
    }

    pub fn wait_for_messages(&self, n: usize, timeout: Duration) -> Vec<String> {
        let deadline = Instant::now() + timeout;
        loop {
            {
                let r = self.received.lock().unwrap();
                if r.len() >= n {
                    return r.clone();
                }
            }
            if Instant::now() > deadline {
                panic!(
                    "timed out waiting for {n} messages; have {:?}",
                    self.received.lock().unwrap().clone()
                );
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    pub fn count(&self) -> usize {
        self.received.lock().unwrap().len()
    }
}

/// Write a client config TOML with the **default** per-hop mix delay (the
/// field is omitted → `config::DEFAULT_DELAY_MS` applies). Each peer is a
/// `[peers.<label>]` table with its delivery address + Layer-3 ratchet keys
/// (id/otk).
pub fn write_config(
    path: &Path,
    relays: (&str, &str, &str),
    peers: &[(&str, &str, &str, &str)], // (label, addr, id, otk)
) {
    let mut s = format!(
        "[relays]\nentry = \"{}\"\nmiddle = \"{}\"\nexit = \"{}\"\n",
        relays.0, relays.1, relays.2
    );
    for (label, addr, id, otk) in peers {
        s.push_str(&format!(
            "\n[peers.{label}]\naddr = \"{addr}\"\nid = \"{id}\"\notk = \"{otk}\"\n"
        ));
    }
    std::fs::write(path, s).unwrap();
}

/// Like [`write_config`], but with an **explicit** per-hop mix delay — the
/// value is always written, including `0`, so a config point of "no delay" is
/// measurable (the latency harness uses this for §5.5's multiple config
/// points; a `0` here is genuinely 0 ms, not the config default).
pub fn write_config_with_delay(
    path: &Path,
    relays: (&str, &str, &str),
    peers: &[(&str, &str, &str, &str)], // (label, addr, id, otk)
    delay_ms: u64,
) {
    let mut s = format!(
        "[relays]\nentry = \"{}\"\nmiddle = \"{}\"\nexit = \"{}\"\ndelay_ms = {delay_ms}\n",
        relays.0, relays.1, relays.2
    );
    for (label, addr, id, otk) in peers {
        s.push_str(&format!(
            "\n[peers.{label}]\naddr = \"{addr}\"\nid = \"{id}\"\notk = \"{otk}\"\n"
        ));
    }
    std::fs::write(path, s).unwrap();
}

/// Initialize a Layer-3 ratchet identity (the receiver side) and return
/// `(home, id_hex, otk_hex)` to hand to the sender's config.
pub fn ratchet_init(tmp: &TempDir, tag: &str) -> (PathBuf, String, String) {
    let home = tmp.path().join(tag);
    let (id, otk) = unlink::ratchet::RatchetClient::init(&home).unwrap();
    (home, id, otk)
}

/// Write a signed gossip list from relay claims (the client's trust anchor).
pub fn write_relay_list(path: &Path, relays: &[&RelayProcess]) {
    let claims: Vec<unlink::directory::RelayClaim> =
        relays.iter().map(|r| r.claim.clone()).collect();
    let list = unlink::directory::SignedRelayList::from_claims(claims);
    list.save(path).unwrap();
}

/// Run `unlink send <peer> <msg> --home <home> --config <config>`.
pub fn run_send(home: &Path, config: &Path, peer: &str, msg: &str) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_unlink"))
        .arg("send")
        .arg(peer)
        .arg(msg)
        .arg("--home")
        .arg(home)
        .arg("--config")
        .arg(config)
        .output()
        .expect("failed to run unlink send")
}

/// Sleep helper so log assertions run after the relay pipeline settles.
pub fn settle(ms: u64) {
    std::thread::sleep(Duration::from_millis(ms));
}
