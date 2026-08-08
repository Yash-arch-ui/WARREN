//! Reputation-gated admission via blind-signature tokens (M2).
//!
//! Library: `blind-rsa-signatures` (RFC 9474 — the Privacy Pass v1 primitive).
//! See `docs/LIBRARY_SELECTION.md` §2 for why, and for exactly what
//! unlinkability guarantee this gives us (and where it stops).
//!
//! Roles:
//! - [`Issuer`]          — signs *blinded* token nonces. Only ever sees
//!   `BlindMessage`s, never the unblinded tokens clients later redeem.
//! - [`ClientTokenWallet`] — holds a batch of unblinded tokens; spends each
//!   exactly once (`spend_token` pops, so reuse is impossible by construction).
//! - [`RelayAdmission`]   — verifies a token is signed by the issuer and not
//!   already spent (epoch-scoped double-spend set).
//!
//! Wire proof format (attached ahead of the mix-wrapped packet, checked by
//! the entry relay *before* any mix-layer unwrapping — see `docs/THREAT_MODEL.md`
//! §4): `[u64 BE epoch][nonce: 32][msg_randomizer: 32][u16 BE sig_len][sig]`.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use anyhow::{Result, anyhow};
use blind_rsa_signatures::{
    BlindMessage, BlindSignature, BlindingResult, DefaultRng, KeyPair, MessageRandomizer, PSS,
    PublicKey, Randomized, SecretKey, Sha384, Signature,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const DEFAULT_BATCH_SIZE: usize = 10;
pub const TOKEN_NONCE_LEN: usize = 32;

/// Epoch for token issuance/redemption. M2 uses daily epochs by default;
/// tests pass explicit epochs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Epoch(pub u64);

impl Epoch {
    pub fn now() -> Self {
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        Epoch(secs / 86_400)
    }
}

pub type BlindRsaPublicKey = PublicKey<Sha384, PSS, Randomized>;

/// One spendable token. `nonce` + `msg_randomizer` are client-chosen random
/// values the issuer never sees; `signature` is the issuer's RSA signature
/// over them (obtained via the blind-signature flow).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Token {
    pub epoch: Epoch,
    #[serde(with = "hex")]
    pub nonce: [u8; TOKEN_NONCE_LEN],
    #[serde(with = "hex")]
    pub msg_randomizer: [u8; TOKEN_NONCE_LEN],
    #[serde(with = "hex")]
    pub signature: Vec<u8>,
}

impl Token {
    /// Deterministic token identifier, recorded by relays for double-spend
    /// detection. Derived only from client-chosen randomness — the issuer
    /// (who saw only the blinded messages) cannot compute it, so it cannot
    /// link a redemption back to an issuance. See
    /// `docs/LIBRARY_SELECTION.md` §2 "what we actually get".
    pub fn id(&self) -> [u8; TOKEN_NONCE_LEN] {
        let mut h = Sha256::new();
        h.update(self.nonce);
        h.update(self.msg_randomizer);
        h.finalize().into()
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(8 + 32 + 32 + 2 + self.signature.len());
        out.extend_from_slice(&self.epoch.0.to_be_bytes());
        out.extend_from_slice(&self.nonce);
        out.extend_from_slice(&self.msg_randomizer);
        out.extend_from_slice(&(self.signature.len() as u16).to_be_bytes());
        out.extend_from_slice(&self.signature);
        out
    }

    pub fn deserialize(bytes: &[u8]) -> Result<Self> {
        if bytes.len() < 8 + 32 + 32 + 2 {
            return Err(anyhow!("token proof too short"));
        }
        let epoch = u64::from_be_bytes(bytes[0..8].try_into().unwrap());
        let nonce: [u8; 32] = bytes[8..40].try_into().unwrap();
        let msg_randomizer: [u8; 32] = bytes[40..72].try_into().unwrap();
        let sig_len = u16::from_be_bytes(bytes[72..74].try_into().unwrap()) as usize;
        if bytes.len() != 74 + sig_len {
            return Err(anyhow!("token proof length mismatch"));
        }
        Ok(Token {
            epoch: Epoch(epoch),
            nonce,
            msg_randomizer,
            signature: bytes[74..].to_vec(),
        })
    }
}

