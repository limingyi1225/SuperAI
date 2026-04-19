import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next.pre-*/**",
    ".next_stale_*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only generated outputs (PPTX helpers, docs drafts, etc.)
    "output/**",
    "docs/**",
    // Worktrees (git isolation dirs) carry their own build artifacts.
    ".claude/**",
  ]),
]);

export default eslintConfig;
