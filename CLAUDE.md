# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page word game (BBC "Only Connect" Missing Vowels round): a Flask backend serves clue rounds, a React/TypeScript frontend renders the game and does all scoring/matching client-side.

## Commands

Backend (from `backend/`):
```bash
uv run python app.py       # run Flask server (port 8000)
.venv/bin/ruff format app.py categories.py   # format
.venv/bin/ruff check app.py categories.py    # lint
.venv/bin/ty check                            # type check
```

Frontend (from `frontend/`):
```bash
pnpm run dev       # webpack dev server (port 8000, proxies /api to :8001 — see Gotchas)
pnpm run build     # production build to frontend/dist
pnpm run lint      # biome lint
pnpm run format    # biome format --write
```

Root (from repo root):
```bash
pnpm run format          # biome format --write on frontend/src (formatting only, not lint)
pnpm run format:backend  # ruff format on backend
pnpm run lint:backend    # ruff check on backend
```

There is no test suite (no pytest/vitest/jest configured) — verify changes by running the app manually.

Pre-commit (husky + lint-staged) runs `biome check --write` (format + lint + import sort) on frontend files and `ruff check` + `ruff format` + `ty check` on backend `.py` files. Don't bypass this.

## Architecture

**Backend is a pure data API, stateless per request.** `backend/app.py`:
- `categories.py` holds `CATEGORIES`: a hardcoded list of `{name, answers, obscurity_modifier}` dicts (400+ British-graduate-knowledge categories — sports, PMs, tube lines, etc).
- On startup, `filter_categories()` drops any answer without a vowel or containing a digit, then drops categories left with fewer than 5 valid answers, producing `FILTERED_CATEGORIES`.
- `calculate_difficulty()` then scores each surviving category 1–5 from answer length, vowel density, word count, and the category's `obscurity_modifier`. This runs once at import time, not per-request.
- `GET /api/difficulties` — level counts for the menu.
- `GET /api/round?difficulty=N` — picks a random category at that difficulty (widening the search outward by ±1, ±2... if none match exactly), samples up to 4 answers, and returns them via `format_missing_vowels()` (strips vowels, uppercases, inserts randomized word-group spacing) with the real answer ROT13-encoded in the `answer` field.
- `GET /api/categories` — full category/difficulty listing.
- In production the same Flask app also serves the built frontend (`static_folder` points at `frontend/dist`), with a catch-all route falling back to `index.html` for client-side routing.

**Answers are never sent to the client in plaintext** — they're ROT13'd server-side and decoded in the browser (`rot13()` in `App.tsx`) only at reveal/check time. This is obfuscation against casually reading network responses, not real security.

**Frontend is one component (`frontend/src/App.tsx`) driven by a `GameState` union (`"menu" | "playing" | "results"`)** rendered as three big conditional blocks rather than separate route components. Key pieces:
- Answer checking is fuzzy (`checkAnswer`): exact match, substring containment, then word-level matching using Levenshtein distance, so near-misses from speech recognition still count.
- Voice input uses the (non-standard) Web `SpeechRecognition` API, typed manually via ambient interfaces near the top of the file since it's not in default TS lib types. Only available in Chromium browsers over HTTPS or localhost.
- The 60-second round timer, category auto-advance, and voice-listening lifecycle are each separate `useEffect`s reacting to shared state (`gameState`, `currentClueIndex`, `revealed`) — when touching timer/voice/advance logic, check all three effects, since they're coupled through that state rather than through direct calls.

## Gotchas

- **Dev port mismatch**: `webpack.config.cjs` dev server listens on port 8000 and proxies `/api` to `http://localhost:8001`, but `app.py` hardcodes `port=8000`. Running both dev servers as documented will collide. Either run the backend on 8001 for local dev (edit `app.py`'s `app.run` call) or serve through the production path (`pnpm run build` in `frontend/`, then run `app.py` alone on 8000 to serve the built static files + API together).
- `README.md`'s "API Endpoints" section is stale — it documents `POST /api/game`, which doesn't exist. The real endpoints are `/api/difficulties`, `/api/round`, `/api/categories` as described above.
- Category difficulty is derived, not authored — adding a category to `categories.py` only requires `name`, `answers` (5+ that survive the vowel/digit filter), and optionally `obscurity_modifier`; difficulty is computed automatically.
