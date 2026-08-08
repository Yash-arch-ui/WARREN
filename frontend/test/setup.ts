// jsdom suites only - registers @testing-library/jest-dom's custom matchers
// (toBeInTheDocument, toHaveAttribute, toBeDisabled, …) onto vitest's expect.
// The node project does not load this file (see vitest.config.ts setupFiles).
import "@testing-library/jest-dom/vitest";
