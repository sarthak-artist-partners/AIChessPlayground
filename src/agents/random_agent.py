import random

import chess

from .base import Agent


class RandomAgent(Agent):
    """Plays a uniformly random legal move every turn."""

    async def choose_move(self, board: chess.Board) -> str:
        legal = list(board.legal_moves)
        if not legal:
            raise RuntimeError(f"{self.name}: no legal moves available")
        return random.choice(legal).uci()
