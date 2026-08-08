//! M9 — `warren serve`: the loopback HTTP surface used as a message
//! transport by a local process.
//!
//! These tests run the real thing: three relay processes, two `warren serve`
//! daemons with separate homes/ratchet accounts/wallets, and a bus-sized
//! payload that must cross the 3-hop mix path in several Sphinx packets and
//! arrive byte-identical, under the id the sender was given.

mod common;

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use common::{RelayProcess, TempDir, ratchet_init, write_config, write_relay_list};

/// A `warren serve` child process, killed on drop.
struct ServeProcess {
    child: Child,
    port: u16,
}

impl ServeProcess {
    fn spawn(port: u16, listen: &str, home: &Path, config: &Path) -> Self {
        let child = Command::new(env!("CARGO_BIN_EXE_warren"))
            .arg("serve")
            .arg("--port")
            .arg(port.to_string())
            .arg("--listen")
            .arg(listen)
            .arg("--home")
            .arg(home)
            .arg("--config")
            .arg(config)
            .stdout(Stdio::null())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("failed to spawn warren serve");
        let serve = ServeProcess { child, port };
        serve.wait_ready();
        serve
    }

    fn wait_ready(&self) {
        let deadline = Instant::now() + Duration::from_secs(20);
        while Instant::now() < deadline {
            if http(self.port, "GET", "/api/v1/status", None).is_some() {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        panic!("warren serve on port {} never became ready", self.port);
    }

    fn get(&self, path: &str) -> (u16, String) {
        http(self.port, "GET", path, None).expect("serve must answer")
    }

    fn post(&self, path: &str, body: &str) -> (u16, String) {
        http(self.port, "POST", path, Some(body)).expect("serve must answer")
    }
}

impl Drop for ServeProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Minimal HTTP/1.1 client — enough to talk to the loopback API without
/// pulling an HTTP client into the dependency tree. `None` means the
/// connection could not be made (the server is not up yet).
fn http(port: u16, method: &str, path: &str, body: Option<&str>) -> Option<(u16, String)> {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_secs(30)))
        .ok()?;
    let body = body.unwrap_or("");
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\
         Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).ok()?;
    let text = String::from_utf8_lossy(&raw).into_owned();

    let status: u16 = text
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let body = text
        .split_once("\r\n\r\n")
        .map(|(_, b)| b.to_string())
        .unwrap_or_default();
    Some((status, body))
}

/// Pull a top-level JSON string field out of a `{"data": {...}}` response
/// without adding a JSON parser to the test's dependencies.
fn field(json: &str, key: &str) -> String {
    let needle = format!("\"{key}\":");
    let rest = json
        .split_once(&needle)
        .unwrap_or_else(|| panic!("no `{key}` in {json}"))
        .1
        .trim_start();
    assert!(rest.starts_with('"'), "`{key}` is not a string in {json}");
    let mut out = String::new();
    let mut chars = rest[1..].chars();
    while let Some(c) = chars.next() {
        match c {
            '"' => break,
            '\\' => match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('u') => {
                    let hex: String = chars.by_ref().take(4).collect();
                    if let Some(ch) = u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) {
                        out.push(ch);
                    }
                }
                Some(other) => out.push(other),
                None => break,
            },
            c => out.push(c),
        }
    }
    out
}

/// Grab a free loopback port. The listener is dropped immediately, so this is
/// advisory — good enough for a test, and the same trick the relay harness
/// relies on via `--port 0`.
fn free_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

/// A bus-sized payload: comfortably past the ~705 B Sphinx plaintext budget,
/// with quotes, braces and multi-byte characters so reassembly is proven
/// byte-exact and not merely "looks like ASCII".
fn bus_payload() -> String {
    let events: Vec<String> = (0..40)
        .map(|i| {
            format!(
                "{{\"id\":\"evt-{i}\",\"side\":\"BID\",\"px\":{}.25,\"qty\":{},\"note\":\"canceléd 🎯\"}}",
                100 + i,
                i * 7
            )
        })
        .collect();
    format!(
        "@anomaly-detector {{\"v\":1,\"case_id\":\"case-9f2a\",\"from\":\"rnd\",\
         \"to\":\"anomaly-detector\",\"kind\":\"handoff\",\"payload\":{{\"events\":[{}]}}}}",
        events.join(",")
    )
}

