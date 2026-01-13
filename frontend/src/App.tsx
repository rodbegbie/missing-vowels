import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./App.css";

const API_URL = "/api";

// ROT13 decode function
function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
  });
}

// Types
interface Clue {
  clue: string;
  answer: string; // ROT13 encoded from API
}

interface Round {
  category: string;
  clues: Clue[];
}

interface Difficulty {
  level: string;
  name: string;
  count: number;
}

interface UserAnswer {
  clue: Clue;
  correct: boolean;
  category: string;
}

type GameState = "menu" | "playing" | "results";

// Extend Window interface for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionPhrase {
  phrase: string;
  boost?: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  phrases?: SpeechRecognitionPhrase[];
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// Normalize text for comparison (lowercase, remove punctuation, extra spaces)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Check if spoken answer matches the correct answer (fuzzy matching)
function checkAnswer(spoken: string, correct: string): boolean {
  const normalizedSpoken = normalizeText(spoken);
  const normalizedCorrect = normalizeText(correct);

  // Exact match
  if (normalizedSpoken === normalizedCorrect) return true;

  // Check if spoken contains the answer
  if (normalizedSpoken.includes(normalizedCorrect)) return true;
  if (
    normalizedCorrect.includes(normalizedSpoken) &&
    normalizedSpoken.length > 3
  )
    return true;

  // Check similarity (allow for small speech recognition errors)
  const spokenWords = normalizedSpoken.split(" ");
  const correctWords = normalizedCorrect.split(" ");

  // Count matching words
  let matches = 0;
  for (const word of correctWords) {
    if (
      spokenWords.some(
        (sw) =>
          sw === word ||
          (sw.length > 3 &&
            word.length > 3 &&
            (sw.includes(word) ||
              word.includes(sw) ||
              levenshteinDistance(sw, word) <= Math.floor(word.length / 3))),
      )
    ) {
      matches++;
    }
  }

  // If most words match, consider it correct
  return matches >= Math.ceil(correctWords.length * 0.7);
}

// Generate valid groupings for 9 consonants (2-3 spaces, groups of 2+ letters)
function generateGrouping(): number[] {
  // Valid groupings for 9 consonants with 2-3 spaces, all groups >= 2
  const validGroupings = [
    [2, 2, 2, 3], // MS SN GV WLS
    [2, 2, 3, 2], // MS SN GVW LS
    [2, 3, 2, 2], // MS SNG VW LS
    [3, 2, 2, 2], // MSS NG VW LS
    [3, 3, 3], // MSS NGV WLS
    [3, 2, 4], // MSS NG VWLS
    [2, 3, 4], // MS SNG VWLS
    [4, 3, 2], // MSSN GVW LS
    [2, 4, 3], // MS SNGV WLS
    [3, 4, 2], // MSS NGVW LS
  ];
  return validGroupings[Math.floor(Math.random() * validGroupings.length)];
}

