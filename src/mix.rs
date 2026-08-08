//! Mix timing (M5): Poisson-distributed per-hop delay and cover traffic —
//! the Layer-1 timing-mixing machinery spec §3.2 calls for ("randomized
//! per-hop delay and cover traffic, à la Loopix/Nym, tunable per user").
//!
//! Design (see `docs/LIBRARY_SELECTION.md` §6 for the library/design check
//! behind it):
//!
//! - **Per-hop delay** is sampled by the *sender* from an exponential
//!   distribution with the user's configured mean (`[relays] delay_ms`) and
//!   carried in each hop's Sphinx header; the relay enforces it by sleeping
//!   (the M4 mechanism, unchanged). Exponential samples are the Poisson
//!   process's inter-arrival law, so per-hop delays are no longer a
//!   predictable constant offset — the M4 admission ("a fixed delay is fully
//!   predictable; an adversary can subtract it") no longer applies to the
//!   delay itself.
//! - **Cover traffic** is emitted by each relay that has successors (entry,
//!   middle) on a Poisson schedule: a random-payload Sphinx packet routed
//!   through its successor relays and terminated at a reserved
//!   [`DROP_DESTINATION_PREFIX`] address that the exit relay drops instead of
//!   delivering. Sphinx packets are constant-size regardless of path length
//!   (verified in tests), and relay-to-relay frames carry no admission proof,
//!   so a cover packet is wire-indistinguishable from a real forwarded
//!   packet. Cover is generated *after* the M2 admission gate (in-process),
//!   so it neither spends tokens nor collides with the spam gate — see
//!   `tests/m6_mixing.rs`.
//!
//! RNG policy: samplers take `&mut impl Rng` so production passes
//! `rand::rng()` while tests use a seeded `StdRng` for determinism.

use rand::Rng;
use rand_distr::{Distribution, Exp};
use sphinx_packet::header::delays::Delay;

/// Upper bound on a sampled per-hop delay, in milliseconds. The relay clamps
/// sender-chosen delays to the same value (`relay::MAX_HONORED_DELAY_MS`), so
/// clamping client-side keeps a (rare) huge exponential sample from even
/// asking for more than the network will honor — and avoids overflow in
/// `Delay::new_from_millis`.
pub const MAX_DELAY_MS: u64 = 30_000;

/// Reserved address prefix for cover traffic. The exit relay drops any
/// `FinalHop` whose destination starts with this instead of delivering. The
/// destination lives inside the innermost Sphinx layer — only the exit relay
/// ever sees it, so a reserved prefix is not observable on the wire; it is
/// the MVP's stand-in for Loopix "drop" messages (a real mix drops messages
/// addressed to itself or to a random unreachable address).
pub const DROP_DESTINATION_PREFIX: &str = "drop:";

/// True if `addr` is a reserved cover-traffic drop destination.
pub fn is_drop_destination(addr: &str) -> bool {
    addr.starts_with(DROP_DESTINATION_PREFIX)
}

/// Sample one per-hop mix delay (ms) from Exp(rate = 1 / mean_ms) — the
/// Poisson process's inter-arrival law and the Loopix-standard per-hop delay.
/// `mean_ms == 0` short-circuits to 0 (no delay). Clamped to [`MAX_DELAY_MS`]
/// so a heavy-tail sample can never ask a relay to sleep beyond its cap.
pub fn exp_delay_ms(mean_ms: u64, rng: &mut impl Rng) -> u64 {
    if mean_ms == 0 {
        return 0;
    }
    let dist = Exp::new(1.0 / mean_ms as f64).expect("mean_ms > 0 ⇒ rate > 0");
    let ms: f64 = dist.sample(rng);
    // `as u64` saturates for out-of-range/inf; clamp to the honored cap.
    (ms as u64).min(MAX_DELAY_MS)
}

/// Sample the next cover-packet emission wait (ms) for a constant-rate
/// Poisson cover process emitting `rate_per_sec` packets per second
/// (inter-arrival times of a Poisson process are Exp(rate), mean 1/rate).
/// `rate_per_sec <= 0` returns `u64::MAX` (effectively never fires).
pub fn poisson_interarrival_ms(rate_per_sec: f64, rng: &mut impl Rng) -> u64 {
    if rate_per_sec <= 0.0 {
        return u64::MAX;
    }
    let dist = Exp::new(rate_per_sec).expect("rate > 0");
    let secs: f64 = dist.sample(rng);
    (secs * 1000.0) as u64
}

