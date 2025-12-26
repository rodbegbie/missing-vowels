import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const API_URL = '/api'

// Normalize text for comparison (lowercase, remove punctuation, extra spaces)
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Check if spoken answer matches the correct answer (fuzzy matching)
function checkAnswer(spoken, correct) {
  const normalizedSpoken = normalizeText(spoken)
  const normalizedCorrect = normalizeText(correct)
  
  // Exact match
  if (normalizedSpoken === normalizedCorrect) return true
  
  // Check if spoken contains the answer
  if (normalizedSpoken.includes(normalizedCorrect)) return true
  if (normalizedCorrect.includes(normalizedSpoken) && normalizedSpoken.length > 3) return true
  
  // Check similarity (allow for small speech recognition errors)
  const spokenWords = normalizedSpoken.split(' ')
  const correctWords = normalizedCorrect.split(' ')
  
  // Count matching words
  let matches = 0
  for (const word of correctWords) {
    if (spokenWords.some(sw => sw === word || 
        (sw.length > 3 && word.length > 3 && 
         (sw.includes(word) || word.includes(sw) ||
          levenshteinDistance(sw, word) <= Math.floor(word.length / 3))))) {
      matches++
    }
  }
  
  // If most words match, consider it correct
  return matches >= Math.ceil(correctWords.length * 0.7)
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function App() {
  const [gameState, setGameState] = useState('menu') // 'menu', 'playing', 'results'
  const [difficulties, setDifficulties] = useState([])
  const [selectedDifficulty, setSelectedDifficulty] = useState(null)
  const [round, setRound] = useState(null)
  const [currentClueIndex, setCurrentClueIndex] = useState(0)
  const [revealed, setRevealed] = useState([])
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(40)
  const [timerActive, setTimerActive] = useState(false)
  const [userAnswers, setUserAnswers] = useState([])
  
  // Voice recognition state
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const recognitionRef = useRef(null)

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-GB'
      
      recognition.onresult = (event) => {
        const current = event.resultIndex
        const result = event.results[current]
        const text = result[0].transcript
        setTranscript(text)
      }
      
      recognition.onend = () => {
        setIsListening(false)
      }
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognitionRef.current = recognition
    }
  }, [])

  // Start listening when a new clue appears
  useEffect(() => {
    if (gameState === 'playing' && voiceEnabled && voiceSupported && !revealed.includes(currentClueIndex)) {
      startListening()
    }
  }, [currentClueIndex, gameState, voiceEnabled, voiceSupported])

  // Process transcript when it changes
  useEffect(() => {
    if (!transcript || !round || revealed.includes(currentClueIndex)) return
    
    const normalizedTranscript = normalizeText(transcript)
    
    // Check for pass/skip commands
    if (normalizedTranscript.includes('pass') || normalizedTranscript.includes('skip') || normalizedTranscript.includes('next')) {
      stopListening()
      skipClue()
      setTranscript('')
      return
    }
    
    // Check if answer is correct
    const currentClue = round.clues[currentClueIndex]
    if (checkAnswer(transcript, currentClue.answer)) {
      stopListening()
      revealAnswer(true)
      setTranscript('')
    }
  }, [transcript, round, currentClueIndex, revealed])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('')
        recognitionRef.current.start()
        setIsListening(true)
      } catch (e) {
        console.error('Failed to start recognition:', e)
      }
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
      } catch (e) {
        console.error('Failed to stop recognition:', e)
      }
    }
  }, [isListening])

  // Fetch difficulties on mount
  useEffect(() => {
    fetch(`${API_URL}/difficulties`)
      .then(res => res.json())
      .then(data => setDifficulties(data.difficulties))
      .catch(err => console.error('Failed to fetch difficulties:', err))
  }, [])

  // Timer logic
  useEffect(() => {
    let interval = null
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      stopListening()
      setTimerActive(false)
      setGameState('results')
    }
    return () => clearInterval(interval)
  }, [timerActive, timeLeft, stopListening])

  const startGame = async (difficulty) => {
    setSelectedDifficulty(difficulty)
    try {
      const res = await fetch(`${API_URL}/round?difficulty=${difficulty}`)
      const data = await res.json()
      setRound(data)
      setCurrentClueIndex(0)
      setRevealed([])
      setScore(0)
      setTimeLeft(40)
      setUserAnswers([])
      setTranscript('')
      setGameState('playing')
      setTimerActive(true)
    } catch (err) {
      console.error('Failed to start game:', err)
    }
  }

  const revealAnswer = (correct) => {
    if (revealed.includes(currentClueIndex)) return
    
    stopListening()
    setRevealed([...revealed, currentClueIndex])
    setUserAnswers([...userAnswers, { 
      clue: round.clues[currentClueIndex], 
      correct 
    }])
    
    if (correct) {
      // Points based on time remaining
      const points = Math.max(1, Math.ceil(timeLeft / 10))
      setScore(s => s + points)
    }
    
    // Auto-advance after brief delay
    setTimeout(() => {
      if (currentClueIndex < round.clues.length - 1) {
        setCurrentClueIndex(i => i + 1)
        setTranscript('')
      } else {
        setTimerActive(false)
        setGameState('results')
      }
    }, 1500)
  }

  const skipClue = () => {
    stopListening()
    if (currentClueIndex < round.clues.length - 1) {
      setCurrentClueIndex(i => i + 1)
      setTranscript('')
    } else {
      setTimerActive(false)
      setGameState('results')
    }
  }

  const playAgain = () => {
    stopListening()
    setGameState('menu')
    setRound(null)
    setRevealed([])
    setScore(0)
    setTranscript('')
  }

  const toggleVoice = () => {
    if (voiceEnabled) {
      stopListening()
    }
    setVoiceEnabled(!voiceEnabled)
  }

  if (gameState === 'menu') {
    return (
      <div className="app">
        <header>
          <h1>Missing Vowels</h1>
          <p className="subtitle">Inspired by Only Connect</p>
        </header>
        
        <div className="menu">
          <h2>Select Difficulty</h2>
          <div className="difficulty-grid">
            {difficulties.map(d => (
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
                🎤 Voice Recognition {voiceEnabled ? 'On' : 'Off'}
              </label>
              <p className="voice-hint">Say your answer or "Pass" to skip</p>
            </div>
          )}
        </div>
        
        <footer>
          <p>Identify the words or phrases with their vowels removed!</p>
        </footer>
      </div>
    )
  }

  if (gameState === 'playing' && round) {
    const currentClue = round.clues[currentClueIndex]
    const isRevealed = revealed.includes(currentClueIndex)
    
    return (
      <div className="app">
        <header className="game-header">
          <div className="category-badge">
            <span className="category-name">{round.category}</span>
          </div>
          <div className="game-stats">
            <div className="stat">
              <span className="stat-label">Clue</span>
              <span className="stat-value">{currentClueIndex + 1}/4</span>
            </div>
            <div className="stat timer">
              <span className="stat-label">Time</span>
              <span className={`stat-value ${timeLeft <= 10 ? 'urgent' : ''}`}>{timeLeft}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Score</span>
              <span className="stat-value">{score}</span>
            </div>
          </div>
        </header>
        
        <main className="game-area">
          <div className="clue-card">
            <div className="clue-text">{currentClue.clue}</div>
            {isRevealed && (
              <div className="answer-reveal">
                <div className="answer-text">{currentClue.answer}</div>
              </div>
            )}
          </div>
          
          {voiceEnabled && voiceSupported && !isRevealed && (
            <div className={`voice-indicator ${isListening ? 'listening' : ''}`}>
              <span className="mic-icon">{isListening ? '🎤' : '🎙️'}</span>
              <span className="voice-status">
                {isListening ? 'Listening...' : 'Voice paused'}
              </span>
              {transcript && (
                <span className="transcript">"{transcript}"</span>
              )}
              {!isListening && (
                <button className="btn btn-mic" onClick={startListening}>🎤 Retry</button>
              )}
            </div>
          )}
          
          {!isRevealed && (
            <div className="controls">
              <button className="btn btn-correct" onClick={() => revealAnswer(true)}>
                ✓ Got It!
              </button>
              <button className="btn btn-wrong" onClick={() => revealAnswer(false)}>
                ✗ Show Answer
              </button>
              <button className="btn btn-skip" onClick={skipClue}>
                Skip →
              </button>
            </div>
          )}
        </main>
        
        <div className="progress-bar">
          {round.clues.map((_, i) => (
            <div 
              key={i} 
              className={`progress-dot ${i === currentClueIndex ? 'current' : ''} ${revealed.includes(i) ? 'done' : ''}`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (gameState === 'results') {
    const correctCount = userAnswers.filter(a => a.correct).length
    
    return (
      <div className="app">
        <header>
          <h1>Round Complete!</h1>
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
              <span className="result-value">{userAnswers.length - correctCount}</span>
              <span className="result-label">missed</span>
            </div>
          </div>
          
          {round && (
            <div className="round-summary">
              <h3>{round.category}</h3>
              <ul className="answers-list">
                {round.clues.map((clue, i) => {
                  const userAnswer = userAnswers.find(a => a.clue === clue)
                  return (
                    <li key={i} className={userAnswer?.correct ? 'correct' : 'missed'}>
                      <span className="answer-clue">{clue.clue}</span>
                      <span className="answer-solution">{clue.answer}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          
          <button className="btn btn-play-again" onClick={playAgain}>
            Play Again
          </button>
        </main>
      </div>
    )
  }

  return <div className="app">Loading...</div>
}

export default App
