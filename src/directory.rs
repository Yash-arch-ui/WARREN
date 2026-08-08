//! Directory module — a signed relay list (the "gossip list", spec §5.4).
//!
//! MVP design (the spec's bar: *"a signed gossip list is enough"*):
//!
//! - Every relay has a **long-term ed25519 identity key** (separate from its
//!   per-session x25519 Sphinx key). At startup it self-signs a
//!   [`RelayClaim`]: `(address, sphinx_pubkey, identity_pubkey)`.
//! - Clients load a [`SignedRelayList`] file (the gossip list), verify **every
//!   entry's self-signature**, and use the listed sphinx pubkeys to build
//!   routes. This is the defense against the poisoned-relay-list attack
//!   (spec §8.5): an attacker cannot forge an entry for an honest relay
//!   because it does not hold that relay's ed25519 key.
//! - On the live handshake the relay returns its signed claim; the client
//!   verifies the claim's self-signature *and* cross-checks the claimed
//!   identity + sphinx keys against the list entry for that address. A live
//!   MITM substituting its own keys (or a relay that restarted with new
//!   keys) is rejected.
//!
//! Trust note (first-use / TOFU): a claim's self-signature proves the entry
//! was produced by whoever holds that identity key; it does not by itself
//! prove the identity key belongs to the *real* relay at that address. The
//! client's protection is that it pins identity keys via the list (assembled
//! once) and thereafter rejects any relay whose live claim does not match.
//! Real gossip *propagation* (exchanging lists between clients, a DHT) is
//! beyond MVP — per §5.4's own "full DHT is a stretch goal" — and is left
//! for M5+ (flagged in `docs/THREAT_MODEL.md` §6, not silently dropped).

use std::collections::HashSet;
use std::path::Path;

use anyhow::{Result, anyhow};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::net;

pub const RELAY_CLAIM_VERSION: u8 = 1;
const SIGNATURE_LEN: usize = 64;

/// Default number of independent directory signing keys (M7, K-of-N).
pub const DEFAULT_DIR_SIGNERS: usize = 3;
/// Default required directory attestations: at least 2 of the N keys.
pub const DEFAULT_DIR_THRESHOLD: usize = 2;
const DIR_ATTEST_VERSION: u8 = 1;

/// A relay's self-signed claim: the relay's public routing metadata signed
/// with its long-term ed25519 identity key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RelayClaim {
    pub address: String,
    #[serde(with = "hex")]
    pub sphinx_pubkey: [u8; 32],
    #[serde(with = "hex")]
    pub identity_pubkey: [u8; 32],
    #[serde(with = "hex")]
    pub signature: [u8; SIGNATURE_LEN],
}

impl RelayClaim {
    /// Build the canonical byte encoding that is signed/verified:
    /// `[version u8][addr_len u8][address ascii][sphinx_pubkey 32]
    /// [identity_pubkey 32]`. Signing the canonical form (not the JSON) keeps
    /// verification independent of any JSON serialization choices.
    pub fn canonical(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(2 + self.address.len() + 32 + 32);
        out.push(RELAY_CLAIM_VERSION);
        out.push(self.address.len() as u8);
        out.extend_from_slice(self.address.as_bytes());
        out.extend_from_slice(&self.sphinx_pubkey);
        out.extend_from_slice(&self.identity_pubkey);
        out
    }

    /// Verify the claim's self-signature against its own identity pubkey.
    pub fn verify(&self) -> Result<()> {
        let vk = VerifyingKey::from_bytes(&self.identity_pubkey)
            .map_err(|e| anyhow!("bad identity pubkey: {e}"))?;
        let sig = Signature::from_bytes(&self.signature);
        vk.verify_strict(&self.canonical(), &sig)
            .map_err(|_| anyhow!("invalid relay claim signature for {}", self.address))
    }

    /// Wire encoding for the handshake response: `canonical || signature(64)`.
    pub fn to_wire(&self) -> Vec<u8> {
        let mut out = self.canonical();
        out.extend_from_slice(&self.signature);
        out
    }

