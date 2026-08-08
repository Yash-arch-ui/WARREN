//! CLI smoke tests — exercise the compiled `unlink` binary end to end.
//! Uses `env!("CARGO_BIN_EXE_unlink")`; no extra dev-dependencies.

use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

static COUNTER: AtomicUsize = AtomicUsize::new(0);

fn unlink(args: &[&str]) -> (String, String, bool) {
    let out = Command::new(env!("CARGO_BIN_EXE_unlink"))
        .args(args)
        .output()
        .expect("failed to run unlink binary");
    (
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
        out.status.success(),
    )
}

fn temp_home(tag: &str) -> PathBuf {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let p = std::env::temp_dir().join(format!("unlink-cli-{tag}-{}-{n}", std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).unwrap();
    p
}

#[test]
fn keygen_writes_identity() {
    let home = temp_home("keygen");
    let (stdout, stderr, ok) = unlink(&["keygen", "--home", &home.to_string_lossy()]);
    assert!(ok, "keygen should succeed; stderr: {stderr}");
    assert!(stdout.contains("identity"), "stdout: {stdout}");
    assert!(home.join("identity.key").exists(), "identity.key written");
}

#[test]
fn token_issue_writes_wallet() {
    let home = temp_home("issue");
    let (stdout, stderr, ok) = unlink(&[
        "token-issue",
        "--count",
        "3",
        "--epoch",
        "1",
        // M6: the PoW gate is on by default (26 bits ≈ sub-second in release);
        // a small difficulty keeps the smoke test instant while still
        // exercising the real mine-then-grant path. The gate itself is
        // thoroughly tested in `tests/m7_bootstrap.rs`.
        "--pow-bits",
        "10",
        "--home",
        &home.to_string_lossy(),
    ]);
    assert!(ok, "token-issue should succeed; stderr: {stderr}");
    assert!(stdout.contains("issued 3"), "stdout: {stdout}");
    assert!(home.join("wallet.json").exists(), "wallet.json written");
    assert!(home.join("issuer.pub").exists(), "issuer.pub written");
}

#[test]
fn send_without_wallet_fails_cleanly() {
    let home = temp_home("send");
    let cfg = home.join("missing.toml");
    let (_, stderr, ok) = unlink(&[
        "send",
        "bob",
        "hi",
        "--home",
        &home.to_string_lossy(),
        "--config",
        &cfg.to_string_lossy(),
    ]);
    assert!(!ok, "send without config/wallet must fail");
    assert!(
        stderr.contains("config"),
        "clean error names the config: {stderr}"
    );
}

#[test]
fn relay_requires_start_flag() {
    let (_, stderr, ok) = unlink(&["relay"]);
    assert!(!ok, "relay without --start should fail");
    assert!(
        stderr.contains("--start"),
        "error hints at --start: {stderr}"
    );
}

#[test]
fn no_args_prints_help() {
    // clap's `arg_required_else_help` prints help to stderr and exits 2.
    let (_, stderr, ok) = unlink(&[]);
    assert!(!ok, "no args should be an error (help + exit 2)");
    assert!(stderr.contains("Usage:"), "help shows usage: {stderr}");
}
