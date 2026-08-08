import type { Metadata } from "next";

import { HiwHeader } from "@/components/how-it-works/sections/HiwHeader";
import { HiwHero } from "@/components/how-it-works/sections/HiwHero";
import { MotivationSection } from "@/components/how-it-works/sections/MotivationSection";
import { HiwOverview } from "@/components/how-it-works/sections/HiwOverview";
import { Methodology } from "@/components/how-it-works/sections/Methodology";
import { ProjectStructure } from "@/components/how-it-works/sections/ProjectStructure";
import { WhatsDifferent } from "@/components/how-it-works/sections/WhatsDifferent";
import { SeeItLive } from "@/components/how-it-works/sections/SeeItLive";
import { CorrelationStory } from "@/components/how-it-works/CorrelationStory";

/**
 * /how-it-works - walkthrough on a six-part spine:
 *   Motivation → Overview → Methodology → Project structure → What's different → See it live.
 *
 * Native, self-drawing SVG schematics (the `diagram/` kit) - embedded, not
 * pasted. The `CorrelationStory` scroll-centerpiece mounts into Methodology
 * sub-flow (d); the live `TopologyGraph` is surfaced via the SeeItLive → /desk
 * hand-off (its natural habitat - it needs the live trace stream).
 *
 * Aesthetic is page-scoped to `data-surface="ops"` (a bolder "forensic operations
 * room": Fraunces display + Geist Mono data + band-blue glow / blueprint grid /
 * film grain - all additive in globals.css, nothing leaks to other routes).
 * Backbone is LIGHT (`data-section="light"`); diagram + story stages tag
 * themselves `data-section="dark"` so frost inks resolve (the token gotcha).
 * Server component - every child owns its own "use client" + scroll hooks.
 */
export const metadata: Metadata = {
  title: "How it works · Warren",
  description:
    "A message crosses a mix network in layers - Sphinx-wrapped, token-gated, delayed against a Poisson clock. Every hop learns only its neighbor. No hop, and no observer on the wire, learns the rest. Read the from-scratch walkthrough with native, self-drawing schematics.",
};

export default function HowItWorksPage() {
  return (
    <div
      data-surface="ops"
      data-section="light"
      className="min-h-screen bg-page text-[color:var(--text-primary)]"
    >
      <HiwHeader />
      <main>
        <HiwHero />
        <MotivationSection />
        <HiwOverview />
        <Methodology evasionSlot={<CorrelationStory />} />
        <ProjectStructure />
        <WhatsDifferent />
        <SeeItLive />
      </main>
    </div>
  );
}
