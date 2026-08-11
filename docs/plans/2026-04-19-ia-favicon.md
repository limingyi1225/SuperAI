# IA Favicon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the site's current lowercase `i` favicon with the approved powder baby blue `A` variant of the custom `IA` monogram.

**Architecture:** Keep the existing Next.js metadata wiring unchanged so `/favicon.svg` remains the canonical linked icon. Update the SVG asset itself to the approved powder blue palette and monogram structure, regenerate the `.ico` variant from that source, and keep the regression test focused on asset markers rather than subjective visual quality.

**Tech Stack:** Next.js 16, TypeScript metadata, SVG, Node test runner, ffmpeg.

---

### Task 1: Add a favicon asset regression test

**Files:**
- Create: `tests/favicon-asset.test.mjs`
- Verify only: `app/layout.tsx`
- Verify only: `public/favicon.svg`

**Step 1: Write the failing test**

Create a test that asserts:
- `app/layout.tsx` still links `/favicon.svg` as an SVG icon
- `public/favicon.svg` contains the new `id="ia-monogram"` marker
- `public/favicon.svg` no longer renders the old lowercase `i` text glyph

**Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types tests/favicon-asset.test.mjs`
Expected: FAIL because the current SVG still contains the old `i` mark and does not contain the new monogram marker.

**Step 3: Fix any broken test assumptions**

Keep the test focused on asset contract only. Do not assert on subjective appearance.

**Step 4: Re-run test to confirm intended red state**

Run the same command again and confirm the failure is still caused by the missing `IA` asset markers.

**Step 5: Commit**

Skip commit in this session because the repository already contains unrelated untracked content.

### Task 2: Replace the favicon artwork

**Files:**
- Modify: `public/favicon.svg`
- Regenerate: `app/favicon.ico`

**Step 1: Write the minimal implementation**

Replace the old asset with:
- a powder baby blue rounded tile
- a navy `IA` monogram based on the selected `A` concept
- subtle inset polish that still survives small-size rendering

**Step 2: Regenerate the `.ico` variant**

Run: `ffmpeg -y -i public/favicon.svg app/favicon.ico`
Expected: `app/favicon.ico` is recreated from the new SVG artwork.

**Step 3: Run the targeted test**

Run: `node --experimental-strip-types tests/favicon-asset.test.mjs`
Expected: PASS.

**Step 4: Inspect asset consistency**

Run: `file app/favicon.ico public/favicon.svg`
Expected: a valid Windows icon resource and a valid SVG file.

**Step 5: Commit**

Skip commit in this session because the repository already contains unrelated untracked content.

### Task 3: Verify integration

**Files:**
- Verify only: `package.json`

**Step 1: Run the targeted favicon regression test**

Run: `node --experimental-strip-types tests/favicon-asset.test.mjs`
Expected: PASS.

**Step 2: Run a production build**

Run: `npm run build`
Expected: exit `0`.

**Step 3: Review the final diff**

Run: `git status --short`
Expected: only the intended docs, test, SVG, and regenerated favicon files are changed.

**Step 4: Commit**

Skip commit in this session because the repository already contains unrelated untracked content.
