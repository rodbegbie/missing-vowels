# Replace Prettier and ESLint with Biome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prettier and ESLint in the frontend with a single
Biome install that formats and lints JS/TS/CSS, with no duplicate
tool installs and no npm workspaces introduced.

**Architecture:** Biome is installed once, in `frontend/package.json`.
Root-level scripts and the husky/lint-staged pre-commit hook call it
by explicit relative path (`frontend/node_modules/.bin/biome`),
mirroring the existing `backend/.venv/bin/ruff` pattern. ESLint's
config file and Prettier's two redundant installs are removed
outright.

**Tech Stack:** `@biomejs/biome` (JS/TS/CSS formatter + linter),
replacing `prettier`, `eslint`, `@eslint/js`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`.

## Global Constraints

- Single Biome install: `frontend/package.json` only. Do not add
  `@biomejs/biome` to the root `package.json`.
- Root scripts and `lint-staged` reference
  `frontend/node_modules/.bin/biome` directly — never `npx biome`
  (risk of a pre-commit hook trying to network-install).
- No npm workspaces, no monorepo restructuring.
- No backend (Python/ruff) changes.
- Formatter must match current style: 2-space indent, double quotes.
- `lint-staged`'s frontend entry becomes `biome check --write`
  (format + lint + import sort) — this is an intentional behavior
  change: pre-commit now blocks on lint errors it previously let
  through (ESLint was never wired into the hook).
- Every finding Biome reports against real source (not generated
  `dist/` output) must be resolved by the end of this plan — either
  fixed for real, or suppressed with an inline `// biome-ignore`
  comment carrying a one-line reason, never silently disabled at the
  config level.

---

### Task 1: Swap frontend dependencies for Biome

**Files:**

- Modify: `frontend/package.json`
- Delete: `frontend/eslint.config.js`
- Create: `frontend/biome.json`

**Interfaces:**

- Produces: a working `frontend/node_modules/.bin/biome` binary and
  `frontend/biome.json` config that Task 2 and Task 3 both depend on.

- [ ] **Step 1: Remove Prettier and ESLint from frontend**

Run from `frontend/`:

```bash
npm uninstall prettier eslint @eslint/js eslint-plugin-react-hooks eslint-plugin-react-refresh globals
```

- [ ] **Step 2: Verify removal**

Run: `grep -iE "prettier|eslint" frontend/package.json`
Expected: no output (exit code 1).

- [ ] **Step 3: Delete the ESLint config**

```bash
rm frontend/eslint.config.js
```

- [ ] **Step 4: Install Biome**

Run from `frontend/`:

```bash
npm install --save-dev @biomejs/biome
```

- [ ] **Step 5: Verify the binary and note the installed version**

```bash
frontend/node_modules/.bin/biome --version
```

Expected: prints a version starting `Version: 2.`. Note the exact
version string — you'll need it for the `$schema` URL in Step 6
(e.g. if it prints `2.5.5`, the schema URL is
`https://biomejs.dev/schemas/2.5.5/schema.json`).

- [ ] **Step 6: Create `frontend/biome.json`**

Using the exact version from Step 5 in place of `2.5.5` below:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.5/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended"
    }
  }
}
```

The `vcs.useIgnoreFile: true` setting is load-bearing: it makes Biome
respect `frontend/.gitignore` (which already excludes `dist`).
Without it, Biome lints the built, minified `dist/` bundle by
default and produces thousands of false-positive diagnostics from
minifier-generated code patterns (comma operators, assignment
expressions) that have nothing to do with the real source.

- [ ] **Step 7: Verify Biome sees the right files and ignores `dist/`**

Run from `frontend/`:

```bash
node_modules/.bin/biome lint . 2>&1 | tail -5
```

Expected: a line reading `Checked 12 files in ...ms` (not hundreds —
if you see a file count in the thousands or a "diagnostics exceeds
the limit" warning, `dist/` is being linted; re-check Step 6's `vcs`
block and that `frontend/.gitignore` contains `dist`).

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/biome.json
git rm frontend/eslint.config.js
git commit -m "Replace Prettier and ESLint with Biome in frontend"
```

---

### Task 2: Wire up scripts and resolve real Biome findings

**Files:**

- Modify: `frontend/package.json` (scripts)
- Modify: `frontend/webpack.config.cjs`
- Modify: `frontend/src/App.tsx`

**Interfaces:**

- Consumes: `frontend/node_modules/.bin/biome` and `frontend/biome.json`
  from Task 1.
- Produces: `npm run lint` and `npm run format` scripts that Task 4's
  pre-commit smoke test and Task 5's docs updates both reference.

