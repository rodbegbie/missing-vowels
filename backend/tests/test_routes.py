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
