// Terms of use for Warren, an open-source mixnet messenger. Intentionally
// short: self-hosted software, not a commercial service - no accounts, no
// fees, no subscriptions. This committed copy is the source of truth for the
// /terms page.
import type { LegalDoc } from "./types";

const doc: LegalDoc = {
  title: "Terms of Use",
  updated: "Last updated: June 17, 2026",
  subtitle: "An open-source project, not a hosted service",
  intro: [
    "Warren is open-source software: a Rust mixnet client and relay implementing Sphinx routing, a Double Ratchet, blind-signature admission tokens, and a K-of-N relay directory. These terms explain the basis on which the software and its source code are made available. They are intentionally short, because there is no service to subscribe to.",
  ],
  sections: [
    {
      num: "01",
      heading: "About this project",
      id: "about-this-project",
      blocks: [
        "Warren is an open-source implementation of a mixnet messenger: message content is end-to-end encrypted, and metadata is hidden structurally through layered encryption, mix delay, cover traffic, and a K-of-N attested relay directory. It is provided for education, research, and self-hosted use.",
        "It is not a hosted messaging service, not a managed product, and not a service you subscribe to. There are no accounts, no fees, and no subscriptions - you run the client and any relays yourself.",
      ],
    },
    {
      num: "02",
      heading: "No guarantee of anonymity in every circumstance",
      id: "no-financial-advice",
      blocks: [
        "Warren is designed to defend against passive network observers and single compromised relays, within the bounds documented in the project's threat model. It is not a guarantee of anonymity against every adversary in every configuration - misconfiguration, a compromised endpoint, or an adversary outside the documented threat model can still deanonymize you. Read the threat-model documentation before relying on this software for high-stakes anonymity.",
      ],
    },
    {
      num: "03",
      heading: "Use of the software",
      id: "use-of-the-demo",
      blocks: [
        "You may run, modify, and study the client and relay binaries and read the source code. Please do not use Warren, or any relay you operate, for any unlawful purpose, and do not attempt to disrupt, overload, or attack relays or directory infrastructure operated by others without authorization.",
      ],
    },
    {
      num: "04",
      heading: "Open source and intellectual property",
      id: "open-source-and-ip",
      blocks: [
        'The source code is published on GitHub and is governed by the license included in that repository. "Warren", the logo, and the visual identity are used to identify this project; other names and marks belong to their respective owners.',
      ],
    },
    {
      num: "05",
      heading: 'Provided "as is"',
      id: "provided-as-is",
      blocks: [
        'The software and source code are provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose. The project may be incomplete, may change, or individual relays may go offline at any time without notice.',
      ],
    },
    {
      num: "06",
      heading: "Limitation of liability",
      id: "limitation-of-liability",
      blocks: [
        "To the maximum extent permitted by law, the project's authors are not liable for any damages arising from your use of, or inability to use, the software or the source code, including damages arising from reliance on its anonymity properties.",
      ],
    },
    {
      num: "07",
      heading: "Changes",
      id: "changes",
      blocks: [
        "These terms may change as the project develops. The current version lives with the source code in the project's GitHub repository.",
      ],
    },
    {
      num: "08",
      heading: "Contact",
      id: "contact",
      blocks: [
        "Questions can be raised as an issue on the GitHub repository: github.com/Yash-arch-ui/WARREN.",
      ],
    },
  ],
};

export default doc;
