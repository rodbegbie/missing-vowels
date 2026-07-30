# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a solid unit and integration test suite for the Flask
backend and the React/TypeScript frontend, plus CI to run both.

**Architecture:** Backend tests use pytest against the real Flask app,
with route tests monkeypatching `FILTERED_CATEGORIES` for deterministic
fixtures. Frontend tests use Jest + ts-jest + React Testing Library,
mocking `fetch` and `SpeechRecognition`. A GitHub Actions workflow runs
both suites on push and pull request.

**Tech Stack:** pytest, Flask test client (backend); Jest, ts-jest, React
Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`
(frontend); GitHub Actions (CI).

## Global Constraints

- Backend package manager is `uv`; run all backend commands from `backend/`.
- Frontend package manager is `pnpm`; the repo is a pnpm workspace with
  `frontend` as the sole member (`pnpm-workspace.yaml`).
- `.tsx` files are compiled by `ts-loader` in this project's webpack
  config, not Babel — tests must use `ts-jest`, not `babel-jest`, to
  mirror the real build pipeline.
- No production behavior changes except exporting five pure helper
  functions from `frontend/src/App.tsx` (`rot13`, `normalizeText`,
  `levenshteinDistance`, `checkAnswer`, `generateGrouping`) so they can be
  unit tested directly.
- Do not bypass pre-commit hooks (husky + lint-staged run Biome on
  frontend files and ruff + ty on backend `.py` files).
- Design doc: `docs/superpowers/specs/2026-07-29-test-suite-design.md`.

---

### Task 1: Backend test infrastructure + pure function tests

**Files:**

- Modify: `backend/pyproject.toml`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_pure_functions.py`

**Interfaces:**

- Produces: `client` pytest fixture (Flask test client) in
  `backend/tests/conftest.py`, consumed by Task 4.
- Consumes: `rot13`, `has_vowels`, `has_numbers`, `remove_vowels`,
  `format_missing_vowels` from `backend/app.py` (all already defined,
  unchanged).

- [ ] **Step 1: Add pytest to the backend dev dependency group**

Edit `backend/pyproject.toml`:

```toml
[dependency-groups]
dev = [
    "pytest>=8.3",
    "ruff>=0.14.0",
    "ty>=0.0.7",
]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

The `pythonpath = ["."]` entry is required so `import app` and
`from categories import ...` resolve correctly when pytest is run from
`backend/`.

- [ ] **Step 2: Install the new dependency**

Run (from `backend/`): `uv sync`

- [ ] **Step 3: Write `backend/tests/conftest.py`**

```python
import pytest

from app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()
```

- [ ] **Step 4: Write `backend/tests/test_pure_functions.py`**

```python
from app import format_missing_vowels, has_numbers, has_vowels, remove_vowels, rot13


class TestRot13:
    def test_encodes_a_known_value(self):
        assert rot13("Hello") == "Uryyb"

    def test_is_its_own_inverse(self):
        assert rot13(rot13("Hello World")) == "Hello World"

    def test_leaves_non_alphabetic_characters_untouched(self):
        assert rot13("abc 123!") == "nop 123!"


class TestHasVowels:
    def test_true_for_word_with_a_vowel(self):
        assert has_vowels("Cat") is True

    def test_false_for_word_without_a_vowel(self):
        assert has_vowels("Sky") is False

    def test_y_is_not_treated_as_a_vowel(self):
        assert has_vowels("Rhythm") is False


class TestHasNumbers:
    def test_true_when_a_digit_is_present(self):
        assert has_numbers("Area51") is True

    def test_false_when_no_digit_is_present(self):
        assert has_numbers("Area") is False


class TestRemoveVowels:
    def test_strips_vowels_and_counts_them(self):
        result, count = remove_vowels("Hello")
        assert result == "Hll"
        assert count == 2

    def test_no_vowels_present(self):
        result, count = remove_vowels("Sky")
        assert result == "Sky"
        assert count == 0


