"""
Game orchestrator — runs two agents against each other and
broadcasts each move to the UI via the FastAPI server.

Usage:
    # terminal 1 — start the server
    uvicorn server:app --port 8080

    # terminal 2 — start the game
    python game.py
"""

import asyncio

import chess
import httpx

from agents import Agent, StockfishAgent

SERVER_URL = "http://localhost:8080"
MOVE_DELAY = 0.6  # seconds between moves so the UI animation can keep up


async def run_game(white: Agent, black: Agent, move_delay: float = MOVE_DELAY) -> str:
    board = chess.Board()

    await white.on_game_start(board)
    await black.on_game_start(board)

    agents = {chess.WHITE: white, chess.BLACK: black}

    async with httpx.AsyncClient(base_url=SERVER_URL, timeout=5.0) as client:
        while not board.is_game_over():
            agent = agents[board.turn]

            uci = await agent.choose_move(board)
            move = chess.Move.from_uci(uci)

            if move not in board.legal_moves:
                raise ValueError(f"Illegal move {uci!r} from {agent.name}")

            # Convert to SAN before pushing — chess.js on the UI side expects SAN
            san = board.san(move)
            board.push(move)

            print(f"[{agent.color.upper():5}] {agent.name}: {san}")

            await client.post("/move", json={"move": san, "player": agent.color})
            await asyncio.sleep(move_delay)

    await white.on_game_end(board)
    await black.on_game_end(board)

    result = board.result()
    print(f"\nGame over — {result}")
    return result


async def main() -> None:
    white = StockfishAgent(color="white", skill_level=5)
    black = StockfishAgent(color="black", skill_level=20)
    await run_game(white, black)


if __name__ == "__main__":
    asyncio.run(main())