    /// Parse a handshake response body back into a claim.
    pub fn from_wire(bytes: &[u8]) -> Result<Self> {
        if bytes.len() < 2 + 32 + 32 + SIGNATURE_LEN {
            return Err(anyhow!("relay claim too short on the wire"));
        }
        let sig_off = bytes.len() - SIGNATURE_LEN;
        let canonical = &bytes[..sig_off];
        if canonical[0] != RELAY_CLAIM_VERSION {
            return Err(anyhow!("unsupported relay claim version {}", canonical[0]));
        }
        let addr_len = canonical[1] as usize;
        let expected = 2 + addr_len + 32 + 32;
        if canonical.len() != expected {
            return Err(anyhow!("relay claim length mismatch on the wire"));
        }
        let address = String::from_utf8(canonical[2..2 + addr_len].to_vec())
            .map_err(|_| anyhow!("relay claim address is not UTF-8"))?;
        let mut sphinx_pubkey = [0u8; 32];
        sphinx_pubkey.copy_from_slice(&canonical[2 + addr_len..2 + addr_len + 32]);
        let mut identity_pubkey = [0u8; 32];
        identity_pubkey.copy_from_slice(&canonical[2 + addr_len + 32..2 + addr_len + 64]);
        let mut signature = [0u8; SIGNATURE_LEN];
        signature.copy_from_slice(&bytes[sig_off..]);
        Ok(RelayClaim {
            address,
            sphinx_pubkey,
            identity_pubkey,
            signature,
        })
    }

    pub fn to_json_string(&self) -> Result<String> {
        Ok(serde_json::to_string(self)?)
    }

    pub fn from_json_str(s: &str) -> Result<Self> {
        serde_json::from_str(s).map_err(|e| anyhow!("cannot parse relay claim: {e}"))
    }
}

/// Create a relay claim: address + sphinx pubkey, signed by the relay's
/// long-term ed25519 identity key.
pub fn sign_claim(address: &str, sphinx_pubkey: [u8; 32], identity_sk: &SigningKey) -> RelayClaim {
    let identity_pubkey = identity_sk.verifying_key().to_bytes();
    let unsigned = RelayClaim {
        address: address.to_string(),
        sphinx_pubkey,
        identity_pubkey,
        signature: [0u8; SIGNATURE_LEN],
    };
    let sig = identity_sk.sign(&unsigned.canonical());
    RelayClaim {
        signature: sig.to_bytes(),
        ..unsigned
    }
}

/// One directory attestation (M7): the list's entries signed by one of the
/// N independent directory keys. A client accepts a list only when it
/// carries valid attestations from at least K of its N configured keys.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DirectoryAttestation {
    /// ed25519 public key of the attesting directory signer.
    #[serde(with = "hex")]
    pub signer: [u8; 32],
    /// ed25519 signature over [`SignedRelayList::canonical_entries`].
    #[serde(with = "hex")]
    pub signature: [u8; SIGNATURE_LEN],
}

/// The signed gossip list: a set of per-relay self-signed claims, plus the
/// directory attestations that vouch for the set (M7, K-of-N).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SignedRelayList {
    pub entries: Vec<RelayClaim>,
    /// Directory attestations over [`SignedRelayList::canonical_entries`].
    /// `#[serde(default)]` keeps M3-era list files (no attestations) parseable.
    #[serde(default)]
    pub attestations: Vec<DirectoryAttestation>,
}

impl SignedRelayList {
    pub fn from_claims(entries: Vec<RelayClaim>) -> Self {
        Self {
            entries,
            attestations: Vec::new(),
        }
    }

    /// Canonical byte encoding of the entries that directory attestations
    /// sign over: `[version u8][entry_count u16 BE][each entry's canonical
    /// encoding, in address order]`. Sorting makes the payload independent
    /// of list file ordering, and including a version + count prevents
    /// cross-version or truncated-set ambiguity.
    pub fn canonical_entries(&self) -> Vec<u8> {
        let mut ordered: Vec<&RelayClaim> = self.entries.iter().collect();
        ordered.sort_by(|a, b| a.address.cmp(&b.address));
        let mut out = Vec::with_capacity(1 + 2 + ordered.len() * 66);
        out.push(DIR_ATTEST_VERSION);
        let count = u16::try_from(ordered.len())
            .expect("relay list too large for the attestation count field");
        out.extend_from_slice(&count.to_be_bytes());
        for entry in ordered {
            out.extend_from_slice(&entry.canonical());
        }
        out
    }

