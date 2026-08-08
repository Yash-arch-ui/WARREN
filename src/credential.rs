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
/// Bootstrap (M6): eligibility to *receive* a batch is gated by a
/// **SHA-256 proof of work** ([`pow`]) — the spec §4/§9 answer to "how does a
/// client earn a batch without an identity check that reintroduces
/// linkability". The issuer hands out a per-request challenge bound to
/// `(client_id, epoch)`; the client mines it; `grant_batch` verifies the
/// difficulty (tunable, [`Issuer::set_pow_bits`]) and then grants **one batch
/// per (client_id, epoch)** — fresh tokens each epoch for established users,
/// while each *new* identity (Sybil) must pay the proof-of-work cost. The
/// honest bound (not a Sybil wall — an attacker's supply scales with their
/// hashrate) is in `docs/THREAT_MODEL.md` §3.2. The blind-signature
/// mechanics are unchanged: this gate runs before them and is invisible to
/// redemption.
pub struct Issuer {
    keypair: KeyPair<Sha384, PSS, Randomized>,
    pub epoch: Epoch,
    /// Proof-of-work difficulty (leading zero bits required on the challenge
    /// hash). 0 disables the gate. See [`pow::DEFAULT_POW_BITS`].
    pow_bits: u32,
    /// Per-(client, epoch) batch accounting: one batch each. Grows by one
    /// entry per (client, epoch) granted — acceptable for the dev-tool
    /// issuer; a long-lived network issuer would epoch-scope this map the
    /// way `RelayAdmission` scopes its double-spend set.
    batches_granted: HashMap<(String, Epoch), usize>,
    /// Issued-but-not-yet-granted challenges (per-request nonce, single
    /// use): `client_id -> (challenge, epoch)`. At most **one per client** —
    /// requesting another while one is pending is an explicit error, so a
    /// stale challenge is never silently overwritten.
    pending: HashMap<String, ([u8; 32], Epoch)>,
}

impl Issuer {
    pub fn new(epoch: Epoch) -> Result<Self> {
        Self::with_pow_bits(epoch, crate::pow::DEFAULT_POW_BITS)
    }

    /// Like [`Issuer::new`], with an explicit proof-of-work difficulty.
    pub fn with_pow_bits(epoch: Epoch, pow_bits: u32) -> Result<Self> {
        // 2048-bit RSA (matches RFC 9474 test vectors; 3072/4096 supported).
        let keypair = KeyPair::<Sha384, PSS, Randomized>::generate(&mut DefaultRng, 2048)?;
        Ok(Self {
            keypair,
            epoch,
            pow_bits,
            batches_granted: HashMap::new(),
            pending: HashMap::new(),
        })
    }

    /// Override the proof-of-work difficulty (tunable per deployment, same
    /// pattern as `delay_ms` being config'd rather than fixed). `bits` is the
    /// required leading-zero-bit count of the challenge hash; 0 disables the
    /// gate.
    pub fn set_pow_bits(&mut self, bits: u32) -> Result<()> {
        if bits > 48 {
            anyhow::bail!(
                "pow_bits {bits} exceeds the practical cap of 48 (beyond ~2^40 the solve \
                 is infeasible anyway; the cap also keeps `pow::mine`'s u64 counter from \
                 ever overflowing)"
            );
        }
        self.pow_bits = bits;
        Ok(())
    }

