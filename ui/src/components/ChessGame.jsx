import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import TerminalLog from './TerminalLog.jsx'

const WS_URL = 'ws://localhost:8080/ws'

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '16px',
    gap: '12px',
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
}

const STATUS_CONFIG = {
  connecting: { color: '#f0a500', label: 'Connecting to ws://localhost:8080/ws...' },
  connected:  { color: '#00ff88', label: 'Connected to ws://localhost:8080/ws' },
  error:      { color: '#ff4444', label: 'Connection error — retrying...' },
  closed:     { color: '#666',    label: 'Disconnected from ws://localhost:8080/ws' },
}

const HIGHLIGHT_FROM = 'rgba(255, 255,  80, 0.55)'
const HIGHLIGHT_TO   = 'rgba(255, 255,  80, 0.35)'
const HIGHLIGHT_MS   = 800

export default function ChessGame() {
  const chessRef = useRef(new Chess())
  const [position, setPosition] = useState(chessRef.current.fen())
  const [whiteLogs, setWhiteLogs] = useState([])
  const [blackLogs, setBlackLogs] = useState([])
  const [wsStatus, setWsStatus] = useState('connecting')
  const [highlightSquares, setHighlightSquares] = useState({})
  const [currentTurn, setCurrentTurn] = useState('w')  // white always opens
  const [gameOver, setGameOver] = useState(false)
  const wsRef = useRef(null)
  const highlightTimerRef = useRef(null)

  const connect = useCallback(() => {
    setWsStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        console.warn('Received non-JSON message:', event.data)
        return
      }

      const { move, player } = data
      if (!move) return

      const chess = chessRef.current

      let result
      try {
        result = chess.move(move)
      } catch {
        console.warn('Invalid move received:', move)
        return
      }

      if (!result) {
        console.warn('Move rejected by chess.js:', move)
        return
      }

      setPosition(chess.fen())
      setCurrentTurn(chess.turn())
      if (chess.isGameOver()) setGameOver(true)

      // Highlight the from/to squares, clear after HIGHLIGHT_MS
      clearTimeout(highlightTimerRef.current)
      setHighlightSquares({
        [result.from]: { backgroundColor: HIGHLIGHT_FROM, transition: 'background-color 0.15s ease' },
        [result.to]:   { backgroundColor: HIGHLIGHT_TO,   transition: 'background-color 0.15s ease' },
      })
      highlightTimerRef.current = setTimeout(() => setHighlightSquares({}), HIGHLIGHT_MS)

      const logEntry = ` Move: ${move}`
      // Use player field from server if present, otherwise fall back to chess.turn() before move
      const isWhite = player ? player === 'white' : result.color === 'w'
      if (isWhite) {
        setWhiteLogs((prev) => [...prev, logEntry])
      } else {
        setBlackLogs((prev) => [...prev, logEntry])
      }
    }

    ws.onerror = () => {
      setWsStatus('error')
    }

    ws.onclose = () => {
      setWsStatus('closed')
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      clearTimeout(highlightTimerRef.current)
    }
  }, [connect])

  const status = STATUS_CONFIG[wsStatus]

  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>AI Chess Playground</div>

      <div style={styles.mainRow}>
        <TerminalLog player="WHITE" logs={whiteLogs} isCalculating={!gameOver && currentTurn === 'w'} />

        <div style={styles.boardContainer}>
          <Chessboard
            position={position}
            boardWidth={480}
            arePiecesDraggable={false}
            animationDuration={250}
            customDarkSquareStyle={{ backgroundColor: '#4a7c59' }}
            customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            customSquareStyles={highlightSquares}
          />
        </div>

        <TerminalLog player="BLACK" logs={blackLogs} isCalculating={!gameOver && currentTurn === 'b'} />
      </div>

      <div style={styles.statusBar}>
        <div style={{ ...styles.statusDot, backgroundColor: status.color }} />
        <span>{status.label}</span>
      </div>
    </div>
  )
}
