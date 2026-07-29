# pnpm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace npm with pnpm as the JS package manager, converting the
repo's two independent npm projects (root, `frontend/`) into a single pnpm
workspace.

**Architecture:** Add `pnpm-workspace.yaml` at repo root so `frontend`
becomes a workspace package under one root `pnpm-lock.yaml`. Remove the
duplicate `husky`/`lint-staged` devDependencies from `frontend/package.json`
(root already owns the git hook). Update the one script that invokes a JS
tool directly (`.husky/pre-commit`) and the two docs that reference `npm`
(`README.md`, `CLAUDE.md`).

**Tech Stack:** pnpm 11.5.1 (already installed locally at
`/opt/homebrew/bin/pnpm`), no Corepack in this environment.

There is no test suite in this repo (confirmed in `CLAUDE.md`), so every
task's "test" step is a manual verification command, not an automated test.

## Global Constraints

- Pin `"packageManager": "pnpm@11.5.1"` in root `package.json` — exact
  version currently installed locally (from spec).
- Single pnpm workspace: `frontend` is the only workspace package (from
  spec).
- No CI workflows exist in this repo — none to update (from spec).
- `.gitignore` needs no change — `node_modules/` and `frontend/node_modules/`
  already covered (from spec).
- `.lintstagedrc.mjs` needs no logic change — its
  `cd frontend && node_modules/.bin/biome ...` command still resolves under
  a pnpm workspace (from spec).

---

### Task 1: Convert to a pnpm workspace

**Files:**

- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root)
- Modify: `frontend/package.json`
- Delete: `package-lock.json` (root), `frontend/package-lock.json`
- Delete/regenerate: `node_modules/` (root), `frontend/node_modules/`
- Create (generated): `pnpm-lock.yaml` (root)

**Interfaces:**

- Produces: a working pnpm workspace — `pnpm install` at repo root installs
  both the root devDependencies and `frontend`'s dependencies, with
  `frontend/node_modules/.bin/biome` resolvable exactly as it was under npm.
  Later tasks rely on this for the pre-commit hook and docs to be accurate.

- [ ] **Step 1: Create `pnpm-workspace.yaml` at repo root**

```yaml
packages:
  - frontend
```

- [ ] **Step 2: Add the `packageManager` field to root `package.json`**

Edit `package.json`, adding the field after `"private": true,`:

```json
{
  "name": "missing-vowels",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@11.5.1",
  "scripts": {
    "prepare": "husky",
    "format": "cd frontend && node_modules/.bin/biome format --write src",
    "format:backend": "cd backend && .venv/bin/ruff format app.py categories.py"
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^15.5.2"
  }
}
```

- [ ] **Step 3: Remove duplicate husky/lint-staged from `frontend/package.json`**

Remove the `"prepare": "husky"` script (frontend doesn't need its own
prepare step — the git hook lives at repo root) and the `husky` /
`lint-staged` devDependencies (mismatched version from root's copy, and
unused now that root owns the hook). Resulting file:

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "webpack serve --mode development --config webpack.config.cjs",
    "build": "NODE_ENV=production webpack --mode production --config webpack.config.cjs",
    "lint": "biome check .",
    "format": "biome format --write .",
    "preview": "webpack serve --mode production --config webpack.config.cjs"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@babel/core": "^7.28.5",
    "@babel/preset-env": "^7.28.5",
    "@babel/preset-react": "^7.28.5",
    "@biomejs/biome": "^2.5.5",
    "@types/node": "^25.0.3",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "babel-loader": "^10.0.0",
    "css-loader": "^7.1.2",
    "css-minimizer-webpack-plugin": "^7.0.4",
    "html-webpack-plugin": "^5.6.5",
    "mini-css-extract-plugin": "^2.9.4",
    "style-loader": "^4.0.0",
    "terser-webpack-plugin": "^5.3.16",
    "ts-loader": "^9.5.4",
    "typescript": "^5.9.3",
    "vite": "^7.2.4",
    "webpack": "^5.104.1",
    "webpack-cli": "^6.0.1",
    "webpack-dev-server": "^5.2.2"
  }
}
```

- [ ] **Step 4: Delete the npm lockfiles and node_modules**

Run:

```bash
rm -f package-lock.json frontend/package-lock.json
rm -rf node_modules frontend/node_modules
```

- [ ] **Step 5: Install with pnpm**

Run: `pnpm install` (from repo root)

Expected: completes without error, creates `pnpm-lock.yaml` at repo root,
`node_modules/` at repo root, and `frontend/node_modules/` (symlinked into
the workspace store).

- [ ] **Step 6: Verify the workspace resolved correctly**

Run:

```bash
test -f pnpm-lock.yaml && echo "root lockfile OK"
test ! -f frontend/package-lock.json && echo "no stray frontend lockfile OK"
test -x frontend/node_modules/.bin/biome && echo "biome resolves OK"
```

Expected: all three lines print their "OK" message.

- [ ] **Step 7: Commit**

```bash
git add package.json frontend/package.json pnpm-workspace.yaml \
  pnpm-lock.yaml
