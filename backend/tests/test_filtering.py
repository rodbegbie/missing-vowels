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
