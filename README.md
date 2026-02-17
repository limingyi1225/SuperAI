This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Access Control (Recommended)

Server-side Basic Auth is supported via `middleware.ts` and protects both pages and `/api/*`.

- `AUTH_ENABLED` (default: `true` in production, `false` in development)
- `AUTH_USERS` (required when enabled, format: `user1:pass1,user2:pass2`)
- `AUTH_REALM` (optional, default: `IsabbY`)

Example:

```env
AUTH_ENABLED=true
AUTH_USERS=isaac:very-strong-password,gf:another-strong-password
AUTH_REALM=IsabbY Private
```

Use long random passwords because this controls API access and model-key spend.

## OpenAI Tools Environment Variables

These are optional and control tool behavior for the OpenAI Responses API path:

- `OPENAI_ENABLE_WEB_SEARCH` (default: `true`)
- `OPENAI_ENABLE_CODE_INTERPRETER` (default: `false`)
- `OPENAI_WEB_SEARCH_CONTEXT_SIZE` (only used when `OPENAI_WEB_SEARCH_TOOL_TYPE=web_search_preview`; values: `low|medium|high`)
- `OPENAI_FORCE_DISABLE_TOOLS` (default: `false`)
- `OPENAI_WEB_SEARCH_TOOL_TYPE` (optional: `web_search` or `web_search_preview`, default: `web_search`)

## Gemini Tools Environment Variables

These are optional and control built-in tool behavior for Gemini:

- `GEMINI_ENABLE_GOOGLE_SEARCH` (default: `true`)
- `GEMINI_ENABLE_CODE_EXECUTION` (default: `true`)
- `GEMINI_FORCE_DISABLE_TOOLS` (default: `false`)

## Claude Environment Variables

These are optional unless you use Claude models:

- `ANTHROPIC_API_KEY` (required for Claude)
- `CLAUDE_MODEL_OPUS` (default: `claude-opus-4-6`)
- `CLAUDE_MODEL` (fallback model if `CLAUDE_MODEL_OPUS` is unset)
- `CLAUDE_MAX_TOKENS` (default: `16384`)
- `CLAUDE_ENABLE_THINKING` (default: `true`, uses `thinking: { type: "adaptive" }`)
- `CLAUDE_OUTPUT_EFFORT` (optional override: `low|medium|high|max`; no implicit remapping)
- `CLAUDE_TOOL_PAUSE_TURN_MAX` (default: `5`)
- `CLAUDE_WEB_SEARCH_MAX_USES` (default: `3`)
- `ANTHROPIC_BETAS` (optional comma-separated beta headers)
- `ANTHROPIC_VERSION` (default: `2023-06-01`)

### Claude Tools Notes

- Claude server tools are enabled with fallback: `web_search + code_execution` -> `web_search only` -> `no tools`.
- Code execution tool uses `code_execution_20250825` and auto-adds `code-execution-2025-08-25` beta header.
- Web search requires Anthropic Console enablement by an admin.
- `pause_turn` is auto-resumed up to `CLAUDE_TOOL_PAUSE_TURN_MAX` rounds.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