    pub fn pow_bits(&self) -> u32 {
        self.pow_bits
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
            pow_bits: crate::pow::DEFAULT_POW_BITS,
            batches_granted: HashMap::new(),
            pending: HashMap::new(),
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

    /// Issue a per-request proof-of-work challenge for `client_id`. The
    /// challenge binds the work to `(fresh nonce, client_id, epoch)` — a
    /// solution is not reusable across clients, epochs, or grants. Fails fast
    /// if the client already holds a batch this epoch (no wasted mining).
    /// The returned challenge is **single-use**: consumed by the matching
    /// [`Issuer::grant_batch`].
    pub fn pow_challenge(&mut self, client_id: &str, epoch: Epoch) -> Result<[u8; 32]> {
        if self
            .batches_granted
            .contains_key(&(client_id.to_string(), epoch))
        {
            anyhow::bail!(
                "client `{client_id}` already has a batch for epoch {} — \
                 one batch per (client, epoch)",
                epoch.0
            );
        }
        if self.pending.contains_key(client_id) {
            anyhow::bail!(
                "client `{client_id}` already has an issued-but-unused proof-of-work \
                 challenge — present it (or let it expire) before requesting another; \
                 challenges are single-use and never silently overwritten"
            );
        }
        let nonce: [u8; TOKEN_NONCE_LEN] = rand::random();
        let challenge = crate::pow::challenge(&nonce, client_id, epoch.0);
        self.pending
            .insert(client_id.to_string(), (challenge, epoch));
        Ok(challenge)
    }

    /// Grant one batch to `client_id` for `epoch`, provided the client
    /// presents a valid proof of work for the challenge previously issued via
    /// [`Issuer::pow_challenge`] (at the issuer's configured difficulty).
    /// This is the M6 replacement for the M2 "one batch ever" bootstrap stub:
    /// the cost of a *new* identity is the proof of work, while established
    /// users re-earn one batch each epoch for the same work. PoW is verified
    /// *before* the (unchanged) blind-signature flow; redemption never sees
    /// it.
    pub fn grant_batch(&mut self, client_id: &str, epoch: Epoch, counter: u64) -> Result<()> {
        let (challenge, challenge_epoch) = self.pending.remove(client_id).ok_or_else(|| {
            anyhow!(
                "no pending proof-of-work challenge for `{client_id}` — \
                 call `unlink token-issue` / Issuer::pow_challenge first"
            )
        })?;
        if challenge_epoch != epoch {
            return Err(anyhow!(
                "proof-of-work challenge for `{client_id}` was issued for epoch {}, \
                 not {}",
                challenge_epoch.0,
                epoch.0
            ));
        }
        if !crate::pow::verify(&challenge, counter, self.pow_bits) {
            return Err(anyhow!(
                "proof of work for `{client_id}` does not meet difficulty {} \
                 (expected ~2^{} hashes)",
                self.pow_bits,
                self.pow_bits
            ));
        }
        let key = (client_id.to_string(), epoch);
        if self.batches_granted.contains_key(&key) {
            return Err(anyhow!(
                "client `{client_id}` already has a batch for epoch {} — \
                 one batch per (client, epoch)",
                epoch.0
            ));
        }
        self.batches_granted.insert(key, 1);
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

    /// Helper: complete the full PoW grant flow for `client_id` at the issuer's
    /// difficulty, returning the counter found (hashes tried = counter + 1).
    fn grant_with_pow(issuer: &mut Issuer, client_id: &str, epoch: Epoch) -> u64 {
        let challenge = issuer.pow_challenge(client_id, epoch).unwrap();
        let counter = crate::pow::mine(&challenge, issuer.pow_bits());
        issuer.grant_batch(client_id, epoch, counter).unwrap();
        counter
    }

    #[test]
    fn pow_gate_grants_one_batch_per_client_per_epoch() {
        // The M6 replacement for the M2 stub: each (client, epoch) is granted
        // once, and only with a valid proof of work.
        let mut issuer = Issuer::with_pow_bits(Epoch(1), 10).unwrap();

        // A valid solution grants one batch for this client + epoch. (Real
        // work is verified statistically in tests/m7_bootstrap.rs; a single
        // solve can occasionally succeed on trial 0 with P ≈ 2^-10.)
        grant_with_pow(&mut issuer, "alice", Epoch(1));

        // Re-grant for the same (client, epoch) is refused even with a fresh,
        // valid proof of work — one batch per (client, epoch).
        let chal = issuer.pow_challenge("alice", Epoch(1)).unwrap_err();
        assert!(chal.to_string().contains("already has a batch"));

        // Another client can still get a batch.
        grant_with_pow(&mut issuer, "bob", Epoch(1));

        // A new epoch re-enables the established client (fresh tokens per
        // epoch is the intended policy, not a lockout).
        grant_with_pow(&mut issuer, "alice", Epoch(2));
    }

    #[test]
    fn pow_gate_rejects_insufficient_or_misbound_work() {
        let mut issuer = Issuer::with_pow_bits(Epoch(1), 10).unwrap();

        // No challenge issued yet → grant refused (nothing to verify).
        assert!(issuer.grant_batch("dave", Epoch(1), 0).is_err());

        // A solution mined for the right client but a different epoch is
        // refused.
        let chal_e2 = issuer.pow_challenge("dave", Epoch(2)).unwrap();
        let counter_e2 = crate::pow::mine(&chal_e2, 10);
        assert!(issuer.grant_batch("dave", Epoch(1), counter_e2).is_err());
        // ...and the pending challenge was *consumed* by the failed attempt,
        // so the solution cannot be replayed later.
        assert!(issuer.grant_batch("dave", Epoch(2), counter_e2).is_err());

        // A solution mined for a different client's challenge is refused
        // (the challenge binds client_id).
        let chal_eve = issuer.pow_challenge("eve", Epoch(1)).unwrap();
        let counter_eve = crate::pow::mine(&chal_eve, 10);
        // frank has his own (distinct) pending challenge; eve's counter,
        // mined over a different challenge, must not satisfy it.
        let _ = issuer.pow_challenge("frank", Epoch(1)).unwrap();
        assert!(issuer.grant_batch("frank", Epoch(1), counter_eve).is_err());

        // A client with an issued-but-unused challenge cannot silently get a
        // second one (no stale-challenge overwrite) — challenges are
        // single-use by construction.
        let chal_gwen = issuer.pow_challenge("gwen", Epoch(1)).unwrap();
        let err = issuer
            .pow_challenge("gwen", Epoch(1))
            .unwrap_err()
            .to_string();
        assert!(err.contains("issued-but-unused"), "got: {err}");
        // The first challenge is still usable.
        let counter_gwen = crate::pow::mine(&chal_gwen, 10);
        issuer.grant_batch("gwen", Epoch(1), counter_gwen).unwrap();

        // A counter below the found one is insufficient (mine iterates from
        // 0, so every smaller counter fails by construction) — the difficulty
        // is enforced, not just checked loosely. (`saturating_sub` keeps the
        // comparison meaningful on the rare counter == 0 first-trial success.)
        assert!(
            issuer
                .grant_batch("eve", Epoch(1), counter_eve.saturating_sub(1))
                .is_err()
        );
        // The failed attempt *consumed* eve's single-use challenge, so the
        // correct solution cannot be replayed against it…
        assert!(issuer.grant_batch("eve", Epoch(1), counter_eve).is_err());
        // …but a fresh challenge + fresh solve still succeeds.
        let chal_eve2 = issuer.pow_challenge("eve", Epoch(1)).unwrap();
        let counter_eve2 = crate::pow::mine(&chal_eve2, 10);
        issuer.grant_batch("eve", Epoch(1), counter_eve2).unwrap();
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
