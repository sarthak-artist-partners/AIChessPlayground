import json
import os

import chess
from openai import AsyncOpenAI

from .base import Agent

_MODEL = "gpt-4o"


class OpenAIZeroShotAgent(Agent):
    """
    Chess agent backed by OpenAI's GPT-4o model (zero-shot).

    Sends the current board position (FEN) and legal moves to GPT-4o and
    asks it to pick the best move, returning JSON: {"move": "<SAN>"}.

    Requires the OPEN_AI_API_KEY environment variable.
    """

    def __init__(self, color: str, name: str | None = None) -> None:
        super().__init__(color, name or "GPT-4o")
        api_key = os.environ.get("OPEN_AI_API_KEY")
        if not api_key:
            raise RuntimeError("OPEN_AI_API_KEY environment variable is not set.")
        self._client = AsyncOpenAI(api_key=api_key)

    async def choose_move(self, board: chess.Board) -> str:
        fen = board.fen()
        legal_moves = [board.san(m) for m in board.legal_moves]

        prompt = (
            f"Chess position (FEN): {fen}\n"
            f"Legal moves: {', '.join(legal_moves)}\n\n"
            'Return the best move as JSON in the format: {"move": "..."}\n'
            "The move must be exactly one of the legal moves listed above."
        )

        await self.log(f"[prompt]\n{prompt}")

        response = await self._client.chat.completions.create(
            model=_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        await self.log(f"[response] {raw}")

        data = json.loads(raw)
        try:
            move = board.parse_san(data["move"])
        except chess.IllegalMoveError as exc:
            await self.log(f" Illegal move from model: {data.get('move')!r}", type="error")
            raise exc
        return move.uci()
