import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import doc from "@/content/legal/privacy";

/**
 * /privacy - Privacy Policy. Landing nav + footer wrap a readable legal column;
 * content is the A&O-rebranded copy in content/legal/privacy.ts.
 */
export const metadata: Metadata = {
  title: "Privacy Policy · Alpha & Oversight",
  description: "How Alpha & Oversight collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return <LegalPage doc={doc} eyebrow="Legal · Privacy Policy" />;
}