class TestFormatMissingVowels:
    def test_short_result_has_no_spaces(self):
        clue, vowel_count = format_missing_vowels("Sky")
        assert clue == "SKY"
        assert vowel_count == 0

    def test_counts_vowels_across_all_words(self):
        _, vowel_count = format_missing_vowels("Hello World")
        assert vowel_count == 3

    def test_consonants_are_preserved_in_order(self):
        clue, _ = format_missing_vowels("Hello World")
        assert clue.replace(" ", "") == "HLLWRLD"

    def test_segments_are_never_shorter_than_two_chars(self):
        for _ in range(20):
            clue, _ = format_missing_vowels("Hello World")
            segments = clue.split(" ")
            assert all(len(segment) >= 2 for segment in segments)
```

- [ ] **Step 5: Run the tests**

Run: `uv run pytest tests/test_pure_functions.py -v`
Expected: all tests PASS (values were verified against the real
implementation before writing this plan).

- [ ] **Step 6: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/tests/conftest.py backend/tests/test_pure_functions.py
git commit -m "test: add pytest infrastructure and pure function tests"
```

---

### Task 2: `filter_categories` tests

**Files:**

- Create: `backend/tests/test_filtering.py`

**Interfaces:**

- Consumes: `filter_categories` from `backend/app.py` (unchanged).

- [ ] **Step 1: Write `backend/tests/test_filtering.py`**

```python
from app import filter_categories


def test_keeps_category_with_enough_valid_answers():
    categories = [
        {
            "name": "Fruits",
            "obscurity_modifier": 0.2,
            "answers": ["Apple", "Orange", "Grape", "Melon", "Peach"],
        }
    ]
    result = filter_categories(categories)
    assert len(result) == 1
    assert result[0]["name"] == "Fruits"
    assert result[0]["answers"] == ["Apple", "Orange", "Grape", "Melon", "Peach"]
    assert result[0]["obscurity_modifier"] == 0.2


def test_drops_answers_without_vowels():
    categories = [
        {
            "name": "Mixed",
            "answers": ["Apple", "Orange", "Grape", "Melon", "Peach", "Crwth"],
        }
    ]
    result = filter_categories(categories)
    assert "Crwth" not in result[0]["answers"]
    assert len(result[0]["answers"]) == 5


def test_drops_answers_with_digits():
    categories = [
        {
            "name": "Mixed",
            "answers": ["Apple", "Orange", "Grape", "Melon", "Peach", "Area51"],
        }
    ]
    result = filter_categories(categories)
    assert "Area51" not in result[0]["answers"]
    assert len(result[0]["answers"]) == 5


def test_drops_category_left_with_fewer_than_five_valid_answers():
    categories = [
        {
            "name": "TooFew",
            "answers": ["Apple", "Orange", "Grape", "Melon", "Crwth"],
        }
    ]
    assert filter_categories(categories) == []


def test_keeps_category_with_exactly_five_valid_answers():
    categories = [
        {
            "name": "Exact",
            "answers": ["Apple", "Orange", "Grape", "Melon", "Peach"],
        }
    ]
    assert len(filter_categories(categories)) == 1


def test_defaults_obscurity_modifier_to_zero_when_missing():
    categories = [
        {
            "name": "NoModifier",
            "answers": ["Apple", "Orange", "Grape", "Melon", "Peach"],
        }
    ]
    result = filter_categories(categories)
    assert result[0]["obscurity_modifier"] == 0
```

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_filtering.py -v`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_filtering.py
git commit -m "test: add filter_categories tests"
```

---

### Task 3: `calculate_difficulty` tests

**Files:**

- Create: `backend/tests/test_difficulty.py`

**Interfaces:**

- Consumes: `calculate_difficulty` from `backend/app.py` (unchanged).

`calculate_difficulty` is deterministic despite calling
`format_missing_vowels` internally — the randomness only affects
spacing, not the returned vowel count, so exact expected difficulty
values are safe to assert. All values below were verified by running
`calculate_difficulty` directly against the real implementation.

- [ ] **Step 1: Write `backend/tests/test_difficulty.py`**

