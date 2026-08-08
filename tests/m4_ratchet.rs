//! M4 integration test: a full real Double Ratchet session over the verified
//! 3-hop relay path (spec §3.2 "Layer 3", §5.4).
//!
//! Two live clients, `alice` and `bob`, run in-process with **three real
//! relay processes** between them. Each client shares one
//! [`RatchetClient`] between its receive thread and its send path — the same
//! single session state a real client keeps — so the exchange is a true
//! bidirectional conversation:
//!
//! ```text
//!   alice → bob:  "hello one"      # pre-key message: session established
//!   bob   → alice: "back at you"   # bob ratchets forward; alice decrypts
//!   alice → bob:  "same payload"   # normal message, fresh per-message key
//!   alice → bob:  "same payload"   # same plaintext ⇒ different wire bytes
//! ```
//!
//! Every hop is the real stack: the signed gossip list + live handshake
//! cross-check (`client::send_packet` re-verifies the path), Sphinx wrapping
//! over plain TCP, three real relays, an M2 token spend per message, and
//! vodozemac Double Ratchet message-body encryption (`ratchet`).
//!
//! Why in-process rather than `unlink send` subprocesses: the CLI is a
//! one-shot per send, which would force a session to be re-established
//! between CLI invocations; a real client is one process that both listens
//! and sends on a single session. The send path here is byte-for-byte the
//! library code `client::send` runs (`RatchetClient::encrypt` →
//! `spend_token` → `client::send_packet`).
//!
//! The task's "message N+1 does not decrypt with message N's key" property
//! is asserted at the library layer in `ratchet::tests` (fresh per-message
//! key, key erased after use, replay of N or N+1 fails after the ratchet
//! advances); here we additionally assert the observable end of it over the
//! full path: identical plaintexts produce **distinct wire bytes** and both
//! decrypt in order on the established session, with no re-handshake.

mod common;

use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use common::*;
use unlink::client;
use unlink::config::Config;
use unlink::credential::{ClientTokenWallet, Epoch, Issuer};
use unlink::directory::SignedRelayList;
use unlink::net;
use unlink::ratchet::RatchetClient;

/// A live client: one listening thread + one shared session state, able to
/// both receive (decrypt FRAME_DELIVER bodies) and send (encrypt → spend a
/// token → Sphinx over the verified path).
struct LiveClient {
    addr: String,
    id: String,
    otk: String,
    ratchet: Arc<Mutex<RatchetClient>>,
    wallet: Arc<Mutex<ClientTokenWallet>>,
    received: Arc<Mutex<Vec<String>>>,
}