/// Build a Sphinx header `Delay` from a sampled ms value (clamped to
/// [`MAX_DELAY_MS`], matching what relays will honor).
pub fn delay_from_ms(ms: u64) -> Delay {
    Delay::new_from_millis(ms.min(MAX_DELAY_MS))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::StdRng;
    use sphinx_packet::SphinxPacket;
    use sphinx_packet::route::{Destination, DestinationAddressBytes, Node, NodeAddressBytes};
    use x25519_dalek::{PublicKey, StaticSecret};

    use crate::net;

    /// The per-hop delay sampler must actually follow an exponential shape —
    /// not merely "enforcement happens". A fixed RNG seed makes the
    /// statistical assertions exact and non-flaky: 200k samples of
    /// Exp(mean 50 ms) are checked against the exponential's mean, CDF at the
    /// mean, and survival probabilities.
    #[test]
    fn exponential_delay_matches_expected_shape() {
        let mut rng = StdRng::seed_from_u64(0x5EED_CAFE);
        const N: usize = 200_000;
        const MEAN: u64 = 50;
        let mut sum = 0u64;
        let mut below_mean = 0usize;
        let mut above_2x = 0usize;
        let mut above_3x = 0usize;
        for _ in 0..N {
            let s = exp_delay_ms(MEAN, &mut rng);
            sum += s;
            if s < MEAN {
                below_mean += 1;
            }
            if s > 2 * MEAN {
                above_2x += 1;
            }
            if s > 3 * MEAN {
                above_3x += 1;
            }
        }
        // Exponential: E[X] = μ (integer-ms truncation pulls it down ~0.5 ms).
        let empirical = sum as f64 / N as f64;
        assert!(
            (45.0..=54.0).contains(&empirical),
            "empirical mean {empirical} ms, expected ≈ 50"
        );
        // CDF at the mean: P(X < μ) = 1 − e⁻¹ ≈ 0.6321.
        let frac_below = below_mean as f64 / N as f64;
        assert!(
            (0.60..=0.66).contains(&frac_below),
            "P(X<μ) = {frac_below}, expected ≈ 0.632"
        );
        // Survival: P(X > 2μ) = e⁻² ≈ 0.1353; P(X > 3μ) = e⁻³ ≈ 0.0498.
        let frac_2x = above_2x as f64 / N as f64;
        assert!((0.11..=0.16).contains(&frac_2x), "P(X>2μ) = {frac_2x}");
        let frac_3x = above_3x as f64 / N as f64;
        assert!((0.03..=0.07).contains(&frac_3x), "P(X>3μ) = {frac_3x}");
        // Heavy tail bounded by the honored cap even for an absurd mean.
        assert!(exp_delay_ms(u64::MAX, &mut rng) <= MAX_DELAY_MS);
    }

    #[test]
    fn zero_mean_delay_is_always_zero() {
        let mut rng = StdRng::seed_from_u64(1);
        for _ in 0..1000 {
            assert_eq!(exp_delay_ms(0, &mut rng), 0);
        }
    }

    /// Cover emission: 50 packets/s must produce ~20 ms mean inter-arrival.
    #[test]
    fn poisson_interarrival_mean_matches_rate() {
        let mut rng = StdRng::seed_from_u64(7);
        const N: usize = 50_000;
        let mut sum = 0u64;
        for _ in 0..N {
            sum += poisson_interarrival_ms(50.0, &mut rng);
        }
        let empirical = sum as f64 / N as f64;
        assert!(
            (18.0..=22.0).contains(&empirical),
            "mean inter-arrival {empirical} ms, expected ≈ 20"
        );
        // Disabled rate: never fires.
        assert_eq!(poisson_interarrival_ms(0.0, &mut rng), u64::MAX);
        assert_eq!(poisson_interarrival_ms(-1.0, &mut rng), u64::MAX);
    }

    #[test]
    fn drop_destination_recognized() {
        assert!(is_drop_destination("drop:cover"));
        assert!(is_drop_destination("drop:anything-else"));
        assert!(!is_drop_destination("127.0.0.1:9001"));
        assert!(!is_drop_destination(""));
    }

    /// Load-bearing property for cover traffic: Sphinx packets are
    /// constant-size regardless of path length (the crate sizes the header by
    /// MAX_PATH_LENGTH, not the actual route), so a relay-generated cover
    /// packet — routed through fewer hops than a real 3-hop packet — is
    /// byte-size indistinguishable on the wire from a real one.
    #[test]
    fn sphinx_packets_constant_size_across_path_lengths() {
        let sk = StaticSecret::random();
        let pk = PublicKey::from(&sk);
        let addr = "127.0.0.1:7001";
        let dest = Destination::new(
            DestinationAddressBytes::from_bytes(net::addr_to_field("drop:cover").unwrap()),
            [0u8; 16],
        );
        let payload = vec![7u8; 64];
        let sizes: Vec<usize> = (1..=3)
            .map(|hops| {
                let route: Vec<Node> = (0..hops)
                    .map(|_| {
                        Node::new(
                            NodeAddressBytes::from_bytes(net::addr_to_field(addr).unwrap()),
                            pk,
                        )
                    })
                    .collect();
                let delays: Vec<Delay> = (0..hops).map(|_| Delay::new_from_millis(10)).collect();
                SphinxPacket::new(payload.clone(), &route, &dest, &delays)
                    .unwrap()
                    .to_bytes()
                    .len()
            })
            .collect();
        assert!(
            sizes.windows(2).all(|w| w[0] == w[1]),
            "Sphinx packet size must not depend on path length: {sizes:?}"
        );
    }
}
