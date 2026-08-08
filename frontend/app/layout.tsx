import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Base URL for resolving relative OG/Twitter image paths. Overridable via
// NEXT_PUBLIC_SITE_URL in deploy; falls back to the dev port (4100) so the
// file-convention images still resolve locally.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4100";

// Geist for interface type; mono carries all data — keys, addresses, hashes and
// byte counts are things you read character by character, not words.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the /how-it-works "ops" surface ONLY (applied page-scoped via
// [data-surface="ops"] in globals.css). High-contrast editorial serif — a
// deliberate, distinctive counterpoint to the mono data type. Additive: every
// other route keeps Geist and is visually unchanged.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Warren - Mixnet Messenger",
    template: "%s - Warren",
  },
  description:
    "A messenger that hides who is talking to whom. Sphinx mix routing, Double Ratchet bodies, and blind-signed admission tokens.",
  applicationName: "Warren",
  keywords: [
    "mixnet",
    "anonymity",
    "Sphinx",
    "Double Ratchet",
    "blind signatures",
    "metadata privacy",
  ],
  openGraph: {
    type: "website",
    siteName: "Warren",
    title: "Warren - Mixnet Messenger",
    description:
      "Encryption hides what you said. Warren hides that you said it.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Warren - Mixnet Messenger",
    description:
      "Encryption hides what you said. Warren hides that you said it.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020202",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
