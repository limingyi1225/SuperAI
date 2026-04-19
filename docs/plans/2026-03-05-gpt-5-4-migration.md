# GPT 5.4 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the app's default OpenAI GPT 5.2 family with GPT 5.4 everywhere the project uses those defaults, then deploy the updated app.

**Architecture:** The migration stays within the existing model abstraction. `lib/models.ts` remains the source of truth for model metadata and reasoning tiers, `lib/customModelSliders.ts` remains the source of truth for the custom picker defaults, and `lib/openai.ts` continues to resolve backend model names and Responses API behavior based on requested IDs.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, ESLint, OpenAI Responses API, SSH/PM2 deployment script.

---

### Task 1: Add failing tests for GPT 5.4 defaults

**Files:**
- Modify: `tests/useModelSelection.test.mjs`
- Modify: `tests/custom-model-sliders.test.mjs`

**Step 1: Write the failing test**

Update the affected assertions so they expect `gpt-5.4`, `gpt-5.4-high`, and `gpt-5.4-pro` instead of the old GPT 5.2 IDs.

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/useModelSelection.test.mjs && node --experimental-strip-types tests/custom-model-sliders.test.mjs`
Expected: FAIL because the implementation still exposes GPT 5.2 IDs.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify failure is the intended red state**

Run the same command again after fixing any test typos.

**Step 5: Commit**

Skip commit in this session because the worktree already contains unrelated user changes.

### Task 2: Update the OpenAI model family configuration

**Files:**
- Modify: `lib/models.ts`
- Modify: `lib/customModelSliders.ts`
- Modify: `lib/openai.ts`

**Step 1: Write the minimal implementation**

Replace GPT 5.2 IDs, labels, defaults, and string checks with GPT 5.4 equivalents while preserving the existing behavior split between standard and Pro variants.

**Step 2: Run targeted tests**

Run: `node --experimental-strip-types tests/useModelSelection.test.mjs && node --experimental-strip-types tests/custom-model-sliders.test.mjs`
Expected: PASS.

**Step 3: Refactor if needed**

Keep any refactor limited to repeated GPT family string checks.

**Step 4: Re-run targeted tests**

Run the same command and confirm it stays green.

**Step 5: Commit**

Skip commit in this session because the worktree already contains unrelated user changes.

### Task 3: Update supporting scripts and docs

**Files:**
- Modify: `test-local-storage.js`
- Modify: `test-render.js`
- Modify: `test-hook.js`
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update references**

Replace GPT 5.2 defaults and environment examples with GPT 5.4 values where they describe the default OpenAI family.

**Step 2: Run sanity checks**

Run: `rg -n "gpt-5\\.2|GPT 5\\.2" .`
Expected: only historical logs or intentionally untouched files remain.

**Step 3: Commit**

Skip commit in this session because the worktree already contains unrelated user changes.

### Task 4: Full verification and deployment

**Files:**
- Verify only: `package.json`
- Run: `./deploy.sh`

**Step 1: Run project verification**

Run: `npm run lint`
Expected: exit 0.

**Step 2: Run build**

Run: `npm run build`
Expected: exit 0.

**Step 3: Run final targeted tests**

Run: `node --experimental-strip-types tests/useModelSelection.test.mjs && node --experimental-strip-types tests/custom-model-sliders.test.mjs`
Expected: PASS.

**Step 4: Deploy**

Run: `./deploy.sh`
Expected: remote install/build succeeds and PM2 restarts the app.

**Step 5: Commit**

Skip commit in this session because the worktree already contains unrelated user changes.
