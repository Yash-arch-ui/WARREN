// Privacy policy for the Alpha & Oversight demonstration project (lablab.ai
// "Band of Agents" hackathon). Written to be honest about a research demo: no
// accounts, no payments, synthetic data. This committed copy is the source of
// truth for the /privacy page.
import type { LegalDoc } from "./types";

const doc: LegalDoc = {
  title: "Privacy Policy",
  updated: "Last updated: June 17, 2026",
  subtitle: "A demonstration project, not a commercial service",
  intro: [
    'Alpha & Oversight is an open-source demonstration built for the lablab.ai "Band of Agents" hackathon. It is not a commercial product or a hosted trade-surveillance service.',
    "This page explains, in plain terms, what the project does and does not handle. Because it is a demo, it is designed to collect as little about you as possible.",
  ],
  sections: [
    {
      num: "01",
      heading: "What Alpha & Oversight is",
      id: "what-this-is",
      blocks: [
        "Alpha & Oversight is a research demo that shows how a group of AI agents and a deterministic rule engine can review market-manipulation scenarios. It runs on synthetic, seeded order data - not on anyone's real trading activity.",
        "There are no user accounts, no logins, and no payments. You do not need to register or provide any personal information to view the demo.",
      ],
    },
    {
      num: "02",
      heading: "Information we collect",
      id: "information-we-collect",
      blocks: [
        "The interactive demo runs in your browser and talks to a backend we operate for the event. We do not ask you for personal information, and we do not collect trading data, financial credentials, or account details.",
        "If the project is hosted online, the server and any analytics it uses may record standard technical information such as your IP address, browser type, and which pages you view. This is used only to keep the demo running and to understand aggregate usage. It is never sold or shared for advertising.",
      ],
    },
    {
      num: "03",
      heading: "Information we do not collect",
      id: "information-we-do-not-collect",
      blocks: [
        "We do not collect real brokerage or exchange data, real order flow, payment information, government identifiers, or sensitive personal data. The market activity shown in the demo is generated for illustration.",
      ],
    },
    {
      num: "04",
      heading: "Cookies and analytics",
      id: "cookies-and-analytics",
      blocks: [
        "The demo does not require you to sign in and does not use cookies to identify you personally. Any analytics used are limited to basic, aggregate usage measurement.",
      ],
    },
    {
      num: "05",
      heading: "Third-party services",
      id: "third-party-services",
      blocks: [
        "To produce the agent reasoning shown in the demo, the backend may send synthetic scenario data to third-party AI model providers. No personal information about you is included in those requests.",
      ],
    },
    {
      num: "06",
      heading: "Your choices",
      id: "your-choices",
      blocks: [
        "Because the demo does not create an account or store information about you, there is generally nothing to delete. You can stop using the demo at any time, and you can clear your browser data to remove anything cached locally.",
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
        "Questions about this project or this policy can be raised as an issue on the GitHub repository: github.com/Sarnav07/Alpha-oversight.",
      ],
    },
  ],
};

export default doc;