#[test]
fn serve_carries_a_bus_message_over_the_real_mixnet() {
    let tmp = TempDir::new("m9-serve");
    let entry = RelayProcess::spawn(&[]);
    let middle = RelayProcess::spawn(&[]);
    let exit = RelayProcess::spawn(&[]);

    // Two independent identities, exactly as the two desks will be: separate
    // homes, ratchet accounts, wallets and delivery ports.
    let (alice_home, alice_id, alice_otk) = ratchet_init(&tmp, "alice");
    let (bob_home, bob_id, bob_otk) = ratchet_init(&tmp, "bob");
    let alice_delivery = format!("127.0.0.1:{}", free_port());
    let bob_delivery = format!("127.0.0.1:{}", free_port());

    // A multi-chunk message spends one admission token per packet, so the
    // batch has to cover the whole message, not just one send.
    for home in [&alice_home, &bob_home] {
        warren::api::token_issue(120, None, 0, "test-client", home).unwrap();
    }

    let relays = (
        entry.addr.as_str(),
        middle.addr.as_str(),
        exit.addr.as_str(),
    );
    let alice_cfg = tmp.path().join("alice.toml");
    let bob_cfg = tmp.path().join("bob.toml");
    write_config(
        &alice_cfg,
        relays,
        &[("bob", &bob_delivery, &bob_id, &bob_otk)],
    );
    write_config(
        &bob_cfg,
        relays,
        &[("alice", &alice_delivery, &alice_id, &alice_otk)],
    );
    write_relay_list(&alice_home.join("relays.json"), &[&entry, &middle, &exit]);
    write_relay_list(&bob_home.join("relays.json"), &[&entry, &middle, &exit]);

    let alice = ServeProcess::spawn(free_port(), &alice_delivery, &alice_home, &alice_cfg);
    let bob = ServeProcess::spawn(free_port(), &bob_delivery, &bob_home, &bob_cfg);

    // ---- send ----
    let payload = bus_payload();
    assert!(
        payload.len() > warren::client::MAX_MSG_LEN,
        "the fixture must exceed one Sphinx payload or chunking is untested"
    );
    let body = serde_json::json!({"content": payload, "peer": "bob"}).to_string();
    let (status, response) = alice.post("/api/v1/agent/chats/room-1/messages", &body);
    assert_eq!(status, 200, "send failed: {response}");
    let bmid = field(&response, "id");
    assert!(!bmid.is_empty(), "send must return a message id");

    // The sender must not receive its own message.
    let (own, _) = alice.get("/api/v1/agent/chats/room-1/messages/next");
    assert_eq!(own, 204, "a sender must never see its own message");

    // ---- receive ----
    let deadline = Instant::now() + Duration::from_secs(60);
    let received = loop {
        let (status, body) = bob.get("/api/v1/agent/chats/room-1/messages/next");
        if status == 200 {
            break body;
        }
        assert_eq!(status, 204, "unexpected poll status: {body}");
        assert!(
            Instant::now() < deadline,
            "message never arrived through the mix path"
        );
        std::thread::sleep(Duration::from_millis(100));
    };

    assert_eq!(
        field(&received, "id"),
        bmid,
        "id must survive the round trip"
    );
    assert_eq!(field(&received, "chat_room_id"), "room-1");
    assert_eq!(
        field(&received, "content"),
        payload,
        "payload must reassemble byte-for-byte"
    );
    assert!(
        !field(&received, "sender_id").is_empty(),
        "the receiver must learn who sent it"
    );

    // ---- acks ----
    let (s1, _) = bob.post(
        &format!("/api/v1/agent/chats/room-1/messages/{bmid}/processing"),
        "",
    );
    let (s2, _) = bob.post(
        &format!("/api/v1/agent/chats/room-1/messages/{bmid}/processed"),
        "",
    );
    assert_eq!((s1, s2), (200, 200));
    let (_, acks) = bob.get("/api/v1/agent/acks");
    let processing = acks.find("processing").expect("processing ack recorded");
    let processed = acks.find("processed").expect("processed ack recorded");
    assert!(processing < processed, "acks must be recorded in order");

    // The queue drains: a second poll is empty again.
    let (empty, _) = bob.get("/api/v1/agent/chats/room-1/messages/next");
    assert_eq!(empty, 204);

    // Status reflects the real directory and the tokens the send consumed.
    let (_, status_body) = alice.get("/api/v1/status");
    assert!(
        status_body.contains("\"directory_entries\":3"),
        "status must report the verified relay list: {status_body}"
    );

    // ---- the surface the UI reads ----
    // Sender's view: the message, its verified 3-hop path, one token per packet.
    let (_, sent_rows) = alice.get("/api/v1/messages");
    assert!(sent_rows.contains(&bmid), "the send must be listed");
    assert!(
        sent_rows.contains("\"direction\":\"sent\"")
            && sent_rows.contains("\"state\":\"IN_FLIGHT\""),
        "sender view: {sent_rows}"
    );
    for role in ["entry", "middle", "exit"] {
        assert!(
            sent_rows.contains(&format!("\"role\":\"{role}\"")),
            "the verified path must name its {role} hop: {sent_rows}"
        );
    }

    let (_, detail) = alice.get(&format!("/api/v1/messages/{bmid}"));
    assert_eq!(field(&detail, "id"), bmid);
    assert!(
        !field(&detail, "sha256").is_empty(),
        "a sent message must carry the digest of what went on the wire"
    );

    // Receiver's view: delivered, and with NO hops — a recipient cannot see
    // the path a message took, which is the anonymity property working.
    let (_, recv_rows) = bob.get("/api/v1/messages");
    assert!(
        recv_rows.contains("\"direction\":\"recv\"")
            && recv_rows.contains("\"state\":\"DELIVERED\""),
        "receiver view: {recv_rows}"
    );
    assert!(
        recv_rows.contains("\"hops\":[]"),
        "the receiver must not be told the path: {recv_rows}"
    );

    let (_, stats) = alice.get("/api/v1/stats");
    assert!(
        stats.contains("\"sent\":1") && stats.contains("\"tokens_spent\""),
        "stats: {stats}"
    );

    let (_, relays) = alice.get("/api/v1/relays");
    assert!(
        relays.contains("\"role\":\"entry\"") && relays.contains("\"threshold\""),
        "the directory panel needs roles and the K-of-N policy: {relays}"
    );

    // The live stream replays what already happened, so a page load starts
    // with context rather than an empty panel.
    let stream = read_stream(alice.port, Duration::from_secs(5));
    assert!(
        stream.contains(": warren event stream"),
        "the stream must open immediately: {stream}"
    );
    assert!(
        stream.contains("data: ") && stream.contains(&bmid),
        "the stream must replay the send: {stream}"
    );
    for kind in ["encrypt", "token", "sphinx"] {
        assert!(
            stream.contains(&format!("\"kind\":\"{kind}\"")),
            "the stream must narrate the {kind} stage: {stream}"
        );
    }
}

