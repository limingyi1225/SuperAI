## Build & Verify

```bash
npm run build        # must pass before any PR
npm run lint         # eslint — fix all errors
node --experimental-strip-types tests/<name>.test.mjs   # run individual test (no npm test script)
```

There is no `npm test`. Run each test file directly with `node`. All test files are in `tests/` and use Node's built-in test runner.

## Project Structure

Next.js 16 App Router + TypeScript. Multi-model AI tutor that streams responses from OpenAI, Gemini, Claude, and Grok in parallel via SSE.

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
lib/claude.ts              — Claude streaming (@anthropic-ai/sdk)
lib/xai.ts                 — Grok streaming (@ai-sdk/xai)
lib/models.ts              — model configs + REASONING_TIERS
lib/hookUtils.ts           — pure utils with no React deps (testable)
lib/customModelSliders.ts  — slider config
tests/                     — *.test.mjs (Node built-in test runner via `--experimental-strip-types`)
middleware.ts              — Basic HTTP Auth (all routes)
```

## Rules

- Do NOT touch `/liquid glass/` or `components/LiquidGlass/` — unused experiments.
- Do NOT add an `npm test` script — tests are run individually by design.
- `lib/claude.ts` uses `@anthropic-ai/sdk` for Claude API streaming.
- `pdf-parse` must be dynamically imported in `/api/upload` — static import breaks the build.
- `next.config.ts` must keep `output: "standalone"` — required for deployment.
- CSS uses CSS Modules (`*.module.css`) alongside Tailwind. Follow existing patterns.
- Path alias: `@/*` maps to project root.

## Env Vars

API keys: `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`.

Model overrides: `OPENAI_MODEL_LOW`, `OPENAI_MODEL_HIGH`, `OPENAI_MODEL_PRO`, `GEMINI_MODEL`, `CLAUDE_MODEL_OPUS`, `CLAUDE_MODEL_SONNET`, `XAI_MODEL_GROK_MULTI_AGENT`. OpenAI defaults target `gpt-5.4`, `gpt-5.4`, and `gpt-5.4-pro`.

Auth: `AUTH_ENABLED=true`, `AUTH_USERS=user:pass`, `AUTH_REALM=IsabbY`. Set `AUTH_ENABLED=false` for local dev.

## Testing Changes

After any change:
1. `npm run build` — must succeed with zero errors
2. `npm run lint` — must pass
3. Run relevant test files in `tests/` with `node --experimental-strip-types`
4. If you changed `lib/hookUtils.ts`, run ALL tests: `for f in tests/*.test.mjs; do node --experimental-strip-types "$f"; done`
# 🌌 Agent & Skill Configuration
_This file serves as the system instruction set for the AI Agent (Antigravity/Claude/Cursor) operating within this project (`homework-helper`)._

## 🎯 Primary Directives

1. **Always Use Skills Check**: Before tackling complex tasks (refactoring, architecture, UI, DB), you MUST check if a relevant skill exists in your loaded skills directory (e.g., `~/.claude/skills` or `~/.agent/skills`).
2. **Never Guess Patterns**: Use the officially defined skills to guide your implementation patterns rather than defaulting to generic LLM outputs.
3. **No Placeholders**: When writing code or mock data, do not write generic placeholders (e.g., "Insert complex logic here"). Provide complete, production-grade snippets or ask for clarification if blocked.

---

## ⚡️ Required Skills & Scenarios

The AI Agent MUST automatically invoke and adhere to the guidelines of the following skills under the described scenarios:

### 🎨 Frontend & UI/UX Development
* **`@frontend-design` / `@ui-ux-pro-max`**:
  * **When**: Creating new React/Next.js components, pages, or modifying the design system.
  * **Goal**: Ensure the interface is responsive, highly aesthetic, modern, and utilizes micro-animations or glassmorphism where appropriate. Reject generic, boring UI designs.
* **`@tailwind-patterns`**:
  * **When**: Writing or refactoring CSS/styling.
  * **Goal**: Enforce clean Tailwind CSS utility class ordering, custom theme values over hardcoded hex codes, and responsive design breakpoints.

### 🏗️ Architecture & Core Logic
* **`@nextjs-best-practices` / `@nextjs-app-router-patterns`**:
  * **When**: Working on routing, data fetching, API routes, or deciding between Server Components vs. Client Components.
  * **Goal**: Adhere strictly to App Router paradigms. Maximize performance by keeping components on the server by default.
* **`@typescript-expert`**:
  * **When**: Creating types, interfaces, or writing complex logic.
  * **Goal**: Ensure absolute type safety. Avoid `any`. Use strict typing, generics appropriately, and ensure Zod schemas match TS types if applicable.

### 🗄️ Backend & Database
* **`@db-architect` / `@postgres-best-practices`**:
  * **When**: Modifying database schemas, writing queries, or setting up ORMs (Prisma/Drizzle).
  * **Goal**: Ensure efficient indexing, prevent N+1 queries, mandate migration files before schema changes, and enforce data integrity schemas.
* **`@backend-security-coder`**:
  * **When**: Writing authentication logic, API endpoints, or handling user inputs.
  * **Goal**: Sanitize inputs, enforce authorization checks (middleware), and prevent SQL injection/XSS.

### 🚀 Performance & Quality Assurance
* **`@performance-auditor`**:
  * **When**: Completing a major feature or investigating slow load times.
  * **Goal**: Audit for excessive React re-renders, optimize bundle size, and implement caching strategies.
* **`@test-engineer`**:
  * **When**: Adding core utility functions, complex state management, or critical UI flows.
  * **Goal**: Write behavior-driven tests covering edge cases and happy paths using the project's testing framework.
* **`@code-reviewer`**:
  * **When**: Right before submitting a final solution or pull request.
  * **Goal**: Do a final pass over the code for style consistency, bug identification, and standard compliance.

---

## 💡 Custom Workflow Instructions

* **Task Parsing**: When the user provides a high-level goal, break it down using the `task_boundary` mechanic (if complexity warrants) and map those sub-tasks to the designated skills.
* **Aesthetics Rule**: As defined in the `homework-helper` context, visual excellence is mandatory. Adhere to the "Rich Aesthetics" directive (dynamic design, fluid animations, premium feel).
* **Communication**: If a requested change conflicts with a skill's best practices, flag it to the user before proceeding.
