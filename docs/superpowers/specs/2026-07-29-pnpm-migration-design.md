# Design: Migrate from npm to pnpm

## Context

The repo currently has two independent npm projects:

- Root `package.json` — holds `husky` and `lint-staged` for the pre-commit
  hook, plus a `format`/`format:backend` convenience script.
- `frontend/package.json` — the React/webpack app.

Each has its own `package-lock.json` and `node_modules/`, installed
separately (`npm install` at root, then `npm install` again inside
`frontend/`).

`frontend/package.json` also duplicates `husky` (`^9.1.7`) and `lint-staged`
(`^16.2.7`, which mismatches root's `^15.5.2`) as its own devDependencies,
along with a redundant `"prepare": "husky"` script. Neither is needed there —
the git hook lives at the repo root, and lint-staged is invoked from root via
`.husky/pre-commit`.

## Goal

Switch the JS tooling from npm to pnpm, converting the two independent
projects into a single pnpm workspace, and remove the duplicate
husky/lint-staged devDependencies from `frontend/package.json` as part of
the conversion.

## Structure changes

- Add `pnpm-workspace.yaml` at repo root listing `frontend` as a workspace
  package.
- Add `"packageManager": "pnpm@11.5.1"` to root `package.json` (pins the
  version currently installed locally via Corepack conventions, even though
  Corepack itself isn't set up in this environment).
- Remove `husky`, `lint-staged`, and the `"prepare": "husky"` script from
  `frontend/package.json` — these move to being root-only.
- Delete `package-lock.json` (root and `frontend/`) and both `node_modules/`
  directories; run `pnpm install` at root to generate a single root
  `pnpm-lock.yaml` covering both workspace packages.

## Script and doc updates

Mechanical renames only — no behavioral changes:

- `.husky/pre-commit`: `npx lint-staged --shell` becomes
  `pnpm exec lint-staged --shell`.
- `README.md`: collapse the two-step install (`npm install` at root, then
  `cd frontend && npm install`) into a single `pnpm install` at root; update
  the prerequisites line (`Node.js 18+ and npm` → `Node.js 18+ and pnpm`)
  and every `npm run ...` example to `pnpm run ...`.
- `CLAUDE.md`: update the Commands section so `npm run dev` / `build` /
  `lint` / `format` / `format:backend` all become `pnpm run ...`.

## Out of scope

- No CI workflows exist in this repo to update.
- Backend/Python tooling is untouched.
- `.lintstagedrc.mjs` needs no logic changes — its
  `cd frontend && node_modules/.bin/biome ...` command still resolves
  correctly under a pnpm workspace, since pnpm symlinks each workspace
  package's own `node_modules/.bin`.
- `.gitignore` needs no change — `node_modules/` and `frontend/node_modules/`
  are already covered.

## Verification

- `pnpm install` at root succeeds and produces one `pnpm-lock.yaml`.
- `pnpm run format` (root) and `pnpm run format:backend` work.
- From `frontend/`: `pnpm run dev`, `pnpm run build`, `pnpm run lint` work.
- A staged frontend file change triggers Biome via the pre-commit hook
  (`git commit` with `--dry-run` equivalent, or a real trivial commit).