// Animated title component for the menu screen
function AnimatedTitle(): React.ReactElement {
  const [phase, setPhase] = useState<
    "full" | "fading" | "collapsed" | "condensed"
  >("full");

  // Original title
  const fullText = "MISSING VOWELS";
  const vowels = new Set(["A", "E", "I", "O", "U"]);

  // Generate random grouping once on mount
  const grouping = useMemo(() => generateGrouping(), []);

  useEffect(() => {
    // 1s: start fading vowels (0.5s fade)
    const fadeTimer = setTimeout(() => setPhase("fading"), 1000);
    // 1.5s: collapse vowels to zero width
    const collapseTimer = setTimeout(() => setPhase("collapsed"), 1500);
    // 1.9s: add spaces between groups
    const condenseTimer = setTimeout(() => setPhase("condensed"), 1900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(collapseTimer);
      clearTimeout(condenseTimer);
    };
  }, []);

  // Build consonant positions from grouping
  const consonantPositions = useMemo(() => {
    const positions: { group: number; pos: number }[] = [];
    let idx = 0;
    for (let g = 0; g < grouping.length; g++) {
      for (let p = 0; p < grouping[g]; p++) {
        positions.push({ group: g, pos: p });
        idx++;
      }
    }
    return positions;
  }, [grouping]);

  // Build letter elements with animation classes
  const letters = useMemo(() => {
    const result: React.ReactElement[] = [];
    let consonantIndex = 0;

    for (let i = 0; i < fullText.length; i++) {
      const char = fullText[i];

      if (char === " ") {
        result.push(
          <span
            key={i}
            className={`title-space ${phase === "collapsed" || phase === "condensed" ? "hidden" : ""}`}
          >
            {" "}
          </span>,
        );
      } else if (vowels.has(char)) {
        const vowelClass =
          phase === "full" ? "" : phase === "fading" ? "fade-out" : "collapse";
        result.push(
          <span key={i} className={`title-letter title-vowel ${vowelClass}`}>
            {char}
          </span>,
        );
      } else {
        const posInfo = consonantPositions[consonantIndex];
        const isGroupStart = posInfo.pos === 0 && posInfo.group > 0;
        consonantIndex++;

        result.push(
          <span
            key={i}
            className={`title-letter title-consonant ${isGroupStart && phase === "condensed" ? "group-start" : ""}`}
          >
            {char}
          </span>,
        );
      }
    }

    return result;
  }, [phase, consonantPositions]);

  return <h1 className="animated-title">{letters}</h1>;
}

