"use client";

import Preloader from "@/components/landing/Preloader";
import HeroScroll from "@/components/landing/HeroScroll";
import FeaturesCarousel from "@/components/landing/FeaturesCarousel";
import UnlockSection from "@/components/landing/UnlockSection";
import OverviewSection from "@/components/landing/OverviewSection";
import AuditChainSection from "@/components/landing/AuditChainSection";
import PoweredBySection from "@/components/landing/PoweredBySection";

import FaqSection from "@/components/landing/FaqSection";
import StayAheadSection from "@/components/landing/StayAheadSection";
import ContactSection from "@/components/landing/ContactSection";
import SiteFooter from "@/components/landing/SiteFooter";

/**
 * Public landing page - first-scroll experience.
 *
 * A black <Preloader/> splash plays on every full load (first visit + refresh),
 * skipped only on soft client-side nav back to "/", then the page reveals the
 * pinned "device-zoom" hero (<HeroScroll/>, which itself mounts <LandingNav/>
 * and composes <CommandCenterArt/> across the four reference frames), handing
 * off to the subsequent sections.
 *
 * The live data-loop Command Center lives at /desk and is untouched.
 */
export default function LandingPage() {
  return (
    <>
      <Preloader />
      <main>
        <HeroScroll />
        <OverviewSection />
        <FeaturesCarousel />
        <UnlockSection />
        <AuditChainSection />
        <PoweredBySection />

        <FaqSection />
        <StayAheadSection />
        <ContactSection />
        <SiteFooter />
      </main>
    </>
  );
}