    /// Attest this list with one directory signing key (one of the N).
    pub fn sign_attestation(&self, sk: &SigningKey) -> DirectoryAttestation {
        DirectoryAttestation {
            signer: sk.verifying_key().to_bytes(),
            signature: sk.sign(&self.canonical_entries()).to_bytes(),
        }
    }

    /// K-of-N directory verification (M7): accept only if the list carries
    /// **valid** attestations from at least `threshold` of the `keys`.
    ///
    /// Strict by design: an attestation from a key that is not one of the N
    /// configured keys, or with an invalid signature, rejects the whole list
    /// — a poisoned entry must fail loudly, never be counted alongside valid
    /// ones. This is the property the M7 integration test pins: a forged
    /// signature from a non-directory key is rejected *even when* K other
    /// valid attestations are present.
    ///
    /// `keys` empty = no directory policy configured: the list is trusted on
    /// per-entry self-signatures alone (the M3 TOFU mode). The policy is a
    /// client-side choice, documented in `docs/THREAT_MODEL.md` §1.
    pub fn verify_directory(&self, keys: &[[u8; 32]], threshold: usize) -> Result<()> {
        if keys.is_empty() {
            return Ok(());
        }
        if threshold == 0 || threshold > keys.len() {
            anyhow::bail!(
                "invalid directory threshold {threshold} for {} configured key(s)",
                keys.len()
            );
        }
        let canonical = self.canonical_entries();
        let mut attested: HashSet<usize> = HashSet::new();
        for att in &self.attestations {
            let idx = keys.iter().position(|k| k == &att.signer).ok_or_else(|| {
                anyhow!(
                    "relay list carries an attestation from a directory key that is not \
                     among the configured {} key(s)",
                    keys.len()
                )
            })?;
            let vk = VerifyingKey::from_bytes(&att.signer)
                .map_err(|e| anyhow!("bad directory key in attestation: {e}"))?;
            vk.verify_strict(&canonical, &Signature::from_bytes(&att.signature))
                .map_err(|_| anyhow!("invalid directory attestation signature"))?;
            attested.insert(idx);
        }
        if attested.len() < threshold {
            anyhow::bail!(
                "relay list attested by only {} of the {} configured directory keys \
                 (need {threshold})",
                attested.len(),
                keys.len()
            );
        }
        Ok(())
    }

    /// Verify every entry's self-signature. Any invalid entry rejects the
    /// whole list — a poisoned list must fail loudly, not be partially used.
    pub fn verify(&self) -> Result<()> {
        for entry in &self.entries {
            entry
                .verify()
                .map_err(|e| anyhow!("relay list rejected: {e}"))?;
        }
        Ok(())
    }

    /// Load a gossip list file and verify every entry.
    pub fn load_and_verify(path: &Path) -> Result<Self> {
        let raw = std::fs::read_to_string(path)
            .map_err(|e| anyhow!("cannot read relay list `{}`: {e}", path.display()))?;
        let list: SignedRelayList =
            serde_json::from_str(&raw).map_err(|e| anyhow!("cannot parse relay list: {e}"))?;
        if list.entries.is_empty() {
            return Err(anyhow!("relay list `{}` has no entries", path.display()));
        }
        list.verify()?;
        Ok(list)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(self)?)?;
        Ok(())
    }

    /// Look up the verified claim for an address.
    pub fn get(&self, address: &str) -> Option<&RelayClaim> {
        self.entries.iter().find(|e| e.address == address)
    }
}

