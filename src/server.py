import asyncio

import chess
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import RandomAgent, StockfishAgent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Agent registry ────────────────────────────────────────────────────────────
AGENT_REGISTRY = {
    "random": RandomAgent,
    "stockfish": StockfishAgent,
}

MOVE_DELAY = 0.6  # seconds between moves so UI animation can keep up


# ── WebSocket manager ─────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        print(f"[WS] Client connected  (total: {len(self.active)})")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        print(f"[WS] Client disconnected (total: {len(self.active)})")

    async def broadcast(self, data: dict) -> int:
        sent = 0
        for ws in list(self.active):
            try:
                await ws.send_json(data)
                sent += 1
            except Exception:
                self.active.remove(ws)
        return sent


manager = ConnectionManager()
_game_task: asyncio.Task | None = None


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── HTTP /move (kept for standalone game.py usage) ────────────────────────────
class MoveRequest(BaseModel):
    move: str
    player: str


@app.post("/move")
async def post_move(req: MoveRequest):
    if req.player.lower() not in ("white", "black"):
        return {"error": '"player" must be "white" or "black"'}

    payload = {"move": req.move, "player": req.player.lower()}
    sent = await manager.broadcast(payload)
    print(f"[HTTP] POST /move  move={req.move}  player={req.player}  → {sent} client(s)")
    return {"ok": True, "move": req.move, "player": req.player.lower(), "clients": sent}


@app.get("/health")
async def health():
    return {"ok": True}


# ── Agent listing ─────────────────────────────────────────────────────────────
@app.get("/agents")
async def get_agents():
    return {"agents": list(AGENT_REGISTRY.keys())}


# ── Game loop (runs as background asyncio task) ───────────────────────────────
async def _run_game(
    white_name: str,
    black_name: str,
    white_config: dict,
    black_config: dict,
) -> None:
    print(f"[GAME] Starting: white={white_name}  black={black_name}")
    try:
        white = AGENT_REGISTRY[white_name](color="white", **white_config)
        black = AGENT_REGISTRY[black_name](color="black", **black_config)

        board = chess.Board()
        await white.on_game_start(board)
        await black.on_game_start(board)

        agents_map = {chess.WHITE: white, chess.BLACK: black}

        while not board.is_game_over():
            agent = agents_map[board.turn]
            uci = await agent.choose_move(board)
            move = chess.Move.from_uci(uci)

            if move not in board.legal_moves:
                print(f"[GAME] Illegal move {uci!r} from {agent.name}, aborting")
                break

            san = board.san(move)
            board.push(move)

            print(f"[GAME] [{agent.color.upper():5}] {agent.name}: {san}")
            await manager.broadcast({"move": san, "player": agent.color})
            await asyncio.sleep(MOVE_DELAY)

        await white.on_game_end(board)
        await black.on_game_end(board)

        result = board.result()
        print(f"[GAME] Game over — {result}")
        await manager.broadcast({"game_over": True, "result": result})

    except asyncio.CancelledError:
        print("[GAME] Task cancelled")
        raise
    except Exception:
        import traceback
        print("[GAME] Unhandled exception in game loop:")
        traceback.print_exc()


# ── Start game endpoint ───────────────────────────────────────────────────────
class StartRequest(BaseModel):
    white_agent: str
    black_agent: str
    white_config: dict = {}
    black_config: dict = {}


@app.post("/start")
async def start_game(req: StartRequest):
    global _game_task

    if req.white_agent not in AGENT_REGISTRY:
        return {"error": f"Unknown agent: {req.white_agent!r}"}
    if req.black_agent not in AGENT_REGISTRY:
        return {"error": f"Unknown agent: {req.black_agent!r}"}

    # Cancel any in-progress game
    if _game_task and not _game_task.done():
        _game_task.cancel()

    _game_task = asyncio.create_task(
        _run_game(req.white_agent, req.black_agent, req.white_config, req.black_config)
    )
    return {"ok": True}