/// The blind-signature issuer. Holds the RSA keypair for one epoch.
///
/// M2 bootstrap: eligibility to *receive* a batch is NOT implemented — spec
/// §4 leaves it an open question (with the §PoW caveat). For now we gate it
/// behind a trivial "one batch per client-id, ever" rule so the token
/// mechanics can be tested end-to-end. TODO(M-later): real reputation/PoW-
/// gated issuance and a per-epoch re-issuance policy.
pub struct Issuer {
    keypair: KeyPair<Sha384, PSS, Randomized>,
    pub epoch: Epoch,
    batches_granted: HashMap<String, usize>,
}

impl Issuer {
    pub fn new(epoch: Epoch) -> Result<Self> {
        // 2048-bit RSA (matches RFC 9474 test vectors; 3072/4096 supported).
        let keypair = KeyPair::<Sha384, PSS, Randomized>::generate(&mut DefaultRng, 2048)?;
        Ok(Self {
            keypair,
            epoch,
            batches_granted: HashMap::new(),
        })
    }

    /// Load the issuer keypair from `key_path` if it exists (so a re-run of
    /// `token-issue` reuses the same issuer and already-configured relays keep
    /// accepting tokens), otherwise generate a fresh one. M3: the real
    /// issuer deployment splits issuance over the network and keeps this key
    /// out of the client's data dir entirely.
    pub fn load_or_new(key_path: Option<&Path>, epoch: Epoch) -> Result<Self> {
        let keypair = match key_path {
            Some(path) if path.exists() => {
                let pem = std::fs::read_to_string(path)?;
                let sk = SecretKey::<Sha384, PSS, Randomized>::from_pem(&pem)?;
                let pk = sk.public_key()?;
                KeyPair { pk, sk }
            }
            _ => KeyPair::<Sha384, PSS, Randomized>::generate(&mut DefaultRng, 2048)?,
        };
        Ok(Self {
            keypair,
            epoch,
            batches_granted: HashMap::new(),
        })
    }

    pub fn public_key_pem(&self) -> Result<String> {
        Ok(self.keypair.pk.to_pem()?)
    }

    pub fn private_key_pem(&self) -> Result<String> {
        Ok(self.keypair.sk.to_pem()?)
    }

    /// Sign a blinded message. This is the *entire* view the issuer gets of
    /// a token: it never sees the nonce, the randomizer, or the final token.
    pub fn blind_sign(&self, blind: &BlindMessage) -> Result<BlindSignature> {
        Ok(self.keypair.sk.blind_sign(blind)?)
    }

    /// Bootstrap stub — see struct docs. Exactly one batch per client-id.
    pub fn grant_batch(&mut self, client_id: &str) -> Result<()> {
        if self.batches_granted.get(client_id).copied().unwrap_or(0) >= 1 {
            return Err(anyhow!(
                "client `{client_id}` has already been granted a batch (M2 bootstrap stub: \
                 one batch per client-id — real eligibility is spec §4, TODO M-later)"
            ));
        }
        self.batches_granted.insert(client_id.to_string(), 1);
        Ok(())
    }
}

/// Client-side wallet: holds unspent tokens for one epoch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientTokenWallet {
    pub epoch: Epoch,
    pub issuer_pub_pem: String,
    tokens: Vec<Token>,
}

impl ClientTokenWallet {
    pub fn new(epoch: Epoch, issuer_pub_pem: String) -> Self {
        Self {
            epoch,
            issuer_pub_pem,
            tokens: Vec::new(),
        }
    }

    pub fn token_count(&self) -> usize {
        self.tokens.len()
    }

    pub fn is_empty(&self) -> bool {
        self.tokens.is_empty()
    }

    pub fn unspent_tokens(&self) -> &[Token] {
        &self.tokens
    }

    fn issuer_public_key(&self) -> Result<BlindRsaPublicKey> {
        PublicKey::from_pem(&self.issuer_pub_pem).map_err(|e| anyhow!("bad issuer pubkey: {e}"))
    }

