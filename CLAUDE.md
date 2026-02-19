## Commands

```bash
npm run dev      # Dev server on localhost:3000
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
bash deploy.sh   # rsync + build + PM2 restart on server (nyuclass:/var/www/isabby)

# Run individual tests (no test script configured)
node tests/<test-name>.test.mjs
```

## Architecture

Next.js 16 App Router + TypeScript. Multi-model AI homework tutor — users submit questions/files and get parallel streaming responses from OpenAI, Gemini, and Claude simultaneously.

```
app/
  api/ask/route.ts         # Main SSE streaming endpoint (multi-model parallel)
  api/upload/route.ts      # File handler (images→base64, PDFs→text via pdf-parse)
  api/generate-title/      # Uses gpt-5-nano for fast title generation
  page.tsx                 # Main UI (client component)
components/                # All client components
context/SessionContext.tsx # Session state + localStorage persistence (debounced 800ms)
hooks/                     # Custom hooks (useDragDrop, useFileUpload, useModelSelection,
                           #   useQuestionSubmit, useTheme, useToast)
                           # Pure logic extracted to lib/hookUtils.ts for testability
lib/
  models.ts               # Model configs, reasoning tiers (REASONING_TIERS)
  openai.ts               # OpenAI Responses API streaming
  gemini.ts               # Google Gemini streaming
  claude.ts               # Anthropic Claude streaming (raw fetch, no SDK)
  hookUtils.ts            # Pure utils (no React deps) — testable without mounting
  customModelSliders.ts   # Custom model slider configurations
tests/                     # *.test.mjs using Node built-in test runner
```

## Key Patterns

**SSE Streaming**: `/api/ask` uses `TransformStream` to stream per-model responses in parallel. Event types: `start`, `chunk`, `reasoning_summary_*`, `done`, `error`, `complete`.

**Model IDs via env vars**: `gpt-5.2-low/high/pro` resolve through `OPENAI_MODEL_LOW/HIGH/PRO`. Claude models via `CLAUDE_MODEL_OPUS/SONNET`. Gemini via `GEMINI_MODEL`.

**Tool fallback chains**: Each provider tries full tools → search only → no tools. Set `*_FORCE_DISABLE_TOOLS=true` to skip entirely.

**Reasoning extraction differs per provider**:
- OpenAI: `response.reasoning_summary_*` events
- Gemini: `part.thought === true` in content parts
- Claude: `thinking` content blocks

**LaTeX preprocessing** (`lib/hookUtils.ts`): `\[...\]`→`$$...$$`, `\(...\)`→`$...$`. Applied before react-markdown. Code blocks are preserved first.

**Conversation history**: Max 8 turns (`MAX_HISTORY_TURNS`), text clipped to 12000 chars/turn, images stored in separate `userImages` array.

**Testing**: Pure logic lives in `lib/hookUtils.ts` with no React deps, enabling unit tests without mounting. Run with `node tests/*.test.mjs`.

## Environment Variables

```
# Required API keys
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
ANTHROPIC_API_KEY=

# Model overrides
OPENAI_MODEL_LOW=gpt-5.2
OPENAI_MODEL_HIGH=gpt-5.2
OPENAI_MODEL_PRO=gpt-5.2-pro
GEMINI_MODEL=gemini-3.1-pro-preview  # frontend model ID is gemini-3.1-pro; fallback default is gemini-2.0-flash
CLAUDE_MODEL_OPUS=claude-opus-4-6
CLAUDE_MODEL_SONNET=claude-sonnet-4-6

# Tool toggles (default: web search on, code execution varies)
OPENAI_ENABLE_WEB_SEARCH=true
OPENAI_ENABLE_CODE_INTERPRETER=false
OPENAI_WEB_SEARCH_CONTEXT_SIZE=medium    # low | medium | high
GEMINI_ENABLE_GOOGLE_SEARCH=true
GEMINI_ENABLE_CODE_EXECUTION=true
CLAUDE_ENABLE_THINKING=true
CLAUDE_WEB_SEARCH_MAX_USES=3
CLAUDE_OUTPUT_EFFORT=                    # Override effort level for Claude

# Auth (Basic HTTP Auth via middleware.ts)
AUTH_ENABLED=true
AUTH_USERS=user1:pass1,user2:pass2
AUTH_REALM=IsabbY
```

## Common Modifications

- **Add reasoning tier**: Update `REASONING_TIERS` in `lib/models.ts`
- **Add provider tool**: Update `buildTools()` in the relevant `lib/*.ts`
- **Change history limit**: Update `MAX_HISTORY_TURNS` in `lib/hookUtils.ts`
- **New component**: Create in `components/`, import in `app/page.tsx`
- **Adjust effort mapping**: Update effort resolution in `lib/openai.ts`, `lib/claude.ts`

## Gotchas

- `pdf-parse` uses dynamic import in `/api/upload` to avoid bundling issues
- `/liquid glass/` subdirectory is an unused Vite experiment — ignore it
- `middleware.ts` Basic Auth applies to all routes including API; disable in dev via `AUTH_ENABLED=false`
- `lib/claude.ts` uses raw `fetch()` to the Anthropic API (not the SDK), unlike OpenAI/Gemini which use npm packages
- Claude `pause_turn` auto-resumes up to 5 times (`CLAUDE_TOOL_PAUSE_TURN_MAX`)
- `next.config.ts` uses `output: 'standalone'` — required for `deploy.sh` PM2 deployment
- No `npm test` script configured; run test files directly with `node`
