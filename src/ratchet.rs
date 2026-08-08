//! Layer 3 — real message-body encryption with the Olm Double Ratchet.
//!
//! Library: `vodozemac` (Matrix's olm, Apache-2.0) — see
//! `docs/LIBRARY_SELECTION.md` §5 for the decision and the forward-secrecy /
//! break-in-recovery verification.
//!
//! Roles (a full bidirectional channel, spec §3.2 "Layer 3"):
//! - Each client owns a vodozemac [`Account`] (a curve25519 identity key plus
//!   one-time keys) persisted in its data dir.
//! - The **initial key exchange is manual/config'd for M3** (the task allows
//!   it; spec §5's bar): `unlink ratchet-init` prints the account's identity
//!   key + a fresh one-time key; the peer pastes those into its `[peers]`
//!   config entry. No live X3DH-style handshake — the library's pre-key
//!   message flow *is* the establishment step (the task permits this since
//!   the chosen library requires it).
//! - Sending: create/load the per-peer outbound session
//!   (`Account::create_outbound_session` with the peer's identity + OTK),
//!   then `Session::encrypt` — the first message is a `PreKey` message, later
//!   ones are `Normal` once the session is established.
//! - Receiving: a `PreKey` message establishes the inbound session
//!   (`Account::create_inbound_session`, which consumes the matching OTK);
//!   a `Normal` message is decrypted with the matching stored session. The
//!   sender's identity key is taken from the message itself (pre-key) or by
//!   trying each stored session on a clone (committed only on success, so a
//!   wrong candidate never mutates state) — the receiver never needs to know
//!   who sent the message in advance (anonymity preserved).
//!
//! Wire encoding inside the Sphinx payload (after the 2-byte length prefix):
//! `[u8 message_type][olm message bytes]` where message_type is 0 (pre-key)
//! or 1 (normal), matching `vodozemac::olm::MessageType`. The relay is
//! unchanged: it treats this as opaque payload and the exit delivers it
//! verbatim.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::{Result, anyhow};
use vodozemac::Curve25519PublicKey;
use vodozemac::olm::{Account, OlmMessage, Session, SessionConfig, SessionPickle};

use crate::credential::write_private;

/// Budget reserved for olm wire overhead (message type byte + version +
/// protobuf framing + 32-byte ratchet key + chain index + 16-byte nonce +
/// 8-byte truncated MAC, and for pre-key messages the identity/base/one-time
/// keys). The size test (`size_budget_respected`) pins this.
pub const OLM_WIRE_OVERHEAD: usize = 300;

const ACCOUNT_FILE: &str = "ratchet-account.json";
const SESSIONS_FILE: &str = "ratchet-sessions.json";

/// A client's Layer-3 state: one vodozemac Account plus per-peer Sessions,
/// keyed by the peer's identity key hex. Persisted in the data dir.
pub struct RatchetClient {
    home: PathBuf,
    account: Account,
    sessions: HashMap<String, Session>,
}

impl RatchetClient {
    /// Create a fresh account + one-time key and persist it. Returns
    /// `(identity_key_hex, one_time_key_hex)` to share with a peer (the
    /// manual/config'd key exchange).
    ///
    /// Refuses to overwrite an existing account: re-running `ratchet-init` on
    /// a home that already has one would silently regenerate the identity and
    /// orphan every established session — a real state-loss trap.
    pub fn init(home: &Path) -> Result<(String, String)> {
        if home.join(ACCOUNT_FILE).exists() {
            return Err(anyhow!(
                "Layer-3 ratchet state already exists at `{}` — deleting it would orphan \
                 every established session; use a fresh `--home` or remove the files \
                 deliberately",
                home.join(ACCOUNT_FILE).display()
            ));
        }
        let mut account = Account::new();
        account.generate_one_time_keys(1);
        let otk = account
            .one_time_keys()
            .values()
            .next()
            .copied()
            .ok_or_else(|| anyhow!("ratchet-init failed to generate a one-time key"))?;
        account.mark_keys_as_published();

        let id_hex = hex::encode(account.curve25519_key().to_bytes());
        let otk_hex = hex::encode(otk.to_bytes());
        let client = RatchetClient {
            home: home.to_path_buf(),
            account,
            sessions: HashMap::new(),
        };
        client.save()?;
        Ok((id_hex, otk_hex))
    }

