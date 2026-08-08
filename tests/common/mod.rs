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
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            match rx.recv_timeout(remaining) {
                Ok(line) if line.contains("listening on") => {
                    let rest = line.split("listening on ").nth(1).unwrap();
                    let (addr, pubkey_hex) = rest.split_once(" pubkey ").unwrap();
                    return RelayProcess {
                        child,
                        addr: addr.to_string(),
                        pubkey_hex: pubkey_hex.to_string(),
                        logs: rx,
                        history,
                    };
                }
                Ok(_) => {}
                Err(_) => panic!("relay did not report 'listening on' within 20s"),
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

/// The "destination client": a TCP listener that collects delivered messages.
pub struct Receiver {
    pub addr: String,
    received: Arc<Mutex<Vec<String>>>,
}

impl Receiver {
    pub fn start() -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let received = Arc::new(Mutex::new(Vec::new()));
        let rx = received.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                if let Ok(Some((unlink::net::FRAME_DELIVER, body))) =
                    unlink::net::recv_frame(&mut s)
                {
                    rx.lock()
                        .unwrap()
                        .push(String::from_utf8_lossy(&body).into_owned());
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

/// Write a client config TOML.
pub fn write_config(path: &Path, relays: (&str, &str, &str), peers: &[(&str, &str)]) {
    let mut s = format!(
        "[relays]\nentry = \"{}\"\nmiddle = \"{}\"\nexit = \"{}\"\n\n[peers]\n",
        relays.0, relays.1, relays.2
    );
    for (k, v) in peers {
        s.push_str(&format!("{k} = \"{v}\"\n"));
    }
    std::fs::write(path, s).unwrap();
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
