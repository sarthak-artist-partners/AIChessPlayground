from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(ws)


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
