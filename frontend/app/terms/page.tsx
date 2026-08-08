import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import doc from "@/content/legal/terms";

/**
 * /terms - Terms & Conditions of Service. Landing nav + footer wrap a readable
 * legal column; content is the A&O-rebranded copy in content/legal/terms.ts.
 */
export const metadata: Metadata = {
  title: "Terms of Service · Alpha & Oversight",
  description: "The terms and conditions governing use of the Alpha & Oversight platform.",
};

export default function TermsPage() {
  return <LegalPage doc={doc} eyebrow="Legal · Terms of Service" />;
}