    /// Load an existing client from its data dir. Fails with a clear error if
    /// `unlink ratchet-init` was never run here.
    pub fn load(home: &Path) -> Result<Self> {
        let account_path = home.join(ACCOUNT_FILE);
        let sessions_path = home.join(SESSIONS_FILE);
        let account_raw = std::fs::read(&account_path).map_err(|e| {
            anyhow!(
                "no Layer-3 ratchet state at `{}` — run `unlink ratchet-init` first ({e})",
                account_path.display()
            )
        })?;
        let account_pickle = serde_json::from_slice(&account_raw)
            .map_err(|e| anyhow!("cannot parse ratchet account: {e}"))?;
        let account = Account::from_pickle(account_pickle);

        let sessions = if sessions_path.exists() {
            let raw = std::fs::read(&sessions_path)?;
            let map: HashMap<String, SessionPickle> = serde_json::from_slice(&raw)
                .map_err(|e| anyhow!("cannot parse ratchet sessions: {e}"))?;
            map.into_iter()
                .map(|(id, p)| (id, Session::from_pickle(p)))
                .collect()
        } else {
            HashMap::new()
        };

        Ok(RatchetClient {
            home: home.to_path_buf(),
            account,
            sessions,
        })
    }

    /// Persist the account + sessions (0600 — they contain key material).
    pub fn save(&self) -> Result<()> {
        let account_json = serde_json::to_vec(&self.account.pickle())?;
        write_private(&self.home.join(ACCOUNT_FILE), &account_json)?;
        let sessions_json = serde_json::to_vec(
            &self
                .sessions
                .iter()
                .map(|(id, s)| (id.clone(), s.pickle()))
                .collect::<HashMap<_, _>>(),
        )?;
        write_private(&self.home.join(SESSIONS_FILE), &sessions_json)?;
        Ok(())
    }

    /// Our curve25519 identity key (hex) — the "id" half of the shared key
    /// material.
    pub fn identity_hex(&self) -> String {
        hex::encode(self.account.curve25519_key().to_bytes())
    }

    /// Encrypt a plaintext for the peer identified by `peer_id_hex`,
    /// creating the outbound session on first use with the peer's identity +
    /// one-time key (from config). Returns the wire bytes
    /// `[u8 type][olm message]`.
    pub fn encrypt(
        &mut self,
        peer_id_hex: &str,
        peer_otk_hex: &str,
        plaintext: &str,
    ) -> Result<Vec<u8>> {
        let session = match self.sessions.get_mut(peer_id_hex) {
            Some(s) => s,
            None => {
                let peer_id = Curve25519PublicKey::from_bytes(parse_hex32(peer_id_hex, "peer id")?);
                let peer_otk =
                    Curve25519PublicKey::from_bytes(parse_hex32(peer_otk_hex, "peer otk")?);
                let s = self
                    .account
                    .create_outbound_session(SessionConfig::version_1(), peer_id, peer_otk)
                    .map_err(|e| anyhow!("cannot create outbound session: {e}"))?;
                self.sessions.insert(peer_id_hex.to_string(), s);
                self.sessions.get_mut(peer_id_hex).unwrap()
            }
        };

        let msg = session
            .encrypt(plaintext.as_bytes())
            .map_err(|e| anyhow!("ratchet encrypt failed: {e}"))?;
        self.save()?;
        Ok(to_wire(&msg))
    }

