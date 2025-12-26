from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import random
import re
import os
from categories import CATEGORIES

# Serve static files from frontend build
static_folder = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app = Flask(__name__, static_folder=static_folder, static_url_path="")
CORS(app)


def has_vowels(text):
    """Check if text contains at least one vowel."""
    vowels = "aeiouAEIOU"
    return any(c in vowels for c in text)


def has_numbers(text):
    """Check if text contains any numbers."""
    return any(c.isdigit() for c in text)


def filter_categories(categories):
    """Filter out answers without vowels or with numbers, and categories with < 5 valid answers."""
    filtered = []
    for cat in categories:
        # Filter answers that have at least one vowel and no numbers
        valid_answers = [
            a for a in cat["answers"] if has_vowels(a) and not has_numbers(a)
        ]
        # Only include category if it has at least 5 valid answers
        if len(valid_answers) >= 5:
            filtered.append(
                {
                    "name": cat["name"],
                    "answers": valid_answers,
                    "obscurity_modifier": cat.get("obscurity_modifier", 0),
                }
            )
    return filtered


# Filter categories on load
FILTERED_CATEGORIES = filter_categories(CATEGORIES)


@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


def remove_vowels(text):
    """Remove vowels from text, keeping spaces between words but removing spaces within."""
    vowels = "aeiouAEIOU"
    # Count vowels removed for difficulty scoring
    vowel_count = sum(1 for c in text if c in vowels)
    # Remove vowels
    result = "".join(c for c in text if c not in vowels)
    return result, vowel_count


