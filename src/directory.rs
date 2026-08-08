//! Directory module — discovering and trusting the relay set.
//!
//! M0 status: **stub only.** Documents the M1 plan; returns a summary string
//! describing what it *would* do. No fetching or verification yet.
//!
//! M1 plan (see `docs/THREAT_MODEL.md`):
//! - Fetch a signed relay list from the directory endpoint (the spec's
//!   "signed relay list").
//! - Verify the directory's signature over the list (ed25519) against a
//!   pinned directory public key, and verify per-relay identity keys.
//! - Select relay paths for Sphinx packet construction with constrained
//!   random selection (no two hops on the same operator, etc.).
//!
//! Trust model: the directory is a *trusted-but-auditable* root — it does not
//! see message traffic (it is not a mix relay), but a compromised directory
//! can deanonymize by steering all paths through colluding relays. This is an
//! accepted MVP limitation (see `docs/THREAT_MODEL.md` §"Out of scope").

use anyhow::Result;

/// Fetch and verify the signed relay list.
///
/// M0 stub. M1 will: `GET` the list over TLS, verify the directory signature
/// with the pinned key, parse relays (identity key, address, operator id),
/// and return a usable relay set.
pub fn fetch_and_verify(directory_url: &str) -> Result<String> {
    Ok(format!(
        "[directory] fetch_and_verify: would GET {directory_url}, verify the \
         ed25519 signature against the pinned directory key, and return the \
         relay set for path selection."
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetch_stub_describes_plan() {
        let out = fetch_and_verify("https://directory.example/unlink/relays.json")
            .expect("stub never fails");
        assert!(
            out.contains("ed25519"),
            "stub mentions signature check: {out}"
        );
        assert!(
            out.contains("https://directory.example"),
            "URL echoed: {out}"
        );
    }
}