    /// Run the blind-issuance flow for `count` fresh tokens.
    ///
    /// The wallet plays the client role: it blinds fresh random nonces, hands
    /// only the `BlindMessage`s to the issuer, and finalizes locally. The
    /// two-party separation is preserved — `Issuer::blind_sign` cannot tell
    /// which of its signatures corresponds to which unblinded token.
    pub fn request_batch(&mut self, issuer: &Issuer, count: usize) -> Result<()> {
        if issuer.epoch != self.epoch {
            return Err(anyhow!(
                "issuer epoch {} does not match wallet epoch {}",
                issuer.epoch.0,
                self.epoch.0
            ));
        }
        let pk = self.issuer_public_key()?;
        let mut blinds: Vec<BlindingResult> = Vec::with_capacity(count);
        let mut nonces: Vec<[u8; TOKEN_NONCE_LEN]> = Vec::with_capacity(count);
        for _ in 0..count {
            let nonce: [u8; TOKEN_NONCE_LEN] = rand::random();
            let blind = pk.blind(&mut DefaultRng, nonce)?;
            blinds.push(blind);
            nonces.push(nonce);
        }
        for (nonce, blind) in nonces.into_iter().zip(blinds) {
            let blind_sig = issuer.blind_sign(&blind.blind_message)?;
            let sig = pk.finalize(&blind_sig, &blind, nonce)?;
            let randomizer = blind
                .msg_randomizer
                .ok_or_else(|| anyhow!("Randomized mode must produce a msg_randomizer"))?;
            self.tokens.push(Token {
                epoch: self.epoch,
                nonce,
                msg_randomizer: randomizer.0,
                signature: sig.0,
            });
        }
        Ok(())
    }

    /// Spend exactly one token. Popping guarantees a spent token can never be
    /// re-presented by this wallet. Clean error when empty — callers surface
    /// this to the user (see `client::send`).
    pub fn spend_token(&mut self) -> Result<Token> {
        self.tokens.pop().ok_or_else(|| {
            anyhow!(
                "out of tokens for epoch {} — run `unlink token-issue` or wait for the next epoch",
                self.epoch.0
            )
        })
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_vec_pretty(self)?;
        write_private(path, &json)?;
        Ok(())
    }

    pub fn load(path: &Path) -> Result<Self> {
        let raw = std::fs::read(path)
            .map_err(|e| anyhow!("cannot read wallet `{}`: {e}", path.display()))?;
        serde_json::from_slice(&raw).map_err(|e| anyhow!("cannot parse wallet: {e}"))
    }
}

/// Relay-side admission gate.
pub struct RelayAdmission {
    issuer_pubkey: BlindRsaPublicKey,
    pub epoch: Epoch,
    /// Epoch-scoped double-spend set. Storage tradeoff: kept per-epoch and
    /// dropped on rollover (see [`RelayAdmission::rollover`]) — retaining all
    /// epochs forever would grow unboundedly *and* let a relay build
    /// cross-epoch token profiles. Replay across epochs is blocked by the
    /// epoch check below (tokens are epoch-bound), so dropping old sets only
    /// loses the ability to detect cross-epoch replay of a *stolen* old token.
    spent: HashSet<[u8; TOKEN_NONCE_LEN]>,
}

pub enum AdmissionDecision {
    Admit,
    Deny { reason: String },
}

impl RelayAdmission {
    pub fn from_pem(pem: &str, epoch: Epoch) -> Result<Self> {
        let issuer_pubkey =
            PublicKey::from_pem(pem).map_err(|e| anyhow!("bad issuer public key: {e}"))?;
        Ok(Self {
            issuer_pubkey,
            epoch,
            spent: HashSet::new(),
        })
    }