- [ ] **Step 1: Update frontend scripts**

In `frontend/package.json`, change:

```json
    "lint": "eslint .",
```

to:

```json
    "lint": "biome lint .",
    "format": "biome format --write .",
```

(Insert `format` as a new line; keep the surrounding `dev`, `build`,
`preview`, `prepare` scripts unchanged.)

- [ ] **Step 2: Run the formatter and review the diff**

Run from `frontend/`:

```bash
npm run format
cd .. && git status --porcelain
```

Expected: exactly one line, `M frontend/webpack.config.cjs`. (If
`src/App.tsx`, `src/App.css`, `src/index.css`, or `src/main.tsx` show
up too, something about the formatter config differs from what was
verified during design — stop and compare `biome.json` against
Step 6 of Task 1 before continuing.)

- [ ] **Step 3: Run the linter to see the real findings**

Run from `frontend/`:

```bash
npm run lint
```

Expected output: exactly these 11 diagnostics (9 errors, 1 warning, 1
info) — all against `webpack.config.cjs` and `src/App.tsx`:

- `webpack.config.cjs:1` — `lint/style/useNodejsImportProtocol` (info)
- `src/App.tsx` — `lint/correctness/noUnusedVariables` on `idx`
  (warning)
- `src/App.tsx` — `lint/a11y/noStaticElementInteractions` (error)
- `src/App.tsx` — `lint/a11y/useKeyWithClickEvents` (error)
- `src/App.tsx` — `lint/correctness/useExhaustiveDependencies` (error)
- `src/App.tsx` — `lint/a11y/useButtonType` ×4 (error)
- `src/App.tsx` — `lint/suspicious/noArrayIndexKey` ×2 (error)

If you see different findings, the codebase has changed since this
plan was written — fix genuine issues on their merits and use the
same fix-or-suppress judgment calls below as a guide, not a literal
checklist.

- [ ] **Step 4: Fix `webpack.config.cjs`'s Node import protocol**

Change line 1 from:

```javascript
const path = require('path');
```

to (note: this line is already double-quoted by the Step 2 format
pass, so only the `node:` prefix changes here):

```javascript
const path = require("node:path");
```

- [ ] **Step 5: Remove the dead `idx` variable in `App.tsx`**

Find this block (the `consonantPositions` memo, above the
`AnimatedTitle` component's `letters` memo):

```typescript
  const consonantPositions = useMemo(() => {
    const positions: { group: number; pos: number }[] = [];
    let idx = 0;
    for (let g = 0; g < grouping.length; g++) {
      for (let p = 0; p < grouping[g]; p++) {
        positions.push({ group: g, pos: p });
        idx++;
      }
    }
    return positions;
  }, [grouping]);
```

Replace it with (removing the unused counter entirely — it's
incremented but never read):

```typescript
  const consonantPositions = useMemo(() => {
    const positions: { group: number; pos: number }[] = [];
    for (let g = 0; g < grouping.length; g++) {
      for (let p = 0; p < grouping[g]; p++) {
        positions.push({ group: g, pos: p });
      }
    }
    return positions;
  }, [grouping]);
```

- [ ] **Step 6: Fix the missing hook dependency in `App.tsx`**

Find the `letters` memo's dependency array (a few lines below the
block from Step 5):

```typescript
  }, [phase, consonantPositions]);
```

Change it to:

```typescript
  }, [phase, consonantPositions, vowels.has]);
```

- [ ] **Step 7: Suppress the two accessibility findings on the voice
  toggle in `App.tsx`**

Find:

```typescript
          {voiceEnabled && voiceSupported && !isRevealed && (
            <div
              className={`voice-indicator ${isListening ? "listening" : ""}`}
              onClick={!isListening ? startListening : undefined}
              style={{ cursor: !isListening ? "pointer" : "default" }}
            >
```

Change it to:

```typescript
          {voiceEnabled && voiceSupported && !isRevealed && (
            // biome-ignore lint/a11y/noStaticElementInteractions: voice toggle mirrors the checkbox above it; full keyboard support is a separate follow-up
            // biome-ignore lint/a11y/useKeyWithClickEvents: voice toggle mirrors the checkbox above it; full keyboard support is a separate follow-up
            <div
              className={`voice-indicator ${isListening ? "listening" : ""}`}
              onClick={!isListening ? startListening : undefined}
              style={{ cursor: !isListening ? "pointer" : "default" }}
            >
```

This is a deliberate suppress-not-fix: adding real keyboard support
to the voice toggle is a UI feature change, out of scope for a
tooling swap.

