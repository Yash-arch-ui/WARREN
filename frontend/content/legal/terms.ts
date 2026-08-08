// Terms of use for the Alpha & Oversight demonstration project (lablab.ai "Band
// of Agents" hackathon). Intentionally short: a research demo, not a commercial
// service - no accounts, no fees, no subscriptions. This committed copy is the
// source of truth for the /terms page.
import type { LegalDoc } from "./types";

const doc: LegalDoc = {
  title: "Terms of Use",
  updated: "Last updated: June 17, 2026",
  subtitle: "A demonstration project, not a commercial service",
  intro: [
    'Alpha & Oversight is an open-source demonstration built for the lablab.ai "Band of Agents" hackathon. These terms explain the basis on which the demo and its source code are made available. They are intentionally short, because this is a research demo and not a commercial service.',
  ],
  sections: [
    {
      num: "01",
      heading: "About this project",
      id: "about-this-project",
      blocks: [
        "Alpha & Oversight is an open-source demonstration of an adversarial market-surveillance system: AI agents propose and contest manipulation scenarios, and a deterministic rule engine renders the verdict. It is provided for education and demonstration.",
        "It is not a licensed surveillance product, not a compliance system of record, and not a service you subscribe to. There are no accounts, no fees, and no subscriptions.",
      ],
    },
    {
      num: "02",
      heading: "No financial or investment advice",
      id: "no-financial-advice",
      blocks: [
        "Everything shown in the demo is generated from synthetic, seeded data for illustration. Nothing here is financial, investment, legal, or compliance advice, and nothing should be relied on to make real trading, surveillance, or regulatory decisions.",
      ],
    },
    {
      num: "03",
      heading: "Use of the demo",
      id: "use-of-the-demo",
      blocks: [
        "You may explore the demo and read the source code. Please do not attempt to disrupt, overload, attack, or gain unauthorized access to the demo or its infrastructure, and do not use it for any unlawful purpose.",
      ],
    },
    {
      num: "04",
      heading: "Open source and intellectual property",
      id: "open-source-and-ip",
      blocks: [
        'The source code is published on GitHub and is governed by the license included in that repository. "Alpha & Oversight", the logo, and the visual identity are used to identify this project; other names and marks belong to their respective owners.',
      ],
    },
    {
      num: "05",
      heading: 'Provided "as is"',
      id: "provided-as-is",
      blocks: [
        'The demo and source code are provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose. The project may be incomplete, may change, or may be taken offline at any time without notice.',
      ],
    },
    {
      num: "06",
      heading: "Limitation of liability",
      id: "limitation-of-liability",
      blocks: [
        "To the maximum extent permitted by law, the project's authors are not liable for any damages arising from your use of, or inability to use, the demo or the source code.",
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
        "Questions can be raised as an issue on the GitHub repository: github.com/Sarnav07/Alpha-oversight.",
      ],
    },
  ],
};

export default doc;