function App(): React.ReactElement {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(
    null,
  );
  const [round, setRound] = useState<Round | null>(null);
  const [currentClueIndex, setCurrentClueIndex] = useState<number>(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [score, setScore] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [categoriesPlayed, setCategoriesPlayed] = useState<number>(0);
  const [categoryKey, setCategoryKey] = useState<number>(0);

  // Voice recognition state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [voiceSupported, setVoiceSupported] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-GB";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const current = event.resultIndex;
        const result = event.results[current];
        const text = result[0].transcript;
        setTranscript(text);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        // Set up phrase hints if browser supports it
        if (
          "phrases" in recognitionRef.current &&
          round &&
          !revealed.includes(currentClueIndex)
        ) {
          // Get all possible answers for current category as hints
          const phrases: SpeechRecognitionPhrase[] = round.clues.map((c) => ({
            phrase: rot13(c.answer).toLowerCase(),
            boost: 1,
          }));
          // Add "pass" as a valid phrase
          phrases.push({ phrase: "pass", boost: 1 });
          recognitionRef.current.phrases = phrases;
        }
        setTranscript("");
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  }, [isListening, round, currentClueIndex, revealed]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.error("Failed to stop recognition:", e);
      }
    }
  }, [isListening]);

  const playAgain = useCallback(() => {
    stopListening();
    setGameState("menu");
    setRound(null);
    setRevealed([]);
    setScore(0);
    setTranscript("");
    setCategoriesPlayed(0);
    setUserAnswers([]);
  }, [stopListening]);

  // Start listening when a new clue appears or on results screen
  useEffect(() => {
    if (voiceEnabled && voiceSupported) {
      if (gameState === "playing" && !revealed.includes(currentClueIndex)) {
        // Small delay to ensure previous recognition has stopped
        const timer = setTimeout(() => startListening(), 300);
        return () => clearTimeout(timer);
      } else if (gameState === "results") {
        // Listen for "new game" on results screen
        const timer = setTimeout(() => startListening(), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [
    currentClueIndex,
    gameState,
    voiceEnabled,
    voiceSupported,
    revealed,
    startListening,
  ]);

  const loadNextCategory = useCallback(async () => {
    if (!selectedDifficulty) return;
    try {
      const res = await fetch(
        `${API_URL}/round?difficulty=${selectedDifficulty}`,
      );
      const data: Round = await res.json();
      setRound(data);
      setCurrentClueIndex(0);
      setRevealed([]);
      setCategoriesPlayed((c) => c + 1);
      setCategoryKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to load next category:", err);
    }
  }, [selectedDifficulty]);

  const revealAnswer = useCallback(
    (correct: boolean) => {
      if (!round || revealed.includes(currentClueIndex)) return;

      stopListening();
      setRevealed([...revealed, currentClueIndex]);
      setUserAnswers((prev) => [
        ...prev,
        {
          clue: round.clues[currentClueIndex],
          correct,
          category: round.category,
        },
      ]);

      if (correct) {
        // 1 point per correct answer
        setScore((s) => s + 1);
      }

      // Auto-advance after brief delay
      setTimeout(() => {
        if (currentClueIndex < round.clues.length - 1) {
          setCurrentClueIndex((i) => i + 1);
          setTranscript("");
        } else {
          // Completed category - load next one
          setTranscript("");
          loadNextCategory();
        }
      }, 1500);
    },
    [round, revealed, currentClueIndex, stopListening, loadNextCategory],
  );

  // Process transcript when it changes
  useEffect(() => {
    if (!transcript) return;

    const normalizedTranscript = normalizeText(transcript);

    // Check for "new game" command on results screen
    if (gameState === "results") {
      if (
        normalizedTranscript.includes("new game") ||
        normalizedTranscript.includes("play again") ||
        normalizedTranscript.includes("start again")
      ) {
        stopListening();
        setTranscript("");
        playAgain();
        return;
      }
      return;
    }

    // Only process game commands if playing and not revealed
    if (!round || revealed.includes(currentClueIndex)) return;

    // Check for pass command - reveals answer as incorrect
    if (normalizedTranscript.includes("pass")) {
      stopListening();
      setTranscript("");
      revealAnswer(false);
      return;
    }

    // Check if answer is correct
    const currentClue = round.clues[currentClueIndex];
    if (checkAnswer(transcript, rot13(currentClue.answer))) {
      stopListening();
      setTranscript("");
      revealAnswer(true);
    }
  }, [
    transcript,
    round,
    currentClueIndex,
    revealed,
    gameState,
    stopListening,
    playAgain,
    revealAnswer,
  ]);

  // Fetch difficulties on mount
  useEffect(() => {
    fetch(`${API_URL}/difficulties`)
      .then((res) => res.json())
      .then((data: { difficulties: Difficulty[] }) =>
        setDifficulties(data.difficulties),
      )
      .catch((err) => console.error("Failed to fetch difficulties:", err));
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      stopListening();
      setTimerActive(false);
      setGameState("results");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timeLeft, stopListening]);

  const startGame = async (difficulty: string): Promise<void> => {
    setSelectedDifficulty(difficulty);
    try {
      const res = await fetch(`${API_URL}/round?difficulty=${difficulty}`);
      const data: Round = await res.json();
      setRound(data);
      setCurrentClueIndex(0);
      setRevealed([]);
      setScore(0);
      setTimeLeft(60);
      setUserAnswers([]);
      setTranscript("");
      setCategoriesPlayed(1);
      setGameState("playing");
      setTimerActive(true);
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  };

  const toggleVoice = (): void => {
    if (voiceEnabled) {
      stopListening();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  if (gameState === "menu") {
    return (
      <div className="app">
        <header>
          <AnimatedTitle />
          <p className="subtitle">Inspired by Only Connect</p>
        </header>

        <div className="menu">
          <h2>Select Difficulty</h2>
          <div className="difficulty-grid">
            {difficulties.map((d) => (
              <button
                key={d.level}
                className={`difficulty-btn difficulty-${d.level}`}
                onClick={() => startGame(d.level)}
                disabled={d.count === 0}
              >
                <span className="diff-name">{d.name}</span>
                <span className="diff-count">{d.count} categories</span>
              </button>
            ))}
          </div>

          {voiceSupported && (
            <div className="voice-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={toggleVoice}
                />
                🎤 Voice Recognition {voiceEnabled ? "On" : "Off"}
              </label>
              <p className="voice-hint">Say your answer or "Pass"</p>
            </div>
          )}
        </div>

        <footer>
          <p>Identify the words or phrases with their vowels removed!</p>
        </footer>
      </div>
    );
  }

  if (gameState === "playing" && round) {
    const currentClue = round.clues[currentClueIndex];
    const isRevealed = revealed.includes(currentClueIndex);

    return (
      <div className="app">
        <div className="top-bar">
          <div className="top-stat">
            <span className={`top-timer ${timeLeft <= 10 ? "urgent" : ""}`}>
              {timeLeft}
            </span>
            <span className="top-label">seconds</span>
          </div>
          <div className="top-stat">
            <span className="top-score">{score}</span>
            <span className="top-label">points</span>
          </div>
        </div>

        <header className="game-header">
          <div key={categoryKey} className="category-badge new-category">
            <span className="category-name">{round.category}</span>
          </div>
        </header>

        <main className="game-area">
          <div className="clue-card">
            <div className="clue-text">{currentClue.clue}</div>
            {isRevealed && (
              <div className="answer-reveal">
                <div className="answer-text">{rot13(currentClue.answer)}</div>
              </div>
            )}
          </div>

          {voiceEnabled && voiceSupported && !isRevealed && (
            <div
              className={`voice-indicator ${isListening ? "listening" : ""}`}
              onClick={!isListening ? startListening : undefined}
              style={{ cursor: !isListening ? "pointer" : "default" }}
            >
              <span className="mic-icon">{isListening ? "🎤" : "🎙️"}</span>
              <span className="voice-status">
                {isListening ? "Listening..." : "Tap to listen"}
              </span>
              <span className="transcript">
                {transcript ? `"${transcript}"` : "\u00A0"}
              </span>
            </div>
          )}

          {!isRevealed && (
            <div className="controls">
              <button
                className="btn btn-correct"
                onClick={() => revealAnswer(true)}
              >
                ✓ Got It!
              </button>
              <button
                className="btn btn-wrong"
                onClick={() => revealAnswer(false)}
              >
                ✗ Show Answer
              </button>
            </div>
          )}
        </main>

        <div className="progress-bar">
          {round.clues.map((_, i) => (
            <div
              key={i}
              className={`progress-dot ${i === currentClueIndex ? "current" : ""} ${revealed.includes(i) ? "done" : ""}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (gameState === "results") {
    const correctCount = userAnswers.filter((a) => a.correct).length;

    // Group answers by category
    const answersByCategory = userAnswers.reduce<Record<string, UserAnswer[]>>(
      (acc, answer) => {
        const cat = answer.category || "Unknown";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(answer);
        return acc;
      },
      {},
    );

    return (
      <div className="app">
        <header>
          <h1>Time's Up!</h1>
        </header>

        <main className="results">
          <div className="score-display">
            <div className="final-score">{score}</div>
            <div className="score-label">points</div>
          </div>

          <div className="stats-row">
            <div className="result-stat">
              <span className="result-value">{correctCount}</span>
              <span className="result-label">correct</span>
            </div>
            <div className="result-stat">
              <span className="result-value">
                {userAnswers.length - correctCount}
              </span>
              <span className="result-label">missed</span>
            </div>
            <div className="result-stat">
              <span className="result-value">{categoriesPlayed}</span>
              <span className="result-label">categories</span>
            </div>
          </div>

          {Object.entries(answersByCategory).map(([category, answers]) => (
            <div key={category} className="round-summary">
              <h3>{category}</h3>
              <ul className="answers-list">
                {answers.map((answer, i) => (
                  <li key={i} className={answer.correct ? "correct" : "missed"}>
                    <span className="answer-clue">{answer.clue.clue}</span>
                    <span className="answer-solution">
                      {rot13(answer.clue.answer)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <button className="btn btn-play-again" onClick={playAgain}>
            Play Again
          </button>

          {voiceEnabled && voiceSupported && (
            <div
              className={`voice-indicator results-voice ${isListening ? "listening" : ""}`}
            >
              <span className="mic-icon">{isListening ? "🎤" : "🎙️"}</span>
              <span className="voice-status">
                {isListening ? 'Say "New Game" to play again' : "Voice paused"}
              </span>
              {transcript && <span className="transcript">"{transcript}"</span>}
            </div>
          )}
        </main>
      </div>
    );
  }

  return <div className="app">Loading...</div>;
}

export default App;
