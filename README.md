# AI Chess Playground

**Goal:** A playground for testing and evaluating AI models on chess — a well-defined, fun domain with clear win/loss signals.

- Pit different AI models/strategies against each other and observe their play
- Explore ideas and technologies (tool use, reasoning models, multi-agent loops)
- Write up results in `articles/`

---

## Repo Structure

```
AIChessPlayground/
├── src/
│   ├── agents/
│   │   ├── base.py            # Abstract Agent base class
│   │   ├── random_agent.py    # Plays a random legal move
│   │   ├── stockfish_agent.py # Stockfish engine wrapper (configurable level)
│   │   └── __init__.py
│   ├── game.py                # Standalone game runner (two agents, HTTP broadcast)
│   ├── server.py              # FastAPI WebSocket + REST backend
│   └── requirements.txt
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChessGame.jsx   # Game state, WebSocket hub, layout
│   │   │   └── TerminalLog.jsx # Scrollable terminal panel per player
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── articles/                  # Write-ups and experiment results
├── docs/                      # Additional documentation
└── tst/                       # Test scripts / scratch
```

---

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18 + Vite |
| Board    | `react-chessboard` v4 |
| Rules    | `chess.js` v1 (move validation, FEN, game-over detection) |
| Backend  | Python — FastAPI + Uvicorn |
| Comms    | Native WebSocket (`ws://localhost:8080/ws`) |
| Engine   | Stockfish (via `chess.engine` in `python-chess`) |

---

## Running Locally

### 1. Install Stockfish (required for the Stockfish agent)

```bash
# macOS
brew install stockfish

# Ubuntu / Debian
sudo apt install stockfish
```

### 2. Backend

```bash
cd src
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8080 --reload
```

### 3. Frontend

```bash
cd ui
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Agents

All agents extend the abstract `Agent` base class in `src/agents/base.py` and implement a single async method:

```python
async def choose_move(self, board: chess.Board) -> str:
    ...  # return a move in UCI or SAN notation
```

Optional lifecycle hooks:

| Hook | When it's called |
|------|-----------------|
| `on_game_start(board)` | Once before the first move |
| `on_game_end(board)` | Once after the game ends |

### Available agents

| Agent | Key | Description |
|-------|-----|-------------|
| `RandomAgent` | `"random"` | Picks a uniformly random legal move |
| `StockfishAgent` | `"stockfish"` | Stockfish engine, configurable skill level (0–20) |

### StockfishAgent options

```python
StockfishAgent(
    color="white",
    skill_level=10,   # 0 (weakest, ~1350 Elo) – 20 (full strength, 3000+ Elo)
    think_time=0.1,   # seconds per move
    path=None,        # explicit path to binary; auto-detected via PATH if None
)
```

---

## Running a Game

### Via the UI

Select agents and (for Stockfish) skill levels in each player's panel, then click **START GAME**. The board updates live as moves are broadcast over WebSocket.

### Via `game.py` (headless)

```bash
# Terminal 1 — start the server
uvicorn server:app --port 8080

# Terminal 2 — run a game
cd src
python game.py
```

Edit `main()` in `game.py` to configure the matchup:

```python
async def main() -> None:
    white = StockfishAgent(color="white", skill_level=5)
    black = StockfishAgent(color="black", skill_level=20)
    await run_game(white, black)
```

---

## Architecture

### UI Layout

Three-column flex row:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   WHITE      │  │              │  │   BLACK      │
│  terminal    │  │  chess board │  │  terminal    │
│              │  │   480 × 480  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
                  ── WebSocket status bar ──
```

Each player panel shows:
- Every move the player has made
- An animated braille spinner + live elapsed-time counter while their AI is thinking
- Agent selector (dropdown) and, when Stockfish is selected, a `−`/`+` skill level control

### Board highlights

| Event | Highlight |
|-------|-----------|
| Last move (from/to squares) | Yellow, fades after 800 ms |
| King in check | Red with inner glow, persists until check is resolved |
| Winning king (checkmate) | Gold with inner glow |

### Game-over overlay

When a game ends, a modal appears over the board showing the result:

- **CHECKMATE** — green title, `WHITE WINS` / `BLACK WINS` subtitle
- **DRAW** — amber title, reason as subtitle (Stalemate / Insufficient material / Threefold repetition / 50-move rule)

The overlay is dismissed with a Close button; the winning king's gold highlight remains on the board.

---

## REST Endpoints

| Method | Path      | Description |
|--------|-----------|-------------|
| `POST` | `/start`  | Start a new game between two agents |
| `GET`  | `/agents` | List registered agent keys |
| `POST` | `/move`   | Broadcast a move to all WS clients (used by `game.py`) |
| `GET`  | `/health` | Health check — returns `{"ok": true}` |

### POST /start

```json
{
  "white_agent": "stockfish",
  "black_agent": "random",
  "white_config": { "skill_level": 10, "think_time": 0.2 },
  "black_config": {}
}
```

`white_config` / `black_config` are passed as keyword arguments to the agent constructor. Both default to `{}`.

### POST /move

```json
{ "move": "e4", "player": "white" }
```

---

## WebSocket Protocol

**Backend → UI** — two event types:

**Move event:**
```json
{ "move": "Nf3", "player": "white" }
```

**Game-over event:**
```json
{ "game_over": true, "result": "1-0" }
```

| Result | Meaning |
|--------|---------|
| `"1-0"` | White wins |
| `"0-1"` | Black wins |
| `"1/2-1/2"` | Draw |
