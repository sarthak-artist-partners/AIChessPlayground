import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import TerminalLog from './TerminalLog.jsx'

const WS_URL   = 'ws://localhost:8080/ws'
const HTTP_URL = 'http://localhost:8080'

function findKingSquare(chess, color) {
  const files = 'abcdefgh'
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f]
      if (piece && piece.type === 'k' && piece.color === color) {
        return files[f] + (8 - r)
      }
    }
  }
  return null
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '16px',
    gap: '12px',
    position: 'relative',
  },
  title: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    letterSpacing: '3px',
    color: '#aaa',
    textTransform: 'uppercase',
  },
  mainRow: {
    display: 'flex',
    flex: 1,
    gap: '16px',
    alignItems: 'stretch',
    minHeight: 0,
  },
  boardContainer: {
    width: '480px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButton: {
    background: 'none',
    border: '1px solid #00ff88',
    borderRadius: '4px',
    color: '#00ff88',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '3px',
    padding: '8px 36px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  startButtonDisabled: {
    border: '1px solid #2a2a2a',
    color: '#333',
    cursor: 'not-allowed',
  },
  startButtonRunning: {
    border: '1px solid #f0a500',
    color: '#f0a500',
    cursor: 'not-allowed',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #333',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#666',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: '4px',
  },
  overlayCard: {
    backgroundColor: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    padding: '40px 56px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  overlayTitle: {
    fontSize: '30px',
    fontWeight: 'bold',
    letterSpacing: '5px',
    textTransform: 'uppercase',
  },
  overlaySubtitle: {
    fontSize: '13px',
    letterSpacing: '3px',
    color: '#888',
    textTransform: 'uppercase',
  },
  overlayDismiss: {
    marginTop: '20px',
    background: 'none',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#555',
    fontSize: '11px',
    letterSpacing: '2px',
    padding: '6px 28px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textTransform: 'uppercase',
  },
}

const STATUS_CONFIG = {
  connecting: { color: '#f0a500', label: 'Connecting to ws://localhost:8080/ws...' },
  connected:  { color: '#00ff88', label: 'Connected to ws://localhost:8080/ws' },
  error:      { color: '#ff4444', label: 'Connection error — retrying...' },
  closed:     { color: '#666',    label: 'Disconnected from ws://localhost:8080/ws' },
}

const HIGHLIGHT_FROM   = 'rgba(255, 255,  80, 0.55)'
const HIGHLIGHT_TO     = 'rgba(255, 255,  80, 0.35)'
const HIGHLIGHT_CHECK  = 'rgba(220,  50,  50, 0.85)'
const HIGHLIGHT_WINNER = 'rgba(255, 200,   0, 0.75)'
const HIGHLIGHT_MS     = 800

