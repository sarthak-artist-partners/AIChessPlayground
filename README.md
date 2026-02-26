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
│   ├── server.py          # FastAPI WebSocket + REST backend
│   └── requirements.txt   # Python dependencies
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChessGame.jsx   # Game state, WebSocket hub, layout
│   │   │   └── TerminalLog.jsx # Scrollable terminal panel per player
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── articles/              # Write-ups and experiment results
├── docs/                  # Additional documentation
└── tst/                   # Test scripts / scratch
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

---

## Running Locally

### 1. Backend

```bash
cd src
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8080 --reload
```

### 2. Frontend

```bash
cd ui
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

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

Each player gets their own terminal panel that logs every move they make. While a player's AI is thinking, their terminal shows an animated braille spinner and a live elapsed-time counter:

```
⠹ Calculating... 3.2s
```

The spinner stops automatically when the game ends (checkmate, stalemate, draw).

### WebSocket Protocol

The backend broadcasts move events to all connected UI clients over WebSocket.

**Backend → UI** (sent via `POST /move`, broadcast to all WS clients):
```json
{ "move": "e4", "player": "white" }
```

**Fields:**

| Field    | Type   | Description |
|----------|--------|-------------|
| `move`   | string | Move in SAN or UCI notation (e.g. `"e4"`, `"Nf3"`, `"e2e4"`) |
| `player` | string | `"white"` or `"black"` — which side played the move |

### REST Endpoints

| Method | Path      | Description |
|--------|-----------|-------------|
| `POST` | `/move`   | Submit a move; broadcasts to all WS clients |
| `GET`  | `/health` | Health check — returns `{"ok": true}` |

**POST /move — request body:**
```json
{ "move": "e4", "player": "white" }
```

---

## Sending Moves (from your AI agent)

Any process — a Python script, a notebook, another service — can push moves to the board by hitting the REST endpoint:

```bash
curl -X POST http://localhost:8080/move \
     -H "Content-Type: application/json" \
     -d '{"move": "e4", "player": "white"}'
```

Or from Python:

```python
import requests

requests.post("http://localhost:8080/move", json={"move": "e4", "player": "white"})
```

The UI will immediately apply the move, animate the board, highlight the squares, log the move to the correct player's terminal, and switch the calculating spinner to the other player.
