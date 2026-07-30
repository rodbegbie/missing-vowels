# Test Suite Design

## Goal

Add a solid unit and integration test suite for both the Flask backend and
the React/TypeScript frontend. Neither currently has any automated tests.

## Backend

**Tooling:** pytest (Rod's global preference) plus Flask's built-in test
client. Only `pytest` is added to the `dev` dependency group in
`backend/pyproject.toml`.

**Structure:** new `backend/tests/` package:

- `conftest.py` — shared fixtures, including a small hand-crafted category
  fixture set for deterministic route tests.
- `test_pure_functions.py`
- `test_filtering.py`
- `test_difficulty.py`
- `test_routes.py`

Route tests monkeypatch `FILTERED_CATEGORIES` with a small, deterministic
fixture set rather than the real 400+ category dataset, so edge cases (e.g.
no categories at a given difficulty) are reachable on demand. One smoke test
exercises the real `CATEGORIES` data end-to-end to catch data-shape
regressions (e.g. every difficulty 1-5 has at least one category after
filtering).

**Coverage:**

- Pure functions: `rot13` round-trip, `has_vowels`, `has_numbers`,
  `remove_vowels`, `format_missing_vowels` (short-text passthrough at or
  below 4 characters, spacing/segment-length invariants, vowel count
  correctness).
- `filter_categories`: drops answers without vowels or containing digits,
  drops categories left with fewer than 5 valid answers, leaves valid
  categories untouched.
- `calculate_difficulty`: boundary behaviour across the five difficulty
  bands using inputs with known scores.
- Routes via the Flask test client:
  - `/api/difficulties` — counts per level sum correctly.
  - `/api/round` — well-formed clues; the ROT13'd `answer` decodes to a
    real answer from the category; search widens outward when the exact
    difficulty has no match; 404 when nothing matches at all.
  - `/api/categories` — shape matches `FILTERED_CATEGORIES`.

## Frontend

**Tooling:** Jest, React Testing Library, `@testing-library/jest-dom`,
`@testing-library/user-event`, `jest-environment-jsdom`, and `ts-jest`.
`.tsx` files in this project are compiled by `ts-loader` in webpack, not
Babel (`babel-loader` only handles `.js`/`.jsx`, and none exist in `src/`),
so `ts-jest` is used to mirror the real build pipeline and read the
existing `tsconfig.json` directly, rather than standing up a second,
Babel-based TypeScript transform alongside an already-unused Babel config.

**Source change:** export the pure helper functions from `App.tsx` —
`rot13`, `normalizeText`, `levenshteinDistance`, `checkAnswer`,
`generateGrouping` — so they can be unit tested directly instead of only
being reachable through rendered UI.

**Structure:** new `frontend/src/__tests__/`:

- `jest.setup.ts` — installs a mock `SpeechRecognition` constructor on
  `window` and stubs `fetch`.
- `helpers.test.ts` — pure function unit tests.
- `App.test.tsx` — component/integration tests.

**Coverage:**

- Pure functions: `rot13` round-trip including non-alphabetic passthrough;
  `normalizeText` punctuation/case/whitespace handling; `levenshteinDistance`
  known distances; `checkAnswer` exact match, substring containment,
  fuzzy word matching, and rejection cases; `generateGrouping` always
  returns a valid grouping summing to 9.
- Menu to game flow: mock `/api/difficulties` and `/api/round` fetches,
  render difficulty buttons, click starts the game, clue renders with the
  answer ROT13-decoded only after reveal (never before — regression guard
  for the "answers are never sent to the client in plaintext" contract).
- Reveal flow: "Got It!" / "Show Answer" update score and `revealed` state,
  auto-advance after the 1.5s delay using fake timers, category exhaustion
  triggers a fetch for the next round.
- Timer: countdown ticks via fake timers, hitting zero transitions to the
  results screen.
- Results screen: correct/missed/category counts, per-category grouping,
  "Play Again" resets to menu state.
- Voice: mock `SpeechRecognition`; toggling on/off; a simulated `onresult`
  transcript matching the answer triggers a correct reveal, a "pass"
  transcript triggers an incorrect reveal, and a "new game" transcript on
  the results screen triggers `playAgain`.

## CI

New `.github/workflows/test.yml` with two jobs, run on push and pull
request:

- `backend` — `uv sync`, then `uv run pytest`.
- `frontend` — `pnpm install`, then `pnpm --filter frontend test`.

`frontend/package.json` gains a `"test": "jest"` script.

## Documentation

Update `CLAUDE.md`:

- Commands section gains the backend `uv run pytest` and frontend
  `pnpm run test` commands.
- Remove the now-stale "There is no test suite" line from the top-level
  summary, and describe the test layout briefly instead.

## Out of scope

The port 8000/8001 dev-server collision documented in CLAUDE.md's Gotchas
section is unrelated to this work and is not being touched.
