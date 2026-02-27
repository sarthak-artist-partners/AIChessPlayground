import asyncio
import shutil

import chess
import chess.engine

from .base import Agent

# Stockfish skill levels (UCI "Skill Level" option):
#   0  — weakest (roughly 1350 Elo)
#   20 — full strength (3000+ Elo)
_MIN_SKILL = 0
_MAX_SKILL = 20


class StockfishAgent(Agent):
    """
    Chess agent backed by the Stockfish engine.

    Stockfish must be installed and reachable on PATH (or supply an
    explicit path).  Install on macOS: ``brew install stockfish``.
    Install on Linux: ``apt install stockfish`` / ``dnf install stockfish``.

    Args:
        color:       'white' or 'black'.
        skill_level: Stockfish skill level 0–20.  0 is the weakest,
                     20 is full strength.  Defaults to 20.
        think_time:  Seconds of clock time given to Stockfish per move.
                     Defaults to 0.1 s.
        path:        Explicit path to the Stockfish binary.  If None,
                     the binary is located automatically via PATH.
        name:        Display name shown in terminal logs.
    """

    def __init__(
        self,
        color: str,
        skill_level: int = 20,
        think_time: float = 0.1,
        path: str | None = None,
        name: str | None = None,
    ) -> None:
        if not (_MIN_SKILL <= skill_level <= _MAX_SKILL):
            raise ValueError(
                f"skill_level must be between {_MIN_SKILL} and {_MAX_SKILL}, "
                f"got {skill_level}"
            )
        super().__init__(color, name or f"Stockfish-{skill_level}")

        self.skill_level = skill_level
        self.think_time = think_time
        self._path = path or shutil.which("stockfish")

        if self._path is None:
            raise RuntimeError(
                "Stockfish binary not found. Install it (e.g. 'brew install stockfish') "
                "or pass an explicit path= to StockfishAgent."
            )

        self._engine: chess.engine.UciProtocol | None = None
        self._transport: asyncio.SubprocessTransport | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def on_game_start(self, board: chess.Board) -> None:
        """Start the Stockfish subprocess and configure skill level."""
        self._transport, self._engine = await chess.engine.popen_uci(self._path)
        await self._engine.configure({"Skill Level": self.skill_level})

    async def on_game_end(self, board: chess.Board) -> None:
        """Shut down the Stockfish subprocess cleanly."""
        if self._engine is not None:
            await self._engine.quit()
            self._engine = None
            self._transport = None

    # ------------------------------------------------------------------
    # Move selection
    # ------------------------------------------------------------------

    async def choose_move(self, board: chess.Board) -> str:
        if self._engine is None:
            raise RuntimeError(
                f"{self.name}: engine is not running. "
                "Was on_game_start() called before choose_move()?"
            )
        result = await self._engine.play(
            board,
            chess.engine.Limit(time=self.think_time),
        )
        if result.move is None:
            raise RuntimeError(f"{self.name}: Stockfish returned no move")
        return result.move.uci()
