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