git rm package-lock.json frontend/package-lock.json
git commit -m "Convert to a pnpm workspace"
```

---

### Task 2: Update the pre-commit hook to use pnpm

**Files:**

- Modify: `.husky/pre-commit`

**Interfaces:**

- Consumes: `pnpm exec` resolving `lint-staged` from root
  `node_modules/.bin`, installed by Task 1.
- Produces: a pre-commit hook that runs under pnpm; no other task depends on
  this.

- [ ] **Step 1: Edit `.husky/pre-commit`**

Change the last line from `npx lint-staged --shell` to
`pnpm exec lint-staged --shell`. Full resulting file:

```bash
# --shell is required: .lintstagedrc.mjs's frontend task returns a "cd frontend && ..."
# command string. Without --shell, lint-staged space-splits it instead of running it
# through a shell, spawning a literal `cd` binary and silently never running Biome.
pnpm exec lint-staged --shell
```

- [ ] **Step 2: Verify lint-staged resolves under pnpm exec**

Run: `pnpm exec lint-staged --version`

Expected: prints a lint-staged version number (no "command not found" or
resolution error).

- [ ] **Step 3: Commit**

```bash
git add .husky/pre-commit
git commit -m "Run pre-commit hook via pnpm exec"
```

---

### Task 3: Update README.md from npm to pnpm

**Files:**

- Modify: `README.md`

**Interfaces:**

- None — documentation only, no other task depends on this file's content.

- [ ] **Step 1: Update the prerequisites line (line 42)**

Change:

```markdown
- Node.js 18+ and npm
```

To:

```markdown
- Node.js 18+ and pnpm
```

- [ ] **Step 2: Collapse the two-step install (lines 55-66)**

Change:

````markdown
2. **Install dependencies**
   ```bash
   # Install root-level dependencies (dev tools)
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   
   # Backend dependencies are managed by UV
   ```
````

To:

````markdown
2. **Install dependencies**
   ```bash
   # Installs both root dev tools and frontend dependencies
   # (single pnpm workspace)
   pnpm install
   
   # Backend dependencies are managed by UV
   ```
````

- [ ] **Step 3: Update the dev server command (line 90)**

Change `npm run dev` to `pnpm run dev` in the "Run the development servers"
section.

- [ ] **Step 4: Update the production build command (line 102)**

Change `npm run build` to `pnpm run build` in the "Production Build"
section.

- [ ] **Step 5: Update the Development Commands section (lines 174-179)**

Change:

```markdown
### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run Biome lint
```
```

To:

```markdown
### Frontend
```bash
cd frontend
pnpm run dev      # Start development server
pnpm run build    # Build for production
pnpm run preview  # Preview production build
pnpm run lint     # Run Biome lint
```
```

- [ ] **Step 6: Update the Code Formatting section (lines 188-198)**

Change:

```markdown
### Code Formatting
```bash
# Format frontend (from root)
npm run format

# Format backend (from root)
npm run format:backend

# Or commit and let husky run formatters automatically
git commit
```
```

To:

```markdown
### Code Formatting
```bash
# Format frontend (from root)
pnpm run format

# Format backend (from root)
pnpm run format:backend

# Or commit and let husky run formatters automatically
git commit
```
```

- [ ] **Step 7: Update the Build Errors troubleshooting section (lines 271-277)**

Change:

```markdown
### Build Errors
```bash
# Clean and reinstall dependencies
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install
```
```

To:

