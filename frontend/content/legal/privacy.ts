// Privacy policy for Warren, an open-source mixnet messenger. Written to be
// honest about what a self-hosted client/relay actually does: no accounts, no
// server-side logging of message content, nothing leaves your machine that the
// protocol doesn't require. This committed copy is the source of truth for the
// /privacy page.
import type { LegalDoc } from "./types";

const doc: LegalDoc = {
  title: "Privacy Policy",
  updated: "Last updated: June 17, 2026",
  subtitle: "An open-source project, not a hosted service",
  intro: [
    "Warren is an open-source mixnet client and relay: Sphinx routing, a Double Ratchet, blind-signature admission tokens, and a K-of-N relay directory. It is not a hosted service - the `warren serve` daemon that backs the desk UI runs on your own machine, loopback-only.",
    "This page explains, in plain terms, what the software does and does not handle. Because there is no account and no server we operate on your behalf, there is very little to collect in the first place.",
  ],
  sections: [
    {
      num: "01",
      heading: "What Warren is",
      id: "what-this-is",
      blocks: [
        "Warren is a messenger built for structural anonymity: message content is encrypted end to end with a Double Ratchet, and the route a message takes is hidden by Sphinx packet layering, mix delay, and cover traffic. There is no central server that sees your messages.",
        "There are no user accounts, no logins, and no payments. Identity is a locally generated keypair you control.",
      ],
    },
    {
      num: "02",
      heading: "Information we collect",
      id: "information-we-collect",
      blocks: [
        "We - the project maintainers - do not operate a backend that your client talks to. `warren serve` runs on your machine and binds to 127.0.0.1 only; it refuses to bind any other address, because it holds an unlocked wallet and ratchet state with no authentication layer.",
        "Message content and delivery state are kept in a local journal on your machine for the desk UI to read. Nothing about your messages is transmitted to the project maintainers or any third party we operate.",
      ],
    },
    {
      num: "03",
      heading: "What relays can and cannot see",
      id: "what-relays-can-see",
      blocks: [
        "If you run or use public relays (entry, middle, exit), each relay by design sees only the address of the next hop - never the full path, and never the message content, which stays encrypted until it reaches the recipient's ratchet. Relays hold no secrets and are safe to expose publicly; that structural limit is the point of the design, not a policy promise.",
      ],
    },
    {
      num: "04",
      heading: "Telemetry and analytics",
      id: "cookies-and-analytics",
      blocks: [
        "The client and relay binaries do not phone home. The frontend, if you deploy it, uses no tracking cookies and no third-party analytics beyond what a static hosting provider collects on its own.",
      ],
    },
    {
      num: "05",
      heading: "Directory keys and relay operators",
      id: "third-party-services",
      blocks: [
        "Trusting a relay list requires K-of-N attestation from independently operated directory keys. If you rely on relays or directory keys operated by others, review their own privacy practices - Warren's design limits what any single relay can observe, but does not control what an operator logs on their own infrastructure.",
      ],
    },
    {
      num: "06",
      heading: "Your choices",
      id: "your-choices",
      blocks: [
        "Because nothing is stored on our infrastructure, there is generally nothing for us to delete on your behalf. You control your own local data directory (`~/.warren` by default) and can remove it at any time.",
      ],
    },
    {
      num: "07",
      heading: "Changes to this policy",
      id: "changes-to-this-policy",
      blocks: [
        "As the project evolves, this policy may be updated. The current version always lives with the source code in the project's GitHub repository.",
      ],
    },
    {
      num: "08",
      heading: "Contact",
      id: "contact",
      blocks: [
        "Questions about this project or this policy can be raised as an issue on the GitHub repository: github.com/Yash-arch-ui/WARREN.",
      ],
    },
  ],
};

export default doc;