/// Open the SSE stream and read whatever arrives within `window`. The server
/// never closes the connection, so this reads until the socket goes quiet.
fn read_stream(port: u16, window: Duration) -> String {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("stream must connect");
    stream.set_read_timeout(Some(window)).unwrap();
    stream
        .write_all(
            b"GET /api/v1/stream HTTP/1.1\r\nHost: 127.0.0.1\r\nAccept: text/event-stream\r\n\r\n",
        )
        .unwrap();
    let mut out = Vec::new();
    let mut buf = [0u8; 4096];
    let deadline = Instant::now() + window;
    while Instant::now() < deadline {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                out.extend_from_slice(&buf[..n]);
                // Enough to prove the replay landed; no need to hold the
                // connection open for the full window.
                if out.len() > 2_000 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[test]
fn serve_refuses_a_non_loopback_delivery_address() {
    let tmp = TempDir::new("m9-bind");
    let (home, _, _) = ratchet_init(&tmp, "alice");
    let cfg = tmp.path().join("config.toml");
    write_config(
        &cfg,
        ("127.0.0.1:1", "127.0.0.1:2", "127.0.0.1:3"),
        &[("bob", "127.0.0.1:4", &"aa".repeat(32), &"bb".repeat(32))],
    );

    let out = Command::new(env!("CARGO_BIN_EXE_warren"))
        .arg("serve")
        .arg("--listen")
        .arg("0.0.0.0:9001")
        .arg("--home")
        .arg(&home)
        .arg("--config")
        .arg(&cfg)
        .output()
        .expect("failed to run warren serve");

    assert!(!out.status.success(), "a public bind must be refused");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(
        stderr.contains("loopback"),
        "the refusal must say why: {stderr}"
    );
}