```python
import pytest

from app import calculate_difficulty


def make_category(answer_count: int, obscurity_modifier: float) -> dict:
    return {
        "name": "Fixture",
        "obscurity_modifier": obscurity_modifier,
        "answers": ["Be"] * answer_count,
    }


@pytest.mark.parametrize(
    "obscurity_modifier,expected_difficulty",
    [
        (0.0, 1),
        (0.5, 2),
        (0.9, 3),
        (1.2, 4),
        (1.5, 5),
    ],
)
def test_difficulty_bands(obscurity_modifier, expected_difficulty):
    category = make_category(answer_count=6, obscurity_modifier=obscurity_modifier)
    assert calculate_difficulty(category) == expected_difficulty


def test_six_or_fewer_answers_gets_a_ten_percent_score_discount():
    # Same per-answer score either way; only answer count differs.
    discounted = make_category(answer_count=5, obscurity_modifier=0.665)
    undiscounted = make_category(answer_count=8, obscurity_modifier=0.665)
    assert calculate_difficulty(discounted) == 2
    assert calculate_difficulty(undiscounted) == 3
```

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_difficulty.py -v`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_difficulty.py
git commit -m "test: add calculate_difficulty band tests"
```

---

### Task 4: Route integration tests

**Files:**

- Create: `backend/tests/test_routes.py`

**Interfaces:**

- Consumes: `client` fixture from `backend/tests/conftest.py` (Task 1);
  `app` module object, `Category`, `rot13` from `backend/app.py`.

The route handlers read the module-level `FILTERED_CATEGORIES` global
directly, so `monkeypatch.setattr(app_module, "FILTERED_CATEGORIES", ...)`
is visible to them immediately — this gives deterministic route tests
without needing the real 400+ category dataset. `/api/round` always caps
clues at 4 (`random.sample(answers, min(4, len(answers)))`), confirmed
against the real app.

- [ ] **Step 1: Write `backend/tests/test_routes.py`**

```python
import string

import pytest

import app as app_module
from app import Category


def make_category(name: str, difficulty: int, answer_count: int = 5) -> Category:
    letters = string.ascii_uppercase
    return Category(
        name=name,
        answers=[f"{name}Answer{letters[i]}" for i in range(answer_count)],
        obscurity_modifier=0,
        difficulty=difficulty,
    )


@pytest.fixture
def spread_categories(monkeypatch):
    categories = [make_category("Easy", difficulty=1), make_category("Hard", difficulty=5)]
    monkeypatch.setattr(app_module, "FILTERED_CATEGORIES", categories)
    return categories


def test_round_returns_at_most_four_clues_for_the_exact_difficulty(client, spread_categories):
    response = client.get("/api/round?difficulty=1")
    assert response.status_code == 200
    data = response.get_json()
    assert data["category"] == "Easy"
    assert data["difficulty"] == 1
    assert len(data["clues"]) == 4

    easy_category = spread_categories[0]
    for clue in data["clues"]:
        decoded = app_module.rot13(clue["answer"])
        assert decoded in easy_category["answers"]


def test_round_returns_all_four_clues_when_exactly_four_answers_exist(client, monkeypatch):
    category = make_category("Exact", difficulty=2, answer_count=4)
    monkeypatch.setattr(app_module, "FILTERED_CATEGORIES", [category])
    response = client.get("/api/round?difficulty=2")
    assert len(response.get_json()["clues"]) == 4


def test_round_widens_search_when_no_exact_difficulty_match(client, spread_categories):
    # Easy=1, Hard=5. Requesting 3: offset 1 checks [2,4] (no match),
    # offset 2 checks [1,5] (matches both).
    response = client.get("/api/round?difficulty=3")
    assert response.status_code == 200
    assert response.get_json()["category"] in {"Easy", "Hard"}


def test_round_returns_404_when_nothing_matches(client, monkeypatch):
    monkeypatch.setattr(app_module, "FILTERED_CATEGORIES", [])
    response = client.get("/api/round?difficulty=3")
    assert response.status_code == 404
    assert response.get_json() == {"error": "No categories found"}


def test_difficulties_counts_categories_per_level(client, monkeypatch):
    categories = [
        make_category("A", difficulty=1),
        make_category("B", difficulty=1),
        make_category("C", difficulty=3),
    ]
    monkeypatch.setattr(app_module, "FILTERED_CATEGORIES", categories)
    response = client.get("/api/difficulties")
    counts = {d["level"]: d["count"] for d in response.get_json()["difficulties"]}
    assert counts == {1: 2, 2: 0, 3: 1, 4: 0, 5: 0}


def test_categories_lists_name_difficulty_and_answer_count(client, spread_categories):
    response = client.get("/api/categories")
    assert response.get_json()["categories"] == [
        {"name": "Easy", "difficulty": 1, "answer_count": 5},
        {"name": "Hard", "difficulty": 5, "answer_count": 5},
    ]


def test_real_category_data_has_every_difficulty_level_represented(client):
    # Smoke test against the real, unmocked category data.
    response = client.get("/api/difficulties")
    for entry in response.get_json()["difficulties"]:
        assert entry["count"] > 0, f"No categories at difficulty {entry['level']}"


@pytest.mark.parametrize("difficulty", [1, 2, 3, 4, 5])
def test_real_category_data_returns_a_round_for_every_difficulty(client, difficulty):
    response = client.get(f"/api/round?difficulty={difficulty}")
    assert response.status_code == 200
```

