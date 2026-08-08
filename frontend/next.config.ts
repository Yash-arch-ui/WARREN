import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow a second dev server to use its own build dir (e.g. NEXT_DIST_DIR=
  // .next-live) so it never collides with the primary `.next` of another
  // running instance. Defaults to `.next` when unset - fully backward-compatible.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
