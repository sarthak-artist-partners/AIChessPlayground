from abc import ABC, abstractmethod

import chess


class Agent(ABC):
    """
    Base class for any entity that plays chess on behalf of a player.

    An Agent is not necessarily AI — a random mover, a Stockfish wrapper,
    or an LLM-backed bot all qualify. The only requirement is that it can
    produce a legal move given a board state.
    """

    def __init__(self, color: str, name: str | None = None) -> None:
        """
        Args:
            color: Which side this agent plays — 'white' or 'black'.
            name:  Display name shown in terminal logs. Defaults to the
                   class name if not provided.
        """
        if color not in ("white", "black"):
            raise ValueError(f"color must be 'white' or 'black', got {color!r}")
        self.color = color
        self.name = name or self.__class__.__name__

    @property
    def color_char(self) -> str:
        """Single-character color used by python-chess ('w' or 'b')."""
        return "w" if self.color == "white" else "b"

    @abstractmethod
    async def choose_move(self, board: chess.Board) -> str:
        """
        Return a move for the current board position.

        The move may be in UCI notation (e.g. 'e2e4') or SAN notation
        (e.g. 'e4'). The caller (game orchestrator) is responsible for
        normalising the format before broadcasting.

        Args:
            board: The current game state. The agent may inspect
                   board.legal_moves, board.is_check(), etc.

        Returns:
            A string representing a legal move.
        """
        ...

    async def on_game_start(self, board: chess.Board) -> None:
        """
        Called once before the first move is requested.

        Override for any setup work — e.g. warming up an engine
        subprocess or loading a model.
        """

    async def on_game_end(self, board: chess.Board) -> None:
        """
        Called once after the game has ended (checkmate, stalemate, draw).

        Override for cleanup — e.g. shutting down an engine subprocess
        or flushing logs.
        """

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r}, color={self.color!r})"
