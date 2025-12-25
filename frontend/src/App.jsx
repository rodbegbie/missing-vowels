import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = '/api'

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
      setTimerActive(false)
      setGameState('results')
    }
    return () => clearInterval(interval)
  }, [timerActive, timeLeft])

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
      setGameState('playing')
      setTimerActive(true)
    } catch (err) {
      console.error('Failed to start game:', err)
    }
  }

  const revealAnswer = (correct) => {
    if (revealed.includes(currentClueIndex)) return
    
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
      } else {
        setTimerActive(false)
        setGameState('results')
      }
    }, 1500)
  }

  const skipClue = () => {
    if (currentClueIndex < round.clues.length - 1) {
      setCurrentClueIndex(i => i + 1)
    } else {
      setTimerActive(false)
      setGameState('results')
    }
  }

  const playAgain = () => {
    setGameState('menu')
    setRound(null)
    setRevealed([])
    setScore(0)
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
