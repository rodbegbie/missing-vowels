import pytest

from app import Category, calculate_difficulty


def make_category(answer_count: int, obscurity_modifier: float) -> Category:
    return Category(
        name="Fixture",
        obscurity_modifier=obscurity_modifier,
        answers=["Be"] * answer_count,
    )


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