/// First-use bootstrap: fetch each relay's signed claim over the handshake,
/// verify each self-signature, and return the assembled list. This is the
/// TOFU step — after it, the client pins the identity keys (see module docs).
pub fn fetch_claims_from(addresses: &[&str]) -> Result<SignedRelayList> {
    let mut entries = Vec::with_capacity(addresses.len());
    for addr in addresses {
        let mut stream = net::connect(addr)?;
        net::send_frame(&mut stream, net::FRAME_INFO_REQ, &[])?;
        let (ty, body) = net::recv_frame(&mut stream)?
            .ok_or_else(|| anyhow!("relay {addr} closed without responding"))?;
        if ty != net::FRAME_INFO_RESP {
            anyhow::bail!("unexpected frame type {ty} from {addr}");
        }
        let claim = RelayClaim::from_wire(&body)?;
        claim
            .verify()
            .map_err(|e| anyhow!("relay {addr} returned an invalid claim: {e}"))?;
        entries.push(claim);
    }
    Ok(SignedRelayList {
        entries,
        attestations: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_identity() -> SigningKey {
        SigningKey::from_bytes(&rand::random::<[u8; 32]>())
    }

    #[test]
    fn claim_sign_verify_roundtrip() {
        let sk = test_identity();
        let claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk);
        assert_eq!(
            claim.identity_pubkey,
            sk.verifying_key().to_bytes(),
            "claim carries the signer's identity pubkey"
        );
        assert!(claim.verify().is_ok());
        // Wire round trip.
        assert_eq!(RelayClaim::from_wire(&claim.to_wire()).unwrap(), claim);
        // JSON round trip.
        assert_eq!(
            RelayClaim::from_json_str(&claim.to_json_string().unwrap()).unwrap(),
            claim
        );
    }

    #[test]
    fn tampered_claim_rejected() {
        let sk = test_identity();
        // Tamper with each signed field.
        let mut claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk);
        claim.address = "127.0.0.1:9999".into();
        assert!(claim.verify().is_err());

        let mut claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk);
        claim.sphinx_pubkey[0] ^= 1;
        assert!(claim.verify().is_err());

        let mut claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk);
        claim.signature[10] ^= 1;
        assert!(claim.verify().is_err());
    }

    #[test]
    fn signature_binds_to_identity_key() {
        // A claim signed by one key must not verify under a different key.
        let sk_a = test_identity();
        let claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk_a);
        let mut swapped = claim.clone();
        swapped.identity_pubkey = test_identity().verifying_key().to_bytes();
        assert!(swapped.verify().is_err());
    }

    #[test]
    fn list_verify_rejects_any_bad_entry() {
        let sk = test_identity();
        let good = sign_claim("127.0.0.1:7001", [1u8; 32], &sk);
        let mut bad = sign_claim("127.0.0.1:7002", [2u8; 32], &sk);
        bad.signature[0] ^= 1;
        let list = SignedRelayList::from_claims(vec![good, bad]);
        assert!(list.verify().is_err(), "one bad entry rejects the list");
        assert!(list.get("127.0.0.1:7001").is_some());
        assert!(list.get("127.0.0.1:9999").is_none());
    }

    #[test]
    fn unsigned_wire_body_rejected() {
        // A handshake body that is not canonical||sig must fail parsing.
        assert!(RelayClaim::from_wire(&[0u8; 40]).is_err());
        let sk = test_identity();
        let claim = sign_claim("127.0.0.1:7001", [7u8; 32], &sk);
        let mut wire = claim.to_wire();
        wire.truncate(wire.len() - 1); // chop a byte off the signature
        assert!(RelayClaim::from_wire(&wire).is_err());
    }

    // --- M7: K-of-N multi-signer directory ---

    fn dir_keys(n: u8) -> Vec<SigningKey> {
        (1..=n).map(|i| SigningKey::from_bytes(&[i; 32])).collect()
    }

    /// A 3-entry list of self-signed claims (fake relay identities).
    fn three_entry_list() -> SignedRelayList {
        let claims = (0..3)
            .map(|i| {
                let relay_id = SigningKey::from_bytes(&[100 + i; 32]);
                sign_claim(&format!("127.0.0.1:70{:02}", i + 1), [7u8; 32], &relay_id)
            })
            .collect();
        SignedRelayList::from_claims(claims)
    }

    fn pubkeys(sks: &[SigningKey]) -> Vec<[u8; 32]> {
        sks.iter().map(|sk| sk.verifying_key().to_bytes()).collect()
    }

    #[test]
    fn k_of_n_threshold_enforced() {
        let keys = dir_keys(3);
        let configured = pubkeys(&keys);
        let mut list = three_entry_list();

        // Policy configured, zero attestations → rejected.
        assert!(
            list.verify_directory(&configured, DEFAULT_DIR_THRESHOLD)
                .is_err()
        );
        // 1 of 3 → rejected (below K = 2).
        list.attestations.push(list.sign_attestation(&keys[0]));
        let err = list
            .verify_directory(&configured, DEFAULT_DIR_THRESHOLD)
            .unwrap_err()
            .to_string();
        assert!(err.contains("attested by only 1 of the 3"), "got: {err}");
        // 2 of 3 → accepted.
        list.attestations.push(list.sign_attestation(&keys[1]));
        assert!(
            list.verify_directory(&configured, DEFAULT_DIR_THRESHOLD)
                .is_ok()
        );
        // …but not enough if the threshold is raised to 3.
        assert!(list.verify_directory(&configured, 3).is_err());
        // 3 of 3 → accepted at any threshold.
        list.attestations.push(list.sign_attestation(&keys[2]));
        assert!(list.verify_directory(&configured, 3).is_ok());
        // Threshold outside [1, N] is a config error, not a silent pass.
        assert!(list.verify_directory(&configured, 0).is_err());
        assert!(list.verify_directory(&configured, 4).is_err());
    }

    #[test]
    fn forged_or_mismatched_attestation_rejects_even_with_k_valid() {
        let keys = dir_keys(3);
        let configured = pubkeys(&keys);
        let rogue = SigningKey::from_bytes(&[9u8; 32]); // NOT one of the N

        // 2 valid + 1 from an unconfigured key → rejected, not counted.
        let mut list = three_entry_list();
        list.attestations.push(list.sign_attestation(&keys[0]));
        list.attestations.push(list.sign_attestation(&keys[1]));
        list.attestations.push(list.sign_attestation(&rogue));
        let err = list
            .verify_directory(&configured, DEFAULT_DIR_THRESHOLD)
            .unwrap_err()
            .to_string();
        assert!(err.contains("not among the configured"), "got: {err}");

        // 2 valid + a corrupted signature from a configured key → rejected.
        let mut list = three_entry_list();
        list.attestations.push(list.sign_attestation(&keys[0]));
        list.attestations.push(list.sign_attestation(&keys[1]));
        let mut bad = list.sign_attestation(&keys[2]);
        bad.signature[0] ^= 0xff;
        list.attestations.push(bad);
        let err = list
            .verify_directory(&configured, DEFAULT_DIR_THRESHOLD)
            .unwrap_err()
            .to_string();
        assert!(err.contains("invalid directory attestation"), "got: {err}");

        // No policy configured (empty keys) → TOFU mode, always accepted.
        assert!(list.verify_directory(&[], 2).is_ok());
        assert!(list.verify_directory(&[], 0).is_ok());
    }

    #[test]
    fn attestations_bind_to_the_entries() {
        // An attestation covers the exact entry set: swapping an entry (or
        // its address) invalidates every attestation — a directory cannot be
        // tricked into vouching for entries it never saw.
        let keys = dir_keys(2);
        let configured = pubkeys(&keys);
        let mut list = three_entry_list();
        for k in &keys {
            list.attestations.push(list.sign_attestation(k));
        }
        assert!(list.verify_directory(&configured, 2).is_ok());

        let mut tampered = list.clone();
        tampered.entries[1].address = "127.0.0.1:9999".into();
        assert!(
            tampered.verify_directory(&configured, 2).is_err(),
            "tampered entry must invalidate the attestations"
        );

        // Removing an entry also breaks the attestation (canonical payload
        // includes the entry count).
        let mut shorter = list.clone();
        shorter.entries.pop();
        assert!(shorter.verify_directory(&configured, 2).is_err());
    }
}
