import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import SiteFooter from "@/components/landing/SiteFooter";
import type { LegalDoc } from "@/content/legal/types";

/**
 * LegalPage - shared layout for the /terms and /privacy routes. Opens with the
 * landing navbar, closes with the landing footer, and renders a readable legal
 * column in between (light theme). Sections carry a mono index + anchor id; a
 * sticky table-of-contents rail appears on large screens. Content is sourced
 * from the committed, A&O-rebranded modules under content/legal/.
 */

const ALL_CAPS = /^[^a-z]*$/; // address lines etc. - rendered as a tight block.

/** Linkify bare emails inside a paragraph so contact addresses are clickable. */
function renderText(text: string) {
  const parts = text.split(/([\w.+-]+@[\w-]+\.[\w.-]+)/g);
  return parts.map((p, i) =>
    /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(p) ? (
      <a key={i} href={`mailto:${p}`} className="underline underline-offset-2 hover:opacity-70" style={{ color: "var(--text-primary)" }}>
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Paragraph({ text }: { text: string }) {
  const caps = ALL_CAPS.test(text) && text.length < 80;
  return (
    <p
      className="font-sans"
      style={{
        fontSize: 14.5,
        lineHeight: 1.75,
        color: "var(--text-body)",
        marginTop: 14,
        ...(caps ? { lineHeight: 1.5, letterSpacing: "0.02em", color: "var(--text-muted)" } : null),
      }}
    >
      {renderText(text)}
    </p>
  );
}

export default function LegalPage({ doc, eyebrow }: { doc: LegalDoc; eyebrow: string }) {
  return (
    <div data-section="light" style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)", minHeight: "100vh" }}>
      <LandingNav />

      <main className="pt-[72px]">
        {/* hero */}
        <header className="mx-auto px-6" style={{ maxWidth: "var(--maxw-content)" }}>
          <div className="pb-12 pt-16 sm:pt-24" style={{ borderTop: "0" }}>
            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
              <span className="font-mono text-[11px] uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
                {eyebrow}
              </span>
            </div>
            <h1
              className="mt-8 font-sans"
              style={{ fontSize: "clamp(34px, 5vw, 60px)", fontWeight: 350, lineHeight: 1.04, letterSpacing: "-0.02em", maxWidth: 820 }}
            >
              {doc.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[13px]" style={{ color: "var(--text-muted)" }}>
              {doc.subtitle && <span>{doc.subtitle}</span>}
              {doc.subtitle && <span aria-hidden="true">·</span>}
              <span>{doc.updated}</span>
            </div>
          </div>
        </header>

        {/* body */}
        <div
          className="mx-auto grid grid-cols-1 px-6 pb-28 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16"
          style={{ maxWidth: "var(--maxw-content)" }}
        >
          {/* sticky TOC (lg+) */}
          <aside className="hidden lg:block">
            <nav className="sticky top-[96px]" aria-label="Contents">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
                Contents
              </span>
              <ol className="mt-4 flex flex-col gap-2.5">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="group flex gap-2 font-sans text-[12.5px] leading-snug transition-colors hover:opacity-100"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span className="font-mono" style={{ color: "var(--text-faint)" }}>{s.num}</span>
                      <span>{s.heading}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          {/* content column */}
          <article style={{ maxWidth: 760 }}>
            {doc.intro.length > 0 && (
              <div className="pb-2">
                {doc.intro.map((p, i) => (
                  <Paragraph key={i} text={p} />
                ))}
              </div>
            )}

            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-[96px] pt-12">
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 22 }}>
                  <span className="font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>
                    {s.num}
                  </span>
                  <h2
                    className="mt-2 font-sans"
                    style={{ fontSize: "clamp(20px, 2.1vw, 26px)", fontWeight: 400, lineHeight: 1.18, letterSpacing: "-0.01em", color: "var(--text-primary)" }}
                  >
                    {s.heading}
                  </h2>
                </div>
                {s.blocks.map((b, i) => (
                  <Paragraph key={i} text={b} />
                ))}
              </section>
            ))}

            {/* demo disclaimer */}
            <p className="mt-16 font-sans text-[12px]" style={{ color: "var(--text-faint)", lineHeight: 1.6 }}>
              This document is provided for the Alpha &amp; Oversight demonstration and is not legal
              advice. Replace with counsel-reviewed terms before any production use.
            </p>

            <div className="mt-8">
              <Link href="/" className="font-sans text-[13px] underline underline-offset-4 hover:opacity-70" style={{ color: "var(--text-primary)" }}>
                ← Back to home
              </Link>
            </div>
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