- [ ] **Step 2: Run the tests**

Run: `uv run pytest tests/test_routes.py -v`
Expected: all tests PASS.

- [ ] **Step 3: Run the full backend suite**

Run: `uv run pytest -v`
Expected: all tests across all four files PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_routes.py
git commit -m "test: add Flask route integration tests"
```

---

### Task 5: Frontend test harness + export pure helpers + pure function tests

**Files:**

- Modify: `frontend/package.json`
- Create: `frontend/jest.config.cjs`
- Create: `frontend/src/__mocks__/styleMock.js`
- Create: `frontend/src/__tests__/setupTests.ts`
- Modify: `frontend/src/App.tsx:8` (`rot13`), `:79` (`normalizeText`),
  `:88` (`levenshteinDistance`), `:113` (`checkAnswer`), `:155`
  (`generateGrouping`) — add `export` to each function declaration.
- Create: `frontend/src/__tests__/helpers.test.ts`

**Interfaces:**

- Produces: `frontend/jest.config.cjs` (Jest config used by all later
  frontend tasks); `export`ed `rot13`, `normalizeText`,
  `levenshteinDistance`, `checkAnswer`, `generateGrouping` from
  `../App`, consumed by Task 6 (`rot13`).

- [ ] **Step 1: Add devDependencies and a test script**

Edit `frontend/package.json` — add to `"scripts"`:

```json
"test": "jest"
```

Add to `"devDependencies"` (versions confirmed current against the npm
registry before writing this plan):

```json
"@testing-library/jest-dom": "^7.0.0",
"@testing-library/react": "^16.3.2",
"@testing-library/user-event": "^14.6.1",
"@types/jest": "^30.0.0",
"jest": "^30.4.2",
"jest-environment-jsdom": "^30.4.1",
"ts-jest": "^29.4.12"
```

- [ ] **Step 2: Install the new dependencies**

Run (from `frontend/`): `pnpm install`

- [ ] **Step 3: Write `frontend/jest.config.cjs`**

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          jsx: "react-jsx",
        },
      },
    ],
  },
  moduleNameMapper: {
    "\\.css$": "<rootDir>/src/__mocks__/styleMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setupTests.ts"],
};
```

`module: "commonjs"` overrides the app's `"module": "ESNext"` tsconfig
setting just for tests, since Jest (without the experimental ESM flag)
expects CommonJS output from transforms.

- [ ] **Step 4: Write `frontend/src/__mocks__/styleMock.js`**

```js
module.exports = {};
```