```markdown
### Build Errors
```bash
# Clean and reinstall dependencies
rm -rf node_modules frontend/node_modules
pnpm install
```
```

- [ ] **Step 8: Verify no npm references remain**

Run: `grep -n "npm " README.md || echo "none found"`

Expected: `none found` (the only remaining hits, if any, should be the
literal string "pnpm", not standalone "npm ").

- [ ] **Step 9: Commit**

```bash
git add README.md
git commit -m "Update README.md commands from npm to pnpm"
```

---

### Task 4: Update CLAUDE.md from npm to pnpm

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- None — documentation only, no other task depends on this file's content.

- [ ] **Step 1: Update the Frontend commands block (lines 18-24)**

Change:

````markdown
Frontend (from `frontend/`):
```bash
npm run dev       # webpack dev server (port 8000, proxies /api to :8001 — see Gotchas)
npm run build     # production build to frontend/dist
npm run lint      # biome lint
npm run format    # biome format --write
```
````

To:

````markdown
Frontend (from `frontend/`):
```bash
pnpm run dev       # webpack dev server (port 8000, proxies /api to :8001 — see Gotchas)
pnpm run build     # production build to frontend/dist
pnpm run lint      # biome lint
pnpm run format    # biome format --write
```
````

- [ ] **Step 2: Update the Root commands block (lines 26-30)**

Change:

````markdown
Root (from repo root):
```bash
npm run format          # biome format --write on frontend/src (formatting only, not lint)
npm run format:backend  # ruff format on backend
```
````

To:

````markdown
Root (from repo root):
```bash
pnpm run format          # biome format --write on frontend/src (formatting only, not lint)
pnpm run format:backend  # ruff format on backend
```
````

- [ ] **Step 3: Update the Gotchas mention (line 56)**

Change:

```markdown
- **Dev port mismatch**: `webpack.config.cjs` dev server listens on port 8000 and proxies `/api` to `http://localhost:8001`, but `app.py` hardcodes `port=8000`. Running both dev servers as documented will collide. Either run the backend on 8001 for local dev (edit `app.py`'s `app.run` call) or serve through the production path (`npm run build` in `frontend/`, then run `app.py` alone on 8000 to serve the built static files + API together).
```

To:

```markdown
- **Dev port mismatch**: `webpack.config.cjs` dev server listens on port 8000 and proxies `/api` to `http://localhost:8001`, but `app.py` hardcodes `port=8000`. Running both dev servers as documented will collide. Either run the backend on 8001 for local dev (edit `app.py`'s `app.run` call) or serve through the production path (`pnpm run build` in `frontend/`, then run `app.py` alone on 8000 to serve the built static files + API together).
```

- [ ] **Step 4: Verify no npm references remain**

Run: `grep -n "npm " CLAUDE.md || echo "none found"`

Expected: `none found`.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md commands from npm to pnpm"
```

---

### Task 5: End-to-end verification

**Files:**

- None (verification only, no changes expected).

**Interfaces:**

- Consumes: everything produced by Tasks 1-4.

- [ ] **Step 1: Verify root formatting scripts**

Run: `pnpm run format` (from repo root)

Expected: exits 0, runs Biome against `frontend/src`.

- [ ] **Step 2: Verify backend formatting script**

Run: `pnpm run format:backend` (from repo root)

Expected: exits 0, runs ruff format against the backend.

- [ ] **Step 3: Verify frontend scripts**

Run, from `frontend/`:

```bash
pnpm run lint
pnpm run build
```

Expected: both exit 0. `pnpm run build` produces/refreshes `frontend/dist`.

- [ ] **Step 4: Verify the pre-commit hook fires under pnpm**

Make a trivial whitespace-only change to a frontend file already tracked
in git (e.g. add and remove a blank line), stage it, and commit:

```bash
git add -A
git commit -m "test: verify pre-commit hook runs under pnpm"
```

Expected: the commit output shows lint-staged running Biome via
`pnpm exec` (no "command not found" errors), and the commit succeeds. If
the trivial change produced no actual diff after Biome formatting, note
that in the report and skip creating an empty commit.

- [ ] **Step 5: Confirm no stray npm artifacts remain**

Run:

```bash
find . -name "package-lock.json" -not -path "*/node_modules/*"
```

Expected: no output (both old lockfiles are gone, replaced by the single
root `pnpm-lock.yaml`).