- [ ] **Step 8: Add `type="button"` to the four buttons in
  `App.tsx`**

There is no `<form>` anywhere in this app, so this is a pure
best-practice addition with zero behavior change.

Find (in the difficulty-selection menu):

```typescript
              <button
                key={d.level}
                className={`difficulty-btn difficulty-${d.level}`}
                onClick={() => startGame(d.level)}
                disabled={d.count === 0}
              >
```

Change to:

```typescript
              <button
                key={d.level}
                type="button"
                className={`difficulty-btn difficulty-${d.level}`}
                onClick={() => startGame(d.level)}
                disabled={d.count === 0}
              >
```

Find (the "Got It!" / "Show Answer" pair):

```typescript
              <button
                className="btn btn-correct"
                onClick={() => revealAnswer(true)}
              >
                ✓ Got It!
              </button>
              <button
                className="btn btn-wrong"
                onClick={() => revealAnswer(false)}
              >
                ✗ Show Answer
              </button>
```

Change to:

```typescript
              <button
                type="button"
                className="btn btn-correct"
                onClick={() => revealAnswer(true)}
              >
                ✓ Got It!
              </button>
              <button
                type="button"
                className="btn btn-wrong"
                onClick={() => revealAnswer(false)}
              >
                ✗ Show Answer
              </button>
```

Find (the "Play Again" button on the results screen):

```typescript
          <button className="btn btn-play-again" onClick={playAgain}>
            Play Again
          </button>
```

Change to:

```typescript
          <button
            type="button"
            className="btn btn-play-again"
            onClick={playAgain}
          >
            Play Again
          </button>
```

- [ ] **Step 9: Suppress the two array-index-key findings in
  `App.tsx`**

Find (the round progress dots):

```typescript
        <div className="progress-bar">
          {round.clues.map((_, i) => (
            <div
              key={i}
```

Change to:

```typescript
        <div className="progress-bar">
          {round.clues.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: clues are a fixed-length, non-reordering array for the round
            <div
              key={i}
```

Find (the results-screen answers list):

```typescript
                {answers.map((answer, i) => (
                  <li key={i} className={answer.correct ? "correct" : "missed"}>
```

Change to:

```typescript
                {answers.map((answer, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: answers are a fixed, non-reordering list built once per results screen
                  <li key={i} className={answer.correct ? "correct" : "missed"}>
```

This is a suppress-not-fix like Step 7: the arrays here are static
per round/results screen (never reordered or spliced), so index keys
are safe in practice, but proving that to Biome would mean switching
key strategy — a separate, explicitly-scoped change if wanted later.

- [ ] **Step 10: Re-run the linter and confirm it's clean**

Run from `frontend/`:

```bash
npm run lint
```

Expected: `Checked 12 files in ...ms. No fixes applied.` with no
errors, warnings, or infos listed (exit code 0).

- [ ] **Step 11: Confirm the production build still works**

Run from `frontend/`:

```bash
npm run build
```

Expected: webpack compiles successfully (same output shape as
before — a `vendors.*.js`, `main.*.js`, `main.*.css`, and
`index.html` under `frontend/dist/`).

- [ ] **Step 12: Commit**

```bash
git add frontend/package.json frontend/webpack.config.cjs frontend/src/App.tsx
git commit -m "Fix Biome findings and add lint/format scripts to frontend"
```

---

### Task 3: Update root tooling to call Biome by path

**Files:**

- Modify: `package.json` (root)

**Interfaces:**

- Consumes: `frontend/node_modules/.bin/biome` from Task 1.

- [ ] **Step 1: Remove Prettier from the root project**

Run from the repo root:

```bash
npm uninstall prettier
```

- [ ] **Step 2: Update the root `format` script**

Change:

```json
    "format": "cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}'",
```

to:

```json
    "format": "cd frontend && node_modules/.bin/biome format --write 'src/**/*.{ts,tsx,css}'",
```

- [ ] **Step 3: Update the `lint-staged` frontend entry**

Change:

```json
  "lint-staged": {
    "frontend/src/**/*.{ts,tsx,css}": [
      "prettier --write"
    ],
```

to:

```json
  "lint-staged": {
    "frontend/src/**/*.{ts,tsx,css}": [
      "frontend/node_modules/.bin/biome check --write"
    ],
```

- [ ] **Step 4: Verify no Prettier references remain**

```bash
grep -i prettier package.json
```

Expected: no output (exit code 1).

- [ ] **Step 5: Verify the root format script works**

```bash
npm run format
```

