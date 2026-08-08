import type { Metadata } from "next";
import { DeskShowcaseHeader } from "@/components/desk/showcase/DeskShowcaseHeader";
import { DeskShowcaseHero } from "@/components/desk/showcase/DeskShowcaseHero";
import { LiveCommandCenter } from "@/components/desk/LiveCommandCenter";

/**
 * /desk - the Live Command Center showcase + the real demo.
 *
 * Landing-style composition: a clean WHITE editorial hero (data-section="light")
 * that hard-cuts into the native DARK Command Center - obsidian backbone, grey
 * panels, frost text, sacred band-blue "on Band", verdict colors. The dark
 * dashboard is the system's intended look (every desk component is authored
 * dark); the white hero supplies the light↔dark contrast the landing trades on.
 *
 * Renders: <DeskShowcaseHeader/> (sticky, auto-hides at the desk) → the white
 * <DeskShowcaseHero/> (§11) → the ACTUAL functional <LiveCommandCenter/> (§9)
 * where the real Beat-B demo runs (mock out-of-box; NEXT_PUBLIC_DATA_MODE=live).
 */
export const metadata: Metadata = {
  title: "Live Command Center · Alpha & Oversight",
  description:
    "Watch the system think - live. Every agent action streams over Band, every verdict is deterministic and hash-chained. Scroll through how the desk is wired, then run the real Beat-B demo.",
};



export default function DeskPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--obsidian)", color: "var(--frost)" }}>
      <DeskShowcaseHeader />
      <main>
        {/* Dark Command-Center hero — obsidian backbone, frost text, blue/slate
            accents, consistent with the live desk below it. */}
        <div data-section="dark" style={{ borderBottom: "1px solid var(--border-strong)" }}>
          <DeskShowcaseHero />
        </div>
        <LiveCommandCenter />
      </main>
    </div>
  );
}
