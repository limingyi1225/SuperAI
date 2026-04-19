# GPT 5.4 Migration Design

**Goal:** Replace the project's default OpenAI GPT 5.2 model family with GPT 5.4 across UI labels, model IDs, backend routing, tests, docs, and deployment.

## Scope

- Replace OpenAI model IDs `gpt-5.2`, `gpt-5.2-high`, and `gpt-5.2-pro` with `gpt-5.4`, `gpt-5.4-high`, and `gpt-5.4-pro`.
- Update default reasoning tiers and custom-model slider defaults to use GPT 5.4.
- Update OpenAI backend resolution and capability checks so tool and output-control logic follows the new GPT 5.4 family.
- Update tests, helper scripts, and project documentation that reference GPT 5.2 defaults.
- Deploy the updated app using the existing SSH + PM2 deployment script.

## Non-Goals

- No changes to Gemini or Claude model behavior.
- No redesign of the model picker UI.
- No migration logic for preserving existing `localStorage` values that still contain GPT 5.2 IDs.

## Architecture

The model system is centralized around `lib/models.ts` for display and default selection, `lib/customModelSliders.ts` for custom picker defaults, and `lib/openai.ts` for backend model routing and Responses API behavior. The migration keeps that structure intact and only swaps the OpenAI family identifiers and associated string-based checks.

## Risks

- Any missed hard-coded GPT 5.2 string would cause stale labels, broken selection state, or mismatched backend routing.
- Existing browser `localStorage` values containing GPT 5.2 IDs will be sanitized away on next load rather than transparently remapped.
- Deployment depends on the local `nyuclass` SSH target and the remote server environment remaining valid.

## Validation

- Update model-selection tests first to assert GPT 5.4 defaults.
- Run the affected tests directly with Node's test runner.
- Run `npm run lint` and `npm run build`.
- Deploy with `./deploy.sh` after verification succeeds.
