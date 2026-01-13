# Missing Vowels Game 🎮

A web-based word puzzle game inspired by the BBC's "Only Connect" Missing Vowels round. Players are presented with phrases where all vowels have been removed, and must guess the original text before time runs out.

## 🎯 Features

- **Multiple Difficulty Levels**: Choose from different difficulty settings that affect game duration
- **Diverse Categories**: Over 100 categories with thousands of clues across various topics
- **Voice Recognition**: Optional speech recognition for hands-free gameplay
- **Smart Answer Checking**: Fuzzy matching algorithm that accepts close answers
- **Real-time Scoring**: Points based on speed and accuracy
- **Results Summary**: Detailed breakdown of performance at the end of each game

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
- Prettier for frontend formatting
- Ruff for Python formatting and linting

## 📋 Prerequisites

- Python 3.13+
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
   - Development: http://localhost:3000
   - Backend API: http://localhost:8000

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
├── package.json            # Root dev tools (husky, prettier)
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

- Points are awarded based on how quickly you answer
- Faster answers = more points
- Review your performance in the results screen

## 🔧 Development Commands

### Frontend
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
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

- `GET /api/difficulties` - Get available difficulty levels
- `POST /api/game` - Start a new game with selected difficulty
  - Body: `{"difficulty": "medium"}`
  - Returns: Array of rounds with categories and clues

## 🎨 Customization

### Adding Categories

Edit `backend/categories.py` to add new categories:

```python
CATEGORIES.append(CategoryData(
    name="Your Category Name",
    answers=[
        "Answer 1",
        "Answer 2",
        # ...
    ],
    difficulty=2,  # 1-5 scale
    obscurity_modifier=1.0  # Difficulty multiplier
))
```

### Adjusting Difficulty

Modify the difficulty settings in `backend/app.py`:

```python
DIFFICULTIES: list[dict[str, str | int]] = [
    {"level": "easy", "name": "Easy (120s)", "count": 120},
    # Adjust count for different durations
]
```

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
