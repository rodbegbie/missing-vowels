# Missing Vowels Game 🎮

A web-based word puzzle game inspired by the BBC's "Only Connect" Missing Vowels round. Players are presented with phrases where all vowels have been removed, and must guess the original text before time runs out.

## 🎯 Features

- **Multiple Difficulty Levels**: Five levels (Easy to Hard) that control
  which categories you're served, based on answer length, vowel density,
  and topic obscurity
- **Diverse Categories**: Hundreds of categories with thousands of clues
  across various topics
- **Voice Recognition**: Optional speech recognition for hands-free gameplay
- **Smart Answer Checking**: Fuzzy matching algorithm that accepts close
  answers
- **Scoring**: One point per correct answer within the 60-second round
- **Results Summary**: Detailed breakdown of performance at the end of
  each game

## 🛠 Tech Stack

### Backend
- Python 3.13
- Flask web framework
- Flask-CORS for cross-origin requests
- UV for Python package management

### Frontend
- React 19 with TypeScript
- Webpack for bundling
- Web Speech API for voice recognition
- Modern CSS with responsive design

### Development Tools
- Husky for Git hooks
- lint-staged for pre-commit checks
- Biome for frontend formatting and linting
- Ruff for Python formatting and linting

## 📋 Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- UV (Python package manager): `pip install uv`

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd missing-vowels
   ```

2. **Install dependencies**
   ```bash
   # Install root-level dependencies (dev tools)
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   
   # Backend dependencies are managed by UV
   ```

3. **Run the development servers**

   `backend/app.py` and the frontend dev server both default to port
   8000, and the dev server proxies `/api` to port 8001 — as shipped,
   they collide. Either edit `backend/app.py`'s `app.run(port=...)` to
   8001 before starting it, or skip the dev server entirely and use
   the [production build](#production-build) workflow below, which
   doesn't have this conflict.

   With the backend moved to port 8001:

   In one terminal (backend):

   ```bash
   cd backend
   uv run python app.py
   ```

   In another terminal (frontend):

   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the application**
   - Development (hot-reloading frontend): <http://localhost:8000>
   - Backend API (direct): <http://localhost:8001>/api

### Production Build

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Run the backend** (serves both API and static frontend)
   ```bash
   cd backend
   uv run python app.py
   ```

3. **Access the application** at http://localhost:8000

### Systemd Service (Production Deployment)

For persistent deployment on Linux:

```bash
# Copy and enable the service
sudo cp missing-vowels.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable missing-vowels.service
sudo systemctl start missing-vowels.service

# Check status
systemctl status missing-vowels

# View logs
journalctl -u missing-vowels -f
```

## 📁 Project Structure

```
missing-vowels/
├── backend/
│   ├── app.py              # Flask application and API endpoints
│   ├── categories.py       # Game categories and clues data
│   ├── pyproject.toml      # Python dependencies
│   └── .venv/              # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── App.tsx         # Main React component
│   │   ├── App.css         # Application styles
│   │   └── main.tsx        # Entry point
│   ├── dist/               # Production build output
│   ├── package.json        # Frontend dependencies
│   └── webpack.config.cjs  # Webpack configuration
├── package.json            # Root dev tools (husky, lint-staged)
├── missing-vowels.service  # Systemd service configuration
└── README.md
```

## 🎮 How to Play

1. **Select Difficulty**: Choose your preferred difficulty level (affects game duration)
2. **Start Game**: Click "Start Game" to begin
3. **Read Clues**: Each round presents a category with multiple clues
4. **Guess Answers**: Type your guess or use voice recognition
5. **Submit**: Press Enter or click "Submit" to check your answer
6. **Next Clue**: Correct answers automatically advance to the next clue
7. **View Results**: See your score and review all answers at the end

### Scoring

- One point per correct answer, regardless of how quickly you answer
- Every round runs for a fixed 60 seconds
- Review your performance in the results screen

## 🔧 Development Commands

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run Biome lint
```

### Backend
```bash
cd backend
uv run python app.py  # Run Flask server
```

### Code Formatting
```bash
# Format frontend (from root)
npm run format

# Format backend (from root)
npm run format:backend

# Or commit and let husky run formatters automatically
git commit
```

## 🧪 API Endpoints

- `GET /api/difficulties` - Get available difficulty levels (1-5) with
  a category count for each
- `GET /api/round?difficulty=N` - Get a round: a random category at
  difficulty `N` with up to 4 clues. Answers are ROT13-encoded; decode
  them client-side before displaying
- `GET /api/categories` - List all categories with their computed
  difficulty and answer count

## 🎨 Customization

### Adding Categories

Add an entry to the `CATEGORIES` list in `backend/categories.py`:

```python
{
    "name": "Your Category Name",
    "obscurity_modifier": 0.1,
    "answers": [
        "Answer 1",
        "Answer 2",
        # ...
    ],
},
```

There's no `difficulty` field to set — a category needs at least 5
answers that survive the vowel/digit filter, or it's dropped entirely
at startup. `obscurity_modifier` nudges the computed difficulty up or
down for topics that are harder or easier than their answer length
alone would suggest.

### Adjusting Difficulty

Difficulty (1-5) isn't stored per category — `calculate_difficulty()`
in `backend/app.py` computes it at startup from each answer's length,
vowel count, and word count, plus the category's
`obscurity_modifier`. To retune how a category is scored, adjust its
`obscurity_modifier` rather than setting a difficulty directly.

Round length is a fixed 60 seconds for every difficulty, set in
`frontend/src/App.tsx` (`setTimeLeft(60)`); difficulty only changes
which categories are served, not how long the round runs.

## 📝 License

This project is private and not licensed for public use.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code is formatted (pre-commit hooks will check)
- Frontend code follows TypeScript best practices
- Backend code follows Python type hints conventions

## 🐛 Troubleshooting

### Port Already in Use
If port 8000 is in use:
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9
```

### Voice Recognition Not Working
- Voice recognition requires HTTPS or localhost
- Only works in Chrome/Edge browsers
- Check browser permissions for microphone access

### Build Errors
```bash
# Clean and reinstall dependencies
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install
```

## 📧 Support

For issues or questions, please check existing issues or create a new one in the repository.