    /// Decrypt an incoming wire body `[u8 type][olm message]`. Returns the
    /// sender's identity key hex (from the pre-key message, or the session
    /// that matched) and the plaintext. On a `PreKey` message a new inbound
    /// session is established; on a `Normal` message each stored session is
    /// tried on a clone and committed only on success.
    pub fn decrypt(&mut self, wire: &[u8]) -> Result<(String, Vec<u8>)> {
        let olm = from_wire(wire)?;
        match &olm {
            OlmMessage::PreKey(pkm) => {
                let sender_hex = hex::encode(pkm.identity_key().to_bytes());
                if let Some(session) = self.sessions.get_mut(&sender_hex) {
                    // Session already established (e.g. a second pre-key from
                    // the same sender before we replied): decrypt with it.
                    let pt = session
                        .decrypt(&olm)
                        .map_err(|e| anyhow!("ratchet decrypt failed: {e}"))?;
                    self.save()?;
                    return Ok((sender_hex, pt));
                }
                let result = self
                    .account
                    .create_inbound_session(SessionConfig::version_1(), pkm.identity_key(), pkm)
                    .map_err(|e| anyhow!("cannot establish inbound session: {e}"))?;
                let plaintext = result.plaintext;
                self.sessions.insert(sender_hex.clone(), result.session);
                self.save()?;
                Ok((sender_hex, plaintext))
            }
            OlmMessage::Normal(_) => {
                // Try each stored session on an independent copy (the crate's
                // `Session` is not `Clone`, so the copy is made via its own
                // pickle — the crate's intended serialization round trip);
                // commit only on success. The copy isolates the trial: even if
                // the crate's decrypt partially mutates state on a failed MAC
                // (e.g. a receiver-chain key lookup), only a successful
                // candidate is ever committed, so a wrong candidate can never
                // corrupt a valid session. Copy the candidates out of the map
                // first so we can mutate the map on success.
                let candidates: Vec<(String, Session)> = self
                    .sessions
                    .iter()
                    .map(|(id, s)| (id.clone(), Session::from_pickle(s.pickle())))
                    .collect();
                for (id, mut candidate) in candidates {
                    if let Ok(pt) = candidate.decrypt(&olm) {
                        self.sessions.insert(id.clone(), candidate);
                        self.save()?;
                        return Ok((id, pt));
                    }
                }
                Err(anyhow!(
                    "no session matched the incoming message (was the peer re-initialized? \
                     re-run `unlink ratchet-init` on both sides)"
                ))
            }
        }
    }
}

/// Encode an OlmMessage as `[u8 type][olm bytes]`.
fn to_wire(msg: &OlmMessage) -> Vec<u8> {
    let (ty, bytes) = msg.to_parts();
    let mut out = Vec::with_capacity(1 + bytes.len());
    out.push(ty as u8);
    out.extend_from_slice(&bytes);
    out
}

/// Parse `[u8 type][olm bytes]` back into an OlmMessage.
fn from_wire(wire: &[u8]) -> Result<OlmMessage> {
    if wire.is_empty() {
        return Err(anyhow!("empty ratchet message on the wire"));
    }
    OlmMessage::from_parts(wire[0] as usize, &wire[1..])
        .map_err(|e| anyhow!("cannot parse ratchet message: {e}"))
}