- [ ] **Step 5: Write `frontend/src/__tests__/setupTests.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Export the pure helper functions from `App.tsx`**

In `frontend/src/App.tsx`, add `export` to these five function
declarations (no other changes):

```ts
export function rot13(text: string): string {
```

```ts
export function normalizeText(text: string): string {
```

```ts
export function levenshteinDistance(a: string, b: string): number {
```

```ts
export function checkAnswer(spoken: string, correct: string): boolean {
```

```ts
export function generateGrouping(): number[] {
```

- [ ] **Step 7: Write `frontend/src/__tests__/helpers.test.ts`**

All expected values below were verified by running the real function
bodies with Node before writing this plan.

```ts
import {
  checkAnswer,
  generateGrouping,
  levenshteinDistance,
  normalizeText,
  rot13,
} from "../App";

describe("rot13", () => {
  it("encodes a known value", () => {
    expect(rot13("Hello")).toBe("Uryyb");
  });

  it("is its own inverse", () => {
    expect(rot13(rot13("Hello World"))).toBe("Hello World");
  });

  it("leaves non-alphabetic characters untouched", () => {
    expect(rot13("abc 123!")).toBe("nop 123!");
  });
});

describe("normalizeText", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeText("Tony Blair!")).toBe("tony blair");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeText("  Tony   Blair  ")).toBe("tony blair");
  });
});

describe("levenshteinDistance", () => {
  it("is zero for identical strings", () => {
    expect(levenshteinDistance("kitten", "kitten")).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(levenshteinDistance("kitten", "sitten")).toBe(1);
  });

  it("counts insertions and substitutions together", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });
});

describe("checkAnswer", () => {
  it("matches an exact answer", () => {
    expect(checkAnswer("tony blair", "Tony Blair")).toBe(true);
  });

  it("matches when the spoken answer contains the correct answer", () => {
    expect(checkAnswer("it was tony blair I think", "Tony Blair")).toBe(true);
  });

  it("matches a close fuzzy word (one dropped letter)", () => {
    expect(checkAnswer("margaret thacher", "Margaret Thatcher")).toBe(true);
  });

  it("rejects an unrelated answer", () => {
    expect(checkAnswer("gordon brown", "Tony Blair")).toBe(false);
  });
});

describe("generateGrouping", () => {
  it("always returns groups that sum to nine", () => {
    for (let i = 0; i < 20; i++) {
      const grouping = generateGrouping();
      expect(grouping.reduce((sum, n) => sum + n, 0)).toBe(9);
    }
  });

  it("never returns a group smaller than two", () => {
    for (let i = 0; i < 20; i++) {
      const grouping = generateGrouping();
      expect(grouping.every((n) => n >= 2)).toBe(true);
    }
  });
});
```

- [ ] **Step 8: Run the tests**

Run (from `frontend/`): `pnpm test helpers.test.ts`
Expected: all tests PASS. If `ts-jest` reports config errors, check that
`jest.config.cjs` is being picked up (Jest auto-discovers
`jest.config.cjs` in the frontend package root — no extra flag needed).

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/jest.config.cjs frontend/src/__mocks__/styleMock.js frontend/src/__tests__/setupTests.ts frontend/src/App.tsx frontend/src/__tests__/helpers.test.ts
git commit -m "test: add Jest harness, export pure helpers, add helper tests"
```

---

### Task 6: Shared test utilities + menu/game-flow integration tests

**Files:**

- Create: `frontend/src/__tests__/testUtils.ts`
- Create: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**

- Produces (from `testUtils.ts`, consumed by Tasks 7 and 8):
  - `jsonResponse(body: unknown): Promise<Response>`
  - `installFetchMock(responses?: unknown[]): jest.Mock` — creates a
    `jest.fn()`, queues one `jsonResponse` per entry in call order, and
    assigns it to `global.fetch`.
  - `queueFetchResponse(fetchMock: jest.Mock, response: unknown): void`
  - `mask(word: string): string` — uppercases and strips `AEIOU`,
    standing in for the backend's vowel-stripped clue text.
  - `makeRound(category: string, answers: string[]): Round` — builds a
    round payload shaped like the real `/api/round` response, using
    `mask()` for `clue` and the real (imported) `rot13` for `answer`.
  - `difficultiesResponse` — a fixed two-level `/api/difficulties`
    payload (`Easy` count 3, `Hard` count 1 — deliberately non-overlapping
    button text so `getByRole("button", { name: /Easy/i })` can't match
    both).
  - `class MockSpeechRecognition` with `static instances`,
    `static reset()`, and `emitResult(transcript: string)`.
- Consumes: `rot13` from `../App` (Task 5).

- [ ] **Step 1: Write `frontend/src/__tests__/testUtils.ts`**