def format_missing_vowels(text):
    """Format text in Missing Vowels style: no vowels, random space distribution."""
    # Remove vowels from entire text first
    words = text.split()
    consonants_only = []
    total_vowels = 0

    for word in words:
        no_vowels, count = remove_vowels(word)
        total_vowels += count
        consonants_only.append(no_vowels.upper())

    # Join all consonants together
    all_consonants = "".join(consonants_only)

    if len(all_consonants) <= 4:
        return all_consonants, total_vowels

    # Randomly distribute spaces, ensuring each segment is at least 2 chars
    # Maximum number of spaces we can have while keeping all segments >= 2 chars
    max_spaces = (len(all_consonants) // 2) - 1
    if max_spaces < 1:
        return all_consonants, total_vowels

    # Target 2-4 spaces depending on length, but respect the maximum
    target_spaces = min(max_spaces, random.randint(2, max(2, len(all_consonants) // 4)))

    # Valid positions are those that leave at least 2 chars before and after
    # We need to pick positions such that each segment is >= 2 chars
    # Use a greedy approach: pick random valid positions
    positions = []
    for _ in range(target_spaces * 10):  # Try multiple times
        if len(positions) >= target_spaces:
            break
        # Pick a random position
        pos = random.randint(2, len(all_consonants) - 2)
        # Check it's valid: at least 2 chars from start, end, and any existing position
        valid = True
        if pos < 2 or pos > len(all_consonants) - 2:
            valid = False
        for existing in positions:
            if abs(pos - existing) < 2:
                valid = False
                break
        if valid:
            positions.append(pos)

    if not positions:
        return all_consonants, total_vowels

    positions = sorted(positions)

    # Build result with spaces
    result = []
    prev = 0
    for pos in positions:
        result.append(all_consonants[prev:pos])
        prev = pos
    result.append(all_consonants[prev:])

    return " ".join(result), total_vowels


def calculate_difficulty(category):
    """Calculate difficulty score for a category (1-5).

    Factors in:
    - Answer length and vowels removed (readability)
    - Topic obscurity (knowledge required)

    Easy (1): Very short, common words (days, colors, numbers)
    Medium-Easy (2): Short common words and phrases
    Medium (3): High school common knowledge, moderate length
    Medium-Hard (4): Longer phrases, some specialist knowledge
    Hard (5): Long phrases, obscure or specialist topics
    """
    answers = category["answers"]
    total_score = 0

    for answer in answers:
        # Factor 1: Length of answer (characters)
        length_score = len(answer) / 18  # Normalize

        # Factor 2: Number of vowels removed (more = harder to read)
        _, vowel_count = format_missing_vowels(answer)
        vowel_score = vowel_count / 8  # Normalize

        # Factor 3: Number of words (more words = harder to parse)
        word_count = len(answer.split())
        word_score = (word_count - 1) / 3  # Normalize

        answer_score = length_score + vowel_score + word_score
        total_score += answer_score

    avg_score = total_score / len(answers)

    # Factor in number of answers (fewer = less variety = slightly easier)
    if len(answers) <= 6:
        avg_score *= 0.9

    # Apply obscurity modifier based on topic (from category definition)
    obscurity = category.get("obscurity_modifier", 0)
    avg_score += obscurity

    # Convert to 1-5 scale
    if avg_score < 0.55:
        return 1  # Easy: very short words, common knowledge
    elif avg_score < 0.9:
        return 2  # Medium-Easy: short common words
    elif avg_score < 1.25:
        return 3  # Medium: general knowledge
    elif avg_score < 1.6:
        return 4  # Medium-Hard: longer, some specialist
    else:
        return 5  # Hard: obscure, specialist topics


# Pre-calculate difficulties for filtered categories
for cat in FILTERED_CATEGORIES:
    cat["difficulty"] = calculate_difficulty(cat)


@app.route("/api/difficulties", methods=["GET"])
def get_difficulties():
    """Return available difficulty levels with category counts."""
    difficulty_counts = {}
    for cat in FILTERED_CATEGORIES:
        d = cat["difficulty"]
        difficulty_counts[d] = difficulty_counts.get(d, 0) + 1

    return jsonify(
        {
            "difficulties": [
                {"level": 1, "name": "Easy", "count": difficulty_counts.get(1, 0)},
                {
                    "level": 2,
                    "name": "Medium-Easy",
                    "count": difficulty_counts.get(2, 0),
                },
                {"level": 3, "name": "Medium", "count": difficulty_counts.get(3, 0)},
                {
                    "level": 4,
                    "name": "Medium-Hard",
                    "count": difficulty_counts.get(4, 0),
                },
                {"level": 5, "name": "Hard", "count": difficulty_counts.get(5, 0)},
            ]
        }
    )


@app.route("/api/round", methods=["GET"])
def get_round():
    """Get a game round: 4 clues from a random category at the requested difficulty."""
    difficulty = request.args.get("difficulty", type=int, default=2)

    # Filter categories by difficulty
    matching_cats = [c for c in FILTERED_CATEGORIES if c["difficulty"] == difficulty]

    # If no exact match, find closest
    if not matching_cats:
        for offset in range(1, 5):
            matching_cats = [
                c
                for c in FILTERED_CATEGORIES
                if c["difficulty"] in [difficulty - offset, difficulty + offset]
            ]
            if matching_cats:
                break

    if not matching_cats:
        return jsonify({"error": "No categories found"}), 404

    # Pick random category
    category = random.choice(matching_cats)

    # Pick 4 random answers
    answers = random.sample(category["answers"], min(4, len(category["answers"])))

    # Format clues
    clues = []
    for answer in answers:
        formatted, vowel_count = format_missing_vowels(answer)
        clues.append(
            {"clue": formatted, "answer": answer, "vowels_removed": vowel_count}
        )

    return jsonify(
        {
            "category": category["name"],
            "difficulty": category["difficulty"],
            "clues": clues,
        }
    )


@app.route("/api/categories", methods=["GET"])
def get_categories():
    """Get all categories with their difficulties."""
    return jsonify(
        {
            "categories": [
                {
                    "name": c["name"],
                    "difficulty": c["difficulty"],
                    "answer_count": len(c["answers"]),
                }
                for c in FILTERED_CATEGORIES
            ]
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