impl LiveClient {
    /// Initialize the Layer-3 identity + a `tokens`-token wallet, bind the
    /// receive listener, and start the decrypt loop.
    fn start(tmp: &TempDir, tag: &str, tokens: usize) -> Self {
        let (home, id, otk) = ratchet_init(tmp, tag);
        let epoch = Epoch(1);
        let issuer = Issuer::new(epoch).unwrap();
        let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
        wallet.request_batch(&issuer, tokens).unwrap();

        let ratchet = Arc::new(Mutex::new(RatchetClient::load(&home).unwrap()));
        let wallet = Arc::new(Mutex::new(wallet));

        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let received = Arc::new(Mutex::new(Vec::new()));
        let rx = received.clone();
        let rc = ratchet.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut s) = stream else { continue };
                if let Ok(Some((net::FRAME_DELIVER, body))) = net::recv_frame(&mut s)
                    && let Ok((_sender, pt)) = rc.lock().unwrap().decrypt(&body)
                {
                    rx.lock()
                        .unwrap()
                        .push(String::from_utf8_lossy(&pt).into_owned());
                }
            }
        });

        LiveClient {
            addr,
            id,
            otk,
            ratchet,
            wallet,
            received,
        }
    }

    /// Send `msg` to `peer` through the real 3-hop verified path: encrypt
    /// with the shared Double Ratchet session, spend exactly one admission
    /// token, and build+transmit the Sphinx packet (`client::send_packet`
    /// re-verifies the signed gossip list and each relay's live claim).
    /// Returns the ratchet wire bytes so tests can assert per-message key
    /// freshness.
    fn send_to(
        &self,
        cfg: &Config,
        list: &SignedRelayList,
        peer: &LiveClient,
        msg: &str,
    ) -> Vec<u8> {
        let wire = {
            let mut rc = self.ratchet.lock().unwrap();
            rc.encrypt(&peer.id, &peer.otk, msg).unwrap()
        };
        let token = {
            let mut w = self.wallet.lock().unwrap();
            w.spend_token().unwrap()
        };
        client::send_packet(cfg, list, &peer.addr, &wire, Some(&token)).unwrap();
        wire
    }

    fn wait_for_messages(&self, n: usize, timeout: Duration) -> Vec<String> {
        let deadline = std::time::Instant::now() + timeout;
        loop {
            {
                let r = self.received.lock().unwrap();
                if r.len() >= n {
                    return r.clone();
                }
            }
            if std::time::Instant::now() > deadline {
                panic!(
                    "timed out waiting for {n} messages; have {:?}",
                    self.received.lock().unwrap().clone()
                );
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}

#[test]
fn full_bidirectional_double_ratchet_session_over_real_path() {
    let tmp = TempDir::new("m4");
    let entry = RelayProcess::spawn(&["--key", &tmp.path().join("key-entry").to_string_lossy()]);
    let middle = RelayProcess::spawn(&["--key", &tmp.path().join("key-middle").to_string_lossy()]);
    let exit = RelayProcess::spawn(&["--key", &tmp.path().join("key-exit").to_string_lossy()]);

    // Two live clients, each with its own Layer-3 identity + wallet.
    let alice = LiveClient::start(&tmp, "alice", 8);
    let bob = LiveClient::start(&tmp, "bob", 8);

    // One config for both directions: [peers.bob] from alice's side,
    // [peers.alice] from bob's side.
    let cfg_path = tmp.path().join("config.toml");
    write_config(
        &cfg_path,
        (&entry.addr, &middle.addr, &exit.addr),
        &[
            ("bob", &bob.addr, &bob.id, &bob.otk),
            ("alice", &alice.addr, &alice.id, &alice.otk),
        ],
    );
    let cfg = Config::load(&cfg_path).unwrap();

    // The signed gossip list is the trust anchor for the send path.
    let list_path = tmp.path().join("relays.json");
    write_relay_list(&list_path, &[&entry, &middle, &exit]);
    let list = SignedRelayList::load_and_verify(&list_path).unwrap();

    // A → B: first message (a pre-key message; establishes the session).
    alice.send_to(&cfg, &list, &bob, "hello one");
    assert_eq!(
        bob.wait_for_messages(1, Duration::from_secs(10)),
        vec!["hello one"],
        "bob must decrypt alice's first message"
    );

    // B → A: reply. Bob's session ratchets forward; alice's outbound session
    // decrypts it — no re-handshake, no new one-time key involved.
    bob.send_to(&cfg, &list, &alice, "back at you");
    assert_eq!(
        alice.wait_for_messages(1, Duration::from_secs(10)),
        vec!["back at you"],
        "alice must decrypt bob's reply on the established session"
    );

    // A → B, twice, with the SAME plaintext. Each send uses a fresh message
    // key, so the wire bytes must differ; both must decrypt in order on the
    // established session.
    let w1 = alice.send_to(&cfg, &list, &bob, "same payload");
    let w2 = alice.send_to(&cfg, &list, &bob, "same payload");
    assert_ne!(
        w1, w2,
        "identical plaintext must produce distinct ciphertext (fresh key per message)"
    );
    assert_eq!(
        bob.wait_for_messages(3, Duration::from_secs(10)),
        vec!["hello one", "same payload", "same payload"],
        "both messages must decrypt in order on the established session"
    );
}