```ts
import { rot13 } from "../App";

export function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

export function installFetchMock(responses: unknown[] = []): jest.Mock {
  const fetchMock = jest.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(() => jsonResponse(response));
  }
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function queueFetchResponse(fetchMock: jest.Mock, response: unknown): void {
  fetchMock.mockImplementationOnce(() => jsonResponse(response));
}

export const difficultiesResponse = {
  difficulties: [
    { level: 1, name: "Easy", count: 3 },
    { level: 5, name: "Hard", count: 1 },
  ],
};

export function mask(word: string): string {
  return word.toUpperCase().replace(/[AEIOU]/g, "");
}

export function makeRound(category: string, answers: string[]) {
  return {
    category,
    difficulty: 2,
    clues: answers.map((answer) => ({
      clue: mask(answer),
      answer: rot13(answer),
      vowels_removed: 1,
    })),
  };
}

interface MockResultEvent {
  resultIndex: number;
  results: { 0: { transcript: string } }[];
}

export class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: MockResultEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  start = jest.fn();
  stop = jest.fn(() => {
    this.onend?.();
  });

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }

  emitResult(transcript: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [{ 0: { transcript } }],
    });
  }

  static reset(): void {
    MockSpeechRecognition.instances = [];
  }
}
```

- [ ] **Step 2: Write `frontend/src/__tests__/App.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import {
  difficultiesResponse,
  installFetchMock,
  makeRound,
  queueFetchResponse,
} from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function startGame(round: ReturnType<typeof makeRound>) {
  const fetchMock = installFetchMock([difficultiesResponse, round]);
  render(<App />);
  const button = await screen.findByRole("button", { name: /Easy/i });
  fireEvent.click(button);
  await screen.findByText(round.clues[0].clue);
  return fetchMock;
}

test("renders the difficulty menu from fetched difficulties", async () => {
  installFetchMock([difficultiesResponse]);
  render(<App />);
  expect(await screen.findByRole("button", { name: /Easy/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Hard/i })).toBeInTheDocument();
  expect(screen.getByText("3 categories")).toBeInTheDocument();
});

test("starts a game and shows the masked clue with the answer hidden", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  await startGame(round);
  expect(screen.getByText(round.clues[0].clue)).toBeInTheDocument();
  expect(screen.queryByText("CaseOne")).not.toBeInTheDocument();
});

test("reveals the answer and increments the score on Got It", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  await startGame(round);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("1");
});

test("advances to the next clue after the reveal delay", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  await startGame(round);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");

  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(await screen.findByText(round.clues[1].clue)).toBeInTheDocument();
});

test("loads the next category once every clue in the current one is revealed", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  const fetchMock = await startGame(round);

  // Reveal clue 1 of 3, advance past it.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  await screen.findByText(round.clues[1].clue);

  // Reveal clue 2 of 3, advance past it.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseTwo");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  await screen.findByText(round.clues[2].clue);

  // Queue the next category before revealing the final clue.
  const nextRound = makeRound("Tube Lines", ["Jubilee", "Circle", "Central"]);
  queueFetchResponse(fetchMock, nextRound);

  // Reveal the final (3rd) clue — the following advance should fetch the next category.
  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseThree");
  act(() => {
    jest.advanceTimersByTime(1500);
  });

  expect(await screen.findByText("Tube Lines")).toBeInTheDocument();
  expect(await screen.findByText(nextRound.clues[0].clue)).toBeInTheDocument();
});

test("counts down the timer every second while playing", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  await startGame(round);

  expect(screen.getByText("60")).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByText("59")).toBeInTheDocument();
});

test("ends the round and shows results when the timer reaches zero", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  await startGame(round);

  act(() => {
    jest.advanceTimersByTime(60000);
  });

  expect(await screen.findByText("Time's Up!")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the tests**

Run (from `frontend/`): `pnpm test App.test.tsx`
Expected: all tests PASS. If a test times out waiting for a `findBy*`
query, check the corresponding `act`/timer-advance step above — React
Testing Library auto-advances Jest fake timers while polling, but a
missing `act()` wrapper around a `jest.advanceTimersByTime` call can
still cause an "update not wrapped in act" warning; wrap all direct timer
advances in `act()` as shown.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/testUtils.ts frontend/src/__tests__/App.test.tsx
git commit -m "test: add menu and core game-flow integration tests"
```