/// Parse a 32-byte hex-encoded key.
fn parse_hex32(s: &str, what: &str) -> Result<[u8; 32]> {
    let bytes = hex::decode(s).map_err(|e| anyhow!("bad {what} (hex): {e}"))?;
    <[u8; 32]>::try_from(bytes.as_slice())
        .map_err(|_| anyhow!("{what} must be 32 bytes (64 hex chars)"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home(tag: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "unlink-ratchet-{tag}-{}-{}",
            std::process::id(),
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    /// Establish a bidirectional channel between two clients (Alice has
    /// Bob's identity + OTK in her config; Bob has Alice's identity in his).
    /// Returns (alice, bob, alice_id_hex, bob_id_hex).
    fn channel() -> (RatchetClient, RatchetClient, String, String) {
        let a_home = temp_home("a");
        let b_home = temp_home("b");
        let (a_id, _a_otk) = RatchetClient::init(&a_home).unwrap();
        let (b_id, b_otk) = RatchetClient::init(&b_home).unwrap();
        let mut alice = RatchetClient::load(&a_home).unwrap();
        let mut bob = RatchetClient::load(&b_home).unwrap();

        // Alice's first message is a pre-key message; Bob establishes the
        // inbound session from it.
        let wire = alice.encrypt(&b_id, &b_otk, "first").unwrap();
        let (sender, pt) = bob.decrypt(&wire).unwrap();
        assert_eq!(sender, a_id);
        assert_eq!(pt, b"first");
        (alice, bob, a_id, b_id)
    }

    #[test]
    fn session_round_trip_bidirectional() {
        let (mut alice, mut bob, a_id, b_id) = channel();

        // Alice sends again (still a pre-key until she receives a reply).
        let wire = alice.encrypt(&b_id, "otk-unused", "second").unwrap();
        let (sender, pt) = bob.decrypt(&wire).unwrap();
        assert_eq!(sender, a_id);
        assert_eq!(pt, b"second");

        // Bob replies: his session is established, so this is a Normal
        // message; Alice decrypts with her stored session.
        let reply = bob.encrypt(&a_id, "otk-unused", "back at you").unwrap();
        let (sender, pt) = alice.decrypt(&reply).unwrap();
        assert_eq!(sender, b_id);
        assert_eq!(pt, b"back at you");
    }

    #[test]
    fn message_n_plus_one_does_not_decrypt_with_message_n_key() {
        let (mut alice, mut bob, _a_id, b_id) = channel();

        // Encrypt two messages with the same plaintext.
        let wire1 = alice.encrypt(&b_id, "otk-unused", "same payload").unwrap();
        let wire2 = alice.encrypt(&b_id, "otk-unused", "same payload").unwrap();
        // Fresh key per message: identical plaintext must not produce
        // identical ciphertext.
        assert_ne!(wire1, wire2, "every message must use a fresh message key");

        // Bob decrypts message 1 (ratchet advances), then message 2.
        let pt1 = bob.decrypt(&wire1).unwrap();
        assert_eq!(pt1.1, b"same payload");
        let pt2 = bob.decrypt(&wire2).unwrap();
        assert_eq!(pt2.1, b"same payload");

        // Forward secrecy: message 1's key was erased after use — replaying
        // wire1 after the session has advanced must FAIL, as must replaying
        // wire2 after wire2's key was consumed.
        assert!(
            bob.decrypt(&wire1).is_err(),
            "message N must not decrypt with the post-N state (key erased)"
        );
        assert!(
            bob.decrypt(&wire2).is_err(),
            "message N+1 must not decrypt twice (single-use message key)"
        );
    }

    #[test]
    fn persistence_round_trip() {
        let (mut alice, bob, _a_id, b_id) = channel();
        let a_home = alice.home.clone();
        let b_home = bob.home.clone();
        let wire = alice.encrypt(&b_id, "otk-unused", "persisted").unwrap();
        drop(alice);
        drop(bob);

        // Reloading both sides must continue the channel seamlessly.
        let mut alice2 = RatchetClient::load(&a_home).unwrap();
        let mut bob2 = RatchetClient::load(&b_home).unwrap();
        let (_sender, pt) = bob2.decrypt(&wire).unwrap();
        assert_eq!(pt, b"persisted");

        // And the reply direction survives a reload on both sides.
        let a_id2 = alice2.identity_hex();
        let reply = bob2.encrypt(&a_id2, "otk-unused", "back at you").unwrap();
        let (_, got) = alice2.decrypt(&reply).unwrap();
        assert_eq!(got, b"back at you");
    }

    #[test]
    fn init_prints_shareable_keys() {
        let home = temp_home("keys");
        let (id, otk) = RatchetClient::init(&home).unwrap();
        assert_eq!(id.len(), 64);
        assert_eq!(otk.len(), 64);
        let client = RatchetClient::load(&home).unwrap();
        assert_eq!(client.identity_hex(), id);
    }

    /// The plaintext budget must account for olm wire overhead: a
    /// max-length message plus our [u8 type] byte and 2-byte length prefix
    /// must fit inside the Sphinx payload budget.
    #[test]
    fn size_budget_respected() {
        use crate::client::MAX_MSG_LEN;
        use sphinx_packet::constants::PAYLOAD_SIZE;
        use sphinx_packet::payload::PAYLOAD_OVERHEAD_SIZE;

        let home = temp_home("size");
        let (id, otk) = RatchetClient::init(&home).unwrap();
        let mut client = RatchetClient::load(&home).unwrap();
        let plaintext = "x".repeat(MAX_MSG_LEN);
        let wire = client.encrypt(&id, &otk, &plaintext).unwrap();
        // payload = [u16 len][u8 type][olm bytes]
        let budget = PAYLOAD_SIZE - PAYLOAD_OVERHEAD_SIZE;
        assert!(
            2 + wire.len() <= budget,
            "wire {} B + 2 B prefix exceeds payload budget {budget} B \
             (raise OLM_WIRE_OVERHEAD or lower MAX_MSG_LEN)",
            wire.len()
        );
    }
}
