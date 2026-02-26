import { useState, useEffect, useRef } from 'react'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0d0d0d',
    border: '1px solid #333',
    borderRadius: '4px',
    overflow: 'hidden',
    minWidth: 0,
  },
  header: {
    padding: '8px 12px',
    backgroundColor: '#111',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    color: '#aaa',
  },
  headerWhite: {
    color: '#e0e0e0',
  },
  headerBlack: {
    color: '#888',
  },
  logArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  entry: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#00ff88',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  prompt: {
    color: '#555',
    marginRight: '4px',
  },
  empty: {
    color: '#333',
    fontStyle: 'italic',
    fontSize: '12px',
  },
  spinner: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#f0a500',
    whiteSpace: 'pre',
  },
}

export default function TerminalLog({ player, logs, isCalculating }) {
  const bottomRef = useRef(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!isCalculating) {
      startTimeRef.current = null
      setElapsed(0)
      setSpinnerFrame(0)
      return
    }
    startTimeRef.current = Date.now()
    setElapsed(0)
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length)
      setElapsed(((Date.now() - startTimeRef.current) / 1000).toFixed(1))
    }, 100)
    return () => clearInterval(interval)
  }, [isCalculating])

  const headerColor = player === 'WHITE' ? styles.headerWhite : styles.headerBlack

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, ...headerColor }}>
        {player}
      </div>
      <div style={styles.logArea}>
        {logs.length === 0 && !isCalculating ? (
          <span style={styles.empty}>awaiting moves...</span>
        ) : (
          logs.map((entry, i) => (
            <div key={i} style={styles.entry}>
              <span style={styles.prompt}>&gt;</span>
              {entry}
            </div>
          ))
        )}
        {isCalculating && (
          <div style={styles.spinner}>
            {SPINNER_FRAMES[spinnerFrame]}{` Calculating... ${elapsed}s`}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
