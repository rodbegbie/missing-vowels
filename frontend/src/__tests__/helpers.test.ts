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
