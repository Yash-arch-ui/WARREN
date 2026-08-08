import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `@/…` → project root, mirroring tsconfig `paths`. Vitest does not read
// tsconfig paths, so components that import `@/lib/...` need this alias to
// resolve under both projects.
const rootAlias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

// Two projects under one `vitest run`:
//
//   node   - pure-TS units (parseMarker + any other lib/**/*.test.ts). The
//            default `node` environment is sufficient; no jsdom/react needed.
//   jsdom  - React component / hook suites (*.browser.test.tsx). jsdom DOM +
//            @testing-library/jest-dom matchers via test/setup.ts.
//
// Globals stay OFF in BOTH projects on purpose: every test imports its test
// APIs from "vitest" so `npx tsc --noEmit` (and `next build`'s type-check)
// stays clean without pulling vitest globals into the app's ambient types.
// esbuild transforms the .tsx JSX automatically (tsconfig jsx: react-jsx), so
// no babel/react plugin is required for the testing-library suites.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: rootAlias },
        test: {
          name: "node",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: rootAlias },
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
          include: ["**/*.browser.test.tsx"],
        },
      },
    ],
  },
});
