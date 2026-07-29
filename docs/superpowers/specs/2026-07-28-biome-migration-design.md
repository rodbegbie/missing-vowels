# Replace Prettier and ESLint with Biome (frontend)

## Context

The frontend currently uses two separate tools for code quality:

- **Prettier** for formatting `frontend/src/**/*.{ts,tsx,css}`, invoked
  two ways: a root `npm run format` script (`cd frontend && npx
  prettier --write ...`) and a root `lint-staged` entry
  (`prettier --write`) run by the husky pre-commit hook. Prettier is
  installed as a devDependency in *both* `package.json` (root) and
  `frontend/package.json`, redundantly.
- **ESLint** for linting, via `frontend`'s own `npm run lint` script
  (`eslint .`). ESLint is not wired into the pre-commit hook at all —
  it only runs manually or in CI.

This is the first step of a broader tooling upgrade. It replaces both
tools with [Biome](https://biomejs.dev), which formats and lints
JS/TS/CSS in one tool.

## Goals

- One tool (Biome) for JS/TS/CSS formatting and linting in the
  frontend.
- No duplicate installs — a single source of truth for the tool
  version.
- Match the existing cross-directory invocation pattern already used
  for backend tooling (`backend/.venv/bin/ruff format` referenced
  directly from the root `lint-staged` config) rather than introducing
  npm workspaces or another structural change.
- Preserve the existing behavioral split (`format` vs `lint` as
  separate scripts) except where explicitly changed (see below).

## Non-goals

- No npm workspace / monorepo restructuring.
- No changes to backend (Python/ruff) tooling.
- No attempt at 100% rule-for-rule parity with the removed ESLint
  config — documented gaps are accepted trade-offs (see below).

## Design

### Dependency placement

Install `@biomejs/biome` as a devDependency in `frontend/package.json`
only (current latest: `^2.5.5`). Remove `prettier` from both
`package.json` (root) and `frontend/package.json`. Remove `eslint`,
`@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
and `globals` from `frontend/package.json`. Delete
`frontend/eslint.config.js`.

Root-level scripts and `lint-staged` reference the frontend's local
Biome binary by explicit relative path
(`frontend/node_modules/.bin/biome`), the same way the backend already
does for `ruff`. This avoids `npx` falling through to a network
install inside a pre-commit hook, and avoids introducing workspaces
just to share one dev tool.

### Configuration

Add `frontend/biome.json` enabling the formatter and linter for
JS/TS/CSS, with the recommended lint rule set. Formatter settings
match the current Prettier-produced style (2-space indent, double
quotes) — Biome's defaults already track Prettier's defaults closely,
so this should need little explicit configuration beyond confirming
those two settings.

### Script changes

| Location | Today | Becomes |
| --- | --- | --- |
| `frontend/package.json` `lint` | `eslint .` | `biome lint .` |
| `frontend/package.json` | *(no format script)* | add `format`: `biome format --write .` |
| root `package.json` `format` | `cd frontend && npx prettier --write 'src/**/*.{ts,tsx,css}'` | `cd frontend && node_modules/.bin/biome format --write 'src/**/*.{ts,tsx,css}'` |
| root `lint-staged` (frontend entry) | `"frontend/src/**/*.{ts,tsx,css}": ["prettier --write"]` | `"frontend/src/**/*.{ts,tsx,css}": ["frontend/node_modules/.bin/biome check --write"]` |

The `lint-staged` change is a real behavior change, not just a
substitution: `biome check --write` runs formatting, linting, and
import sorting together, so pre-commit now blocks on lint errors it
previously let through untouched (ESLint was never wired into the
hook). This is intentional, per Rod's approval of the design.

`README.md`'s `### Frontend` development-commands section (`npm run
lint` etc.) doesn't need a wording change — `npm run lint` still
exists and still lints, it just runs Biome underneath.

### Removed / added dependencies (frontend/package.json)

- Removed: `prettier`, `eslint`, `@eslint/js`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
  `globals`.
- Added: `@biomejs/biome`.

### Removed / added dependencies (root package.json)

- Removed: `prettier`.
- No additions — root has no direct Biome dependency; it calls
  frontend's local install by path.

### Known fidelity gaps (accepted trade-offs)

- `eslint-plugin-react-hooks`'s `exhaustive-deps` rule maps to
  Biome's `useExhaustiveDependencies` (recommended, enabled by
  default). Its `rules-of-hooks` rule has a Biome equivalent but is
  less thorough — some invalid-hook-call patterns ESLint caught may
  go unflagged.
- `eslint-plugin-react-refresh`'s rule requiring components to be
  exported separately for Fast Refresh has no Biome equivalent. It is
  dropped, not replaced.
- The custom ESLint rule `no-unused-vars` with
  `varsIgnorePattern: '^[A-Z_]'` (allows unused all-caps or
  underscore-prefixed names) has no direct Biome configuration
  equivalent. If Biome's `noUnusedVariables` flags any currently-passing
  code because of this, the fix is an inline
  `// biome-ignore lint/correctness/noUnusedVariables: <reason>`
  comment, decided case-by-case during implementation — not a blocker
  to this design.

## Testing / verification

- `frontend`: `npm run lint` and `npm run format` both run cleanly
  against the existing codebase (or produce only expected, reviewed
  diffs).
- Root: `npm run format` still works from the repo root.
- A staged frontend file with a deliberate formatting issue and a
  deliberate lint issue, committed via `git commit`, is caught by the
  husky pre-commit hook (`lint-staged` invoking `biome check --write`).
- `frontend`: `npm run build` still succeeds (Biome changes are
  tooling-only, no runtime code changes expected beyond
  auto-formatting).
