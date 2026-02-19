## Build & Verify

```bash
npm run build        # must pass before any PR
npm run lint         # eslint — fix all errors
node tests/<name>.test.mjs   # run individual test (no npm test script)
```

There is no `npm test`. Run each test file directly with `node`. All test files are in `tests/` and use Node's built-in test runner.

## Project Structure

Next.js 16 App Router + TypeScript. Multi-model AI tutor that streams responses from OpenAI, Gemini, and Claude in parallel via SSE.

```
app/api/ask/route.ts       — SSE streaming endpoint (parallel multi-model)
app/api/upload/route.ts    — file upload (images→base64, PDFs→text)
app/api/generate-title/    — title generation (gpt-5-nano)
app/page.tsx               — main UI (client component)
components/                — React client components (*.tsx + *.module.css)
context/SessionContext.tsx  — session state + localStorage persistence
hooks/                     — custom React hooks
lib/openai.ts              — OpenAI Responses API streaming
lib/gemini.ts              — Google Gemini streaming (@google/genai SDK)
lib/claude.ts              — Claude streaming (raw fetch, NOT Anthropic SDK)
lib/models.ts              — model configs + REASONING_TIERS
lib/hookUtils.ts           — pure utils with no React deps (testable)
lib/customModelSliders.ts  — slider config
tests/                     — *.test.mjs (Node built-in test runner)
middleware.ts              — Basic HTTP Auth (all routes)
```

## Rules

- Do NOT touch `/liquid glass/` or `components/LiquidGlass/` — unused experiments.
- Do NOT add an `npm test` script — tests are run individually by design.
- `lib/claude.ts` uses raw `fetch()` against the Anthropic API. Do not refactor to use `@anthropic-ai/sdk`.
- `pdf-parse` must be dynamically imported in `/api/upload` — static import breaks the build.
- `next.config.ts` must keep `output: "standalone"` — required for deployment.
- CSS uses CSS Modules (`*.module.css`) alongside Tailwind. Follow existing patterns.
- Path alias: `@/*` maps to project root.

## Env Vars

API keys: `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `ANTHROPIC_API_KEY`.

Model overrides: `OPENAI_MODEL_LOW`, `OPENAI_MODEL_HIGH`, `OPENAI_MODEL_PRO`, `GEMINI_MODEL`, `CLAUDE_MODEL_OPUS`, `CLAUDE_MODEL_SONNET`.

Auth: `AUTH_ENABLED=true`, `AUTH_USERS=user:pass`, `AUTH_REALM=IsabbY`. Set `AUTH_ENABLED=false` for local dev.

## Testing Changes

After any change:
1. `npm run build` — must succeed with zero errors
2. `npm run lint` — must pass
3. Run relevant test files in `tests/` with `node`
4. If you changed `lib/hookUtils.ts`, run ALL tests: `for f in tests/*.test.mjs; do node "$f"; done`