export default function ChessGame() {
  const chessRef = useRef(new Chess())
  const [position, setPosition] = useState(chessRef.current.fen())
  const [whiteLogs, setWhiteLogs] = useState([])
  const [blackLogs, setBlackLogs] = useState([])
  const [wsStatus, setWsStatus] = useState('connecting')
  const [highlightSquares, setHighlightSquares] = useState({})
  const [checkSquare, setCheckSquare] = useState(null)
  const [currentTurn, setCurrentTurn] = useState('w')
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState(null)   // { title, subtitle, winnerColor }
  const [showOverlay, setShowOverlay] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [whiteAgent, setWhiteAgent] = useState('random')
  const [blackAgent, setBlackAgent] = useState('random')
  const [whiteSkillLevel, setWhiteSkillLevel] = useState(20)
  const [blackSkillLevel, setBlackSkillLevel] = useState(20)
  const [availableAgents, setAvailableAgents] = useState(['random'])
  const wsRef = useRef(null)
  const highlightTimerRef = useRef(null)

  // Fetch available agents from the server
  useEffect(() => {
    fetch(`${HTTP_URL}/agents`)
      .then((r) => r.json())
      .then((data) => { if (data.agents?.length) setAvailableAgents(data.agents) })
      .catch(() => {})
  }, [])

  const connect = useCallback(() => {
    setWsStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setWsStatus('connected')

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        console.warn('Received non-JSON message:', event.data)
        return
      }

      // Game-over signal from server — local chess.js handles the UI details
      if (data.game_over) {
        setGameStarted(false)
        return
      }

      // Thinking/query log or error from an AI agent
      if (data.log && (data.type === 'thinking' || data.type === 'error')) {
        const entry = { text: data.log, type: data.type }
        if (data.player === 'white') {
          setWhiteLogs((prev) => [...prev, entry])
        } else {
          setBlackLogs((prev) => [...prev, entry])
        }
        return
      }

      const { move, player } = data
      if (!move) return

      const chess = chessRef.current

      const addErrorLog = (msg) => {
        const entry = { text: msg, type: 'error' }
        const isWhitesTurn = player ? player === 'white' : chess.turn() === 'w'
        if (isWhitesTurn) setWhiteLogs((prev) => [...prev, entry])
        else setBlackLogs((prev) => [...prev, entry])
      }

      let result
      try {
        result = chess.move(move)
      } catch {
        console.warn('Invalid move received:', move)
        addErrorLog(` Invalid move: ${move}`)
        return
      }

      if (!result) {
        console.warn('Move rejected by chess.js:', move)
        addErrorLog(` Illegal move rejected: ${move}`)
        return
      }

      setPosition(chess.fen())
      setCurrentTurn(chess.turn())

      if (chess.isGameOver()) {
        setGameOver(true)
        setGameStarted(false)
        setCheckSquare(null)

        let title, subtitle, winnerColor = null
        if (chess.isCheckmate()) {
          winnerColor = chess.turn() === 'b' ? 'w' : 'b'
          const winnerName = winnerColor === 'w' ? 'WHITE' : 'BLACK'
          title = 'CHECKMATE'
          subtitle = `${winnerName} WINS`
        } else if (chess.isStalemate()) {
          title = 'DRAW'
          subtitle = 'Stalemate'
        } else if (chess.isInsufficientMaterial()) {
          title = 'DRAW'
          subtitle = 'Insufficient material'
        } else if (chess.isThreefoldRepetition()) {
          title = 'DRAW'
          subtitle = 'Threefold repetition'
        } else {
          title = 'DRAW'
          subtitle = '50-move rule'
        }

        setGameResult({ title, subtitle, winnerColor })
        setShowOverlay(true)

        clearTimeout(highlightTimerRef.current)
        if (winnerColor) {
          const winSq = findKingSquare(chess, winnerColor)
          setHighlightSquares(winSq
            ? { [winSq]: { backgroundColor: HIGHLIGHT_WINNER, boxShadow: 'inset 0 0 0 3px rgba(255, 200, 0, 0.9)' } }
            : {}
          )
        } else {
          setHighlightSquares({})
        }
      } else {
        // Check detection — highlight the king that is in check
        if (chess.inCheck()) {
          setCheckSquare(findKingSquare(chess, chess.turn()))
        } else {
          setCheckSquare(null)
        }

        // Move highlight (fades after HIGHLIGHT_MS)
        clearTimeout(highlightTimerRef.current)
        setHighlightSquares({
          [result.from]: { backgroundColor: HIGHLIGHT_FROM, transition: 'background-color 0.15s ease' },
          [result.to]:   { backgroundColor: HIGHLIGHT_TO,   transition: 'background-color 0.15s ease' },
        })
        highlightTimerRef.current = setTimeout(() => setHighlightSquares({}), HIGHLIGHT_MS)
      }

      const logEntry = { text: ` Move: ${move}`, type: 'move' }
      const isWhite = player ? player === 'white' : result.color === 'w'
      if (isWhite) {
        setWhiteLogs((prev) => [...prev, logEntry])
      } else {
        setBlackLogs((prev) => [...prev, logEntry])
      }
    }

    ws.onerror = () => setWsStatus('error')
    ws.onclose = () => setWsStatus('closed')
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      clearTimeout(highlightTimerRef.current)
    }
  }, [connect])

  const startGame = useCallback(async () => {
    // Reset board state for the new game
    chessRef.current.reset()
    setPosition(chessRef.current.fen())
    setWhiteLogs([])
    setBlackLogs([])
    setGameOver(false)
    setGameResult(null)
    setShowOverlay(false)
    setCheckSquare(null)
    setCurrentTurn('w')
    clearTimeout(highlightTimerRef.current)
    setHighlightSquares({})
    setGameStarted(true)

    try {
      const res = await fetch(`${HTTP_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          white_agent: whiteAgent,
          black_agent: blackAgent,
          white_config: whiteAgent === 'stockfish' ? { skill_level: whiteSkillLevel } : {},
          black_config: blackAgent === 'stockfish' ? { skill_level: blackSkillLevel } : {},
        }),
      })
      if (!res.ok) {
        console.error('Start game error: HTTP', res.status)
        setGameStarted(false)
        return
      }
      const data = await res.json()
      if (!data.ok) {
        console.error('Start game error:', data.error)
        setGameStarted(false)
      }
    } catch (err) {
      console.error('Failed to start game:', err)
      setGameStarted(false)
    }
  }, [whiteAgent, blackAgent, whiteSkillLevel, blackSkillLevel])

  const status   = STATUS_CONFIG[wsStatus]
  const canStart = wsStatus === 'connected' && !gameStarted

  // Merge move highlights with check highlight (check takes precedence on the king square)
  const effectiveSquareStyles = {
    ...highlightSquares,
    ...(checkSquare ? { [checkSquare]: { backgroundColor: HIGHLIGHT_CHECK, boxShadow: 'inset 0 0 0 3px rgba(220, 50, 50, 0.9)' } } : {}),
  }

  return (
    <div style={styles.wrapper}>
      {showOverlay && gameResult && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{ ...styles.overlayTitle, color: gameResult.winnerColor ? '#00ff88' : '#f0a500' }}>
              {gameResult.title}
            </div>
            {gameResult.subtitle && (
              <div style={styles.overlaySubtitle}>{gameResult.subtitle}</div>
            )}
            <button style={styles.overlayDismiss} onClick={() => setShowOverlay(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <div style={styles.title}>AI Chess Playground</div>

      <div style={styles.mainRow}>
        <TerminalLog
          player="WHITE"
          logs={whiteLogs}
          isCalculating={gameStarted && !gameOver && currentTurn === 'w'}
          agent={whiteAgent}
          onAgentChange={setWhiteAgent}
          availableAgents={availableAgents}
          gameStarted={gameStarted}
          skillLevel={whiteSkillLevel}
          onSkillLevelChange={setWhiteSkillLevel}
        />

        <div style={styles.boardContainer}>
          <Chessboard
            position={position}
            boardWidth={480}
            arePiecesDraggable={false}
            animationDuration={250}
            customDarkSquareStyle={{ backgroundColor: '#4a7c59' }}
            customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            customSquareStyles={effectiveSquareStyles}
          />
        </div>

        <TerminalLog
          player="BLACK"
          logs={blackLogs}
          isCalculating={gameStarted && !gameOver && currentTurn === 'b'}
          agent={blackAgent}
          onAgentChange={setBlackAgent}
          availableAgents={availableAgents}
          gameStarted={gameStarted}
          skillLevel={blackSkillLevel}
          onSkillLevelChange={setBlackSkillLevel}
        />
      </div>

      <div style={styles.controls}>
        <button
          style={{
            ...styles.startButton,
            ...(gameStarted ? styles.startButtonRunning : {}),
            ...(!canStart && !gameStarted ? styles.startButtonDisabled : {}),
          }}
          onClick={canStart ? startGame : undefined}
          disabled={!canStart}
        >
          {gameStarted ? '▶  RUNNING...' : '▶  START GAME'}
        </button>
      </div>

      <div style={styles.statusBar}>
        <div style={{ ...styles.statusDot, backgroundColor: status.color }} />
        <span>{status.label}</span>
      </div>
    </div>
  )
}