    /// Verify a token and, if valid, mark it spent.
    pub fn check_and_mark(&mut self, token: &Token) -> AdmissionDecision {
        if token.epoch != self.epoch {
            return AdmissionDecision::Deny {
                reason: format!(
                    "wrong-epoch (token {}, relay {})",
                    token.epoch.0, self.epoch.0
                ),
            };
        }
        let sig = Signature(token.signature.clone());
        let randomizer = MessageRandomizer(token.msg_randomizer);
        if self
            .issuer_pubkey
            .verify(&sig, Some(randomizer), token.nonce)
            .is_err()
        {
            return AdmissionDecision::Deny {
                reason: "invalid-signature".into(),
            };
        }
        let id = token.id();
        if self.spent.contains(&id) {
            return AdmissionDecision::Deny {
                reason: "already-spent".into(),
            };
        }
        self.spent.insert(id);
        AdmissionDecision::Admit
    }

    /// Epoch rollover: reset the double-spend set for a new epoch.
    pub fn rollover(&mut self, new_epoch: Epoch) {
        self.spent.clear();
        self.epoch = new_epoch;
    }

    pub fn spent_count(&self) -> usize {
        self.spent.len()
    }
}

/// Write a file with 0600 permissions (identity/wallet material).
///
/// `pub` because the CLI (a separate crate from the lib) persists keys/wallets
/// through it; treat it as an internal utility.
pub fn write_private(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)?;
    f.write_all(bytes)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_issuer_and_wallet(epoch: u64, count: usize) -> (Issuer, ClientTokenWallet) {
        let epoch = Epoch(epoch);
        let issuer = Issuer::new(epoch).unwrap();
        let mut wallet = ClientTokenWallet::new(epoch, issuer.public_key_pem().unwrap());
        wallet.request_batch(&issuer, count).unwrap();
        (issuer, wallet)
    }

    #[test]
    fn issuance_redemption_round_trip_and_single_use() {
        let (_issuer, mut wallet) = make_issuer_and_wallet(1, 5);
        let pem = wallet.issuer_pub_pem.clone();
        let mut relay = RelayAdmission::from_pem(&pem, Epoch(1)).unwrap();

        let tokens: Vec<Token> = (0..5).map(|_| wallet.spend_token().unwrap()).collect();

        // All five valid tokens pass exactly once...
        for t in &tokens {
            match relay.check_and_mark(t) {
                AdmissionDecision::Admit => {}
                AdmissionDecision::Deny { reason } => panic!("should admit, got {reason}"),
            }
        }
        assert_eq!(relay.spent_count(), 5);

        // ...and replaying any of them is denied.
        for t in &tokens {
            match relay.check_and_mark(t) {
                AdmissionDecision::Deny { reason } => assert_eq!(reason, "already-spent"),
                AdmissionDecision::Admit => panic!("replay must be denied"),
            }
        }
    }

    #[test]
    fn tampered_signature_denied() {
        let (_issuer, mut wallet) = make_issuer_and_wallet(1, 1);
        let mut token = wallet.spend_token().unwrap();
        token.signature[0] ^= 0xff;
        let mut relay = RelayAdmission::from_pem(&wallet.issuer_pub_pem, Epoch(1)).unwrap();
        match relay.check_and_mark(&token) {
            AdmissionDecision::Deny { reason } => assert_eq!(reason, "invalid-signature"),
            AdmissionDecision::Admit => panic!("tampered sig must be denied"),
        }
    }

    #[test]
    fn wrong_epoch_denied_and_rollover_resets() {
        let (_issuer, mut wallet) = make_issuer_and_wallet(1, 2);
        let token = wallet.spend_token().unwrap();

        let mut relay = RelayAdmission::from_pem(&wallet.issuer_pub_pem, Epoch(2)).unwrap();
        match relay.check_and_mark(&token) {
            AdmissionDecision::Deny { reason } => assert!(reason.starts_with("wrong-epoch")),
            AdmissionDecision::Admit => panic!("wrong epoch must be denied"),
        }

        // Same token admitted in epoch 1, then the set is dropped on rollover.
        let mut relay = RelayAdmission::from_pem(&wallet.issuer_pub_pem, Epoch(1)).unwrap();
        assert!(matches!(
            relay.check_and_mark(&token),
            AdmissionDecision::Admit
        ));
        relay.rollover(Epoch(2));
        assert_eq!(relay.spent_count(), 0);
    }

    #[test]
    fn bootstrap_stub_grants_one_batch_per_client() {
        let mut issuer = Issuer::new(Epoch(1)).unwrap();
        issuer.grant_batch("alice").unwrap();
        assert!(issuer.grant_batch("alice").is_err());
        issuer.grant_batch("bob").unwrap();
    }

    /// The property that actually matters (the M2 integration test re-checks it
    /// over the wire): the relay's double-spend identifiers are derived from
    /// client-chosen randomness the issuer never saw. Here we run the issuance
    /// flow manually, capture the issuer's entire transcript (the
    /// `BlindMessage`s), and verify there is no trivial mapping from that
    /// transcript to any token id — and that no two redemptions collide onto
    /// one identifier. (The deeper guarantee is information-theoretic: RSA
    /// blinding makes the redemption transcript independent of the issuance
    /// transcript; this test pins the observable, code-checkable part.)
    #[test]
    fn token_ids_not_derivable_from_issuance_view() {
        let epoch = Epoch(1);
        let issuer = Issuer::new(epoch).unwrap();
        let pem = issuer.public_key_pem().unwrap();
        let pk: BlindRsaPublicKey = PublicKey::from_pem(&pem).unwrap();

        let mut blind_messages: Vec<Vec<u8>> = Vec::new();
        let mut tokens = Vec::new();
        for _ in 0..5 {
            let nonce: [u8; TOKEN_NONCE_LEN] = rand::random();
            let blind = pk.blind(&mut DefaultRng, nonce).unwrap();
            blind_messages.push(blind.blind_message.0.clone());
            let blind_sig = issuer.blind_sign(&blind.blind_message).unwrap();
            let sig = pk.finalize(&blind_sig, &blind, nonce).unwrap();
            let randomizer = blind.msg_randomizer.unwrap().0;
            tokens.push(Token {
                epoch,
                nonce,
                msg_randomizer: randomizer,
                signature: sig.0,
            });
        }

        let blind_hashes: Vec<[u8; 32]> = blind_messages
            .iter()
            .map(|b| Sha256::digest(b).into())
            .collect();
        for t in &tokens {
            let id = t.id();
            assert!(
                !blind_hashes.contains(&id),
                "token id is trivially derivable from the issuer's transcript"
            );
        }
        for i in 0..tokens.len() {
            for j in (i + 1)..tokens.len() {
                assert_ne!(tokens[i].id(), tokens[j].id(), "token ids must be distinct");
            }
        }
    }

    #[test]
    fn wallet_persistence_round_trip() {
        let (issuer, wallet) = make_issuer_and_wallet(7, 3);
        let path = std::env::temp_dir().join(format!("unlink-wallet-test-{}", std::process::id()));
        wallet.save(&path).unwrap();
        let loaded = ClientTokenWallet::load(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(loaded.token_count(), 3);
        assert_eq!(loaded.epoch, Epoch(7));
        assert_eq!(loaded.unspent_tokens(), wallet.unspent_tokens());
        assert_eq!(issuer.epoch, Epoch(7));
    }

    #[test]
    fn issuer_key_persists_and_reloads() {
        let epoch = Epoch(1);
        let issuer = Issuer::new(epoch).unwrap();
        let pem = issuer.private_key_pem().unwrap();
        let path = std::env::temp_dir().join(format!("unlink-issuer-key-{}", std::process::id()));
        std::fs::write(&path, &pem).unwrap();
        let reloaded = Issuer::load_or_new(Some(&path), epoch).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(
            reloaded.public_key_pem().unwrap(),
            issuer.public_key_pem().unwrap(),
            "reloaded issuer must have the same public key"
        );
    }

    #[test]
    fn token_serialization_round_trip() {
        let (_issuer, mut wallet) = make_issuer_and_wallet(1, 1);
        let token = wallet.spend_token().unwrap();
        let bytes = token.serialize();
        let parsed = Token::deserialize(&bytes).unwrap();
        assert_eq!(parsed, token);
    }
}