---

### Task 7: Results screen tests

**Files:**

- Create: `frontend/src/__tests__/App.results.test.tsx`

**Interfaces:**

- Consumes: `installFetchMock`, `difficultiesResponse`, `makeRound` from
  `./testUtils` (Task 6).

To reach the results screen, the timer must hit zero — it's the only
path (`App.tsx`'s timer effect is the sole place `gameState` becomes
`"results"`). To exercise both the "correct" and "missed" counts without
triggering a `loadNextCategory` fetch mid-test, this task uses a 3-clue
round and only reveals the first two clues (never the last), so every
pending reveal-delay timer just advances the clue index rather than
fetching a new category.

- [ ] **Step 1: Write `frontend/src/__tests__/App.results.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import { difficultiesResponse, installFetchMock, makeRound } from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("shows score, correct/missed/category counts, and per-category answers", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  fireEvent.click(screen.getByRole("button", { name: /Got It/i }));
  await screen.findByText("CaseOne");
  act(() => {
    jest.advanceTimersByTime(1500);
  });

  await screen.findByText(round.clues[1].clue);
  fireEvent.click(screen.getByRole("button", { name: /Show Answer/i }));
  await screen.findByText("CaseTwo");

  act(() => {
    jest.advanceTimersByTime(60000);
  });

  expect(await screen.findByText("Time's Up!")).toBeInTheDocument();
  expect(document.querySelector(".final-score")).toHaveTextContent("1");

  const stats = screen.getAllByText(/^\d+$/, { selector: ".result-value" });
  expect(stats.map((el) => el.textContent)).toEqual(["1", "1", "1"]);

  expect(screen.getByText("UK Prime Ministers")).toBeInTheDocument();
  expect(screen.getByText("CaseOne")).toBeInTheDocument();
  expect(screen.getByText("CaseTwo")).toBeInTheDocument();
});

test("Play Again resets to the menu", async () => {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  act(() => {
    jest.advanceTimersByTime(60000);
  });
  await screen.findByText("Time's Up!");

  fireEvent.click(screen.getByRole("button", { name: /Play Again/i }));

  expect(await screen.findByText("Select Difficulty")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests**

Run (from `frontend/`): `pnpm test App.results.test.tsx`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/App.results.test.tsx
git commit -m "test: add results screen integration tests"
```

---

### Task 8: Voice recognition tests

**Files:**

- Create: `frontend/src/__tests__/App.voice.test.tsx`

**Interfaces:**

- Consumes: `installFetchMock`, `difficultiesResponse`, `makeRound`,
  `MockSpeechRecognition` from `./testUtils` (Task 6).

The voice-enable checkbox only appears on the menu screen (before
`startGame`), so it must be toggled before clicking a difficulty button.
`recognitionRef` is created once on mount, so
`MockSpeechRecognition.instances[0]` is the single instance to drive for
the whole test, in every game state.

- [ ] **Step 1: Write `frontend/src/__tests__/App.voice.test.tsx`**

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "../App";
import {
  difficultiesResponse,
  installFetchMock,
  makeRound,
  MockSpeechRecognition,
} from "./testUtils";

beforeEach(() => {
  jest.useFakeTimers();
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
    MockSpeechRecognition;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  MockSpeechRecognition.reset();
  // biome-ignore lint/performance/noDelete: test cleanup of a global test hook
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

async function startGameWithVoiceEnabled() {
  const round = makeRound("UK Prime Ministers", ["CaseOne", "CaseTwo", "CaseThree"]);
  installFetchMock([difficultiesResponse, round]);
  render(<App />);

  const checkbox = await screen.findByRole("checkbox", { name: /Voice Recognition/i });
  fireEvent.click(checkbox);

  fireEvent.click(screen.getByRole("button", { name: /Easy/i }));
  await screen.findByText(round.clues[0].clue);

  return round;
}

test("a matching spoken transcript reveals the answer as correct", async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("case one");
  });

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("1");
});

test('saying "pass" reveals the current answer as incorrect', async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("pass");
  });

  expect(await screen.findByText("CaseOne")).toBeInTheDocument();
  expect(document.querySelector(".top-score")).toHaveTextContent("0");
});