Expected: exits 0 with no diff (the files are already
Biome-formatted from Task 2).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "Point root format script and lint-staged at Biome"
```

---

### Task 4: Verify the pre-commit hook actually catches issues

**Files:** none (verification only — all edits in this task are
temporary and reverted at the end).

**Interfaces:** none — this task only exercises Tasks 1–3's output.

- [ ] **Step 1: Confirm an auto-fixable issue gets fixed and
  committed**

Temporarily change one string in `frontend/src/App.tsx` from double
to single quotes — find:

```typescript
const API_URL = "/api";
```

to:

```typescript
const API_URL = '/api';
```

Then:

```bash
git add frontend/src/App.tsx
git commit -m "test: verify biome pre-commit hook (auto-fix)"
```

Expected: the commit succeeds, and the `lint-staged` output shown
during the commit mentions `biome check --write` running against
`frontend/src/App.tsx`.

- [ ] **Step 2: Confirm the fix was real, then remove the test
  commit**

```bash
git diff HEAD~1 HEAD -- frontend/src/App.tsx
```

Expected: no output — Biome auto-fixed the single quote back to a
double quote before the commit was recorded, so there's no net
change from the version before Step 1.

```bash
git reset --soft HEAD~1
git restore --staged frontend/src/App.tsx
git checkout -- frontend/src/App.tsx
```

- [ ] **Step 3: Confirm a real lint error blocks the commit**

Temporarily reintroduce the missing-dependency bug fixed in Task 2
Step 6 — change:

```typescript
  }, [phase, consonantPositions, vowels.has]);
```

back to:

```typescript
  }, [phase, consonantPositions]);
```

Then:

```bash
git add frontend/src/App.tsx
git commit -m "test: verify biome pre-commit hook (blocking)"
```

Expected: the commit **fails** (non-zero exit) — `lint-staged`
reports the `useExhaustiveDependencies` error and husky aborts the
commit. `git log -1 --oneline` should still show Task 3's commit as
`HEAD`, confirming no test commit landed.

- [ ] **Step 4: Discard the temporary change**

```bash
git checkout -- frontend/src/App.tsx
git status --porcelain
```

Expected: no output — working tree clean, matching the end of
Task 3.

---

### Task 5: Update README.md and CLAUDE.md references

**Files:**

- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `README.md`'s tech stack list**

Change:

```markdown
- Prettier for frontend formatting
```

to:

```markdown
- Biome for frontend formatting and linting
```

- [ ] **Step 2: Update `README.md`'s frontend command comment**

Change:

```bash
npm run lint     # Run ESLint
```

to:

```bash
npm run lint     # Run Biome lint
```

- [ ] **Step 3: Update `README.md`'s project structure comment**

Change:

```text
├── package.json            # Root dev tools (husky, prettier)
```

to:

```text
├── package.json            # Root dev tools (husky, lint-staged)
```

- [ ] **Step 4: Update `CLAUDE.md`'s frontend commands block**

Change:

```bash
npm run dev       # webpack dev server (port 8000, proxies /api to :8001 — see Gotchas)
npm run build     # production build to frontend/dist
npm run lint      # eslint
```

to:

```bash
npm run dev       # webpack dev server (port 8000, proxies /api to :8001 — see Gotchas)
npm run build     # production build to frontend/dist
npm run lint      # biome lint
npm run format    # biome format --write
```

- [ ] **Step 5: Update `CLAUDE.md`'s root commands block**

Change:

```bash
npm run format          # prettier on frontend/src/**/*.{ts,tsx,css}
npm run format:backend  # ruff format on backend
```

to:

```bash
npm run format          # biome format on frontend/src/**/*.{ts,tsx,css}
npm run format:backend  # ruff format on backend
```

- [ ] **Step 6: Update `CLAUDE.md`'s pre-commit description**

Change:

```markdown
Pre-commit (husky + lint-staged) runs prettier on frontend files and `ruff format` + `ty check` on backend `.py` files. Don't bypass this.
```

to:

```markdown
Pre-commit (husky + lint-staged) runs `biome check --write` (format + lint + import sort) on frontend files and `ruff format` + `ty check` on backend `.py` files. Don't bypass this.
```

- [ ] **Step 7: Lint-check both files**

```bash
npx --yes markdownlint-cli README.md CLAUDE.md
```

Expected: only pre-existing violations from before this plan (if
any) — no new ones introduced by the six edits above. Compare against
a `git stash` / `git stash pop` before-and-after run if unsure
whether a given violation is new.

- [ ] **Step 8: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "Update docs: Biome replaces Prettier and ESLint"
```