test("saying a new game command on the results screen returns to the menu", async () => {
  await startGameWithVoiceEnabled();
  act(() => {
    jest.advanceTimersByTime(300);
  });

  act(() => {
    jest.advanceTimersByTime(60000);
  });
  await screen.findByText("Time's Up!");

  act(() => {
    jest.advanceTimersByTime(500);
  });

  const recognition = MockSpeechRecognition.instances[0];
  act(() => {
    recognition.emitResult("let's start a new game");
  });

  expect(await screen.findByText("Select Difficulty")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests**

Run (from `frontend/`): `pnpm test App.voice.test.tsx`
Expected: all tests PASS. If the "new game" test is flaky waiting for the
results-screen listening timer, confirm the two `advanceTimersByTime`
calls stay separate (60000 then 500) rather than combined — the 500ms
`startListening` timeout is only scheduled once `gameState` flips to
`"results"`, so it falls outside a single 60000ms window.

- [ ] **Step 3: Run the full frontend suite**

Run (from `frontend/`): `pnpm test`
Expected: all tests across all four frontend test files PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/App.voice.test.tsx
git commit -m "test: add voice recognition integration tests"
```

---

### Task 9: CI workflow

**Files:**

- Create: `.github/workflows/test.yml`

**Interfaces:**

- Consumes: `uv run pytest` (Task 1), `pnpm test` via
  `pnpm --filter frontend test` (Task 5).

- [ ] **Step 1: Write `.github/workflows/test.yml`**

```yaml
name: Test

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
      - run: uv sync --locked
        working-directory: backend
      - run: uv run pytest
        working-directory: backend

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter frontend test
```

- [ ] **Step 2: Verify the workflow YAML is well-formed**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"`
Expected: no output (no parse error). If `pyyaml` isn't available,
visually re-check indentation instead — the workflow will be validated
for real once pushed and GitHub Actions picks it up.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run backend and frontend test suites on push and PR"
```

---

### Task 10: Update CLAUDE.md documentation

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add test commands to the Commands section**

In the Backend commands block, add a line after the `ty check` line:

```bash
uv run pytest                                # run backend tests
```

In the Frontend commands block, add a line after the `pnpm run format`
line:

```bash
pnpm run test      # run frontend tests (Jest)
```

- [ ] **Step 2: Replace the stale "no test suite" line**

Find this sentence near the top of the Commands section:

> There is no test suite (no pytest/vitest/jest configured) — verify
> changes by running the app manually.

Replace it with:

> Backend tests live in `backend/tests/` (pytest); frontend tests live in
> `frontend/src/__tests__/` (Jest + React Testing Library, using ts-jest
> since `.tsx` is compiled by `ts-loader`, not Babel, in this project).

- [ ] **Step 3: Run the markdown skill's lint check mentally / visually**

Re-read the edited section to confirm blank lines around the new code
blocks and no line-length regressions, per this repo's markdown
conventions (invoke the `markdown` skill if editing further).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the new backend and frontend test commands"
```

---

## Self-Review Notes

- **Spec coverage:** every bullet in
  `docs/superpowers/specs/2026-07-29-test-suite-design.md` maps to a
  task — backend pure functions (Task 1), `filter_categories` (Task 2),
  `calculate_difficulty` (Task 3), routes (Task 4), frontend harness +
  pure helpers (Task 5), menu/game flow + timer (Task 6), results screen
  (Task 7), voice (Task 8), CI (Task 9), docs (Task 10).
- **Numeric assertions:** every hardcoded expected value (ROT13 strings,
  vowel counts, difficulty bands, Levenshtein distances, `checkAnswer`
  outcomes) was verified by running the real implementation (Python via
  `uv run python`, the frontend logic via plain Node) before being
  written into this plan, not derived by hand.
- **Type/name consistency:** `installFetchMock`, `queueFetchResponse`,
  `makeRound`, `mask`, `difficultiesResponse`, and
  `MockSpeechRecognition` are defined once in Task 6's `testUtils.ts`
  and imported identically by Tasks 7 and 8 — no renamed duplicates.
