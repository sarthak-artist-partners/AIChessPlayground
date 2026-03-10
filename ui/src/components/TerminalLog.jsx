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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerWhite: { color: '#e0e0e0' },
  headerBlack: { color: '#888' },
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
  entryThinking: {
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#e0e0e0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    opacity: 0.7,
  },
  entryError: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#ff4444',
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
  agentSelector: {
    position: 'relative',
  },
  agentButton: {
    background: 'none',
    border: '1px solid #2a2a2a',
    borderRadius: '3px',
    color: '#555',
    fontSize: '11px',
    letterSpacing: '1px',
    padding: '2px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    transition: 'border-color 0.1s, color 0.1s',
  },
  agentButtonActive: {
    borderColor: '#444',
    color: '#888',
  },
  agentButtonDisabled: {
    cursor: 'default',
    opacity: 0.4,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    backgroundColor: '#161616',
    border: '1px solid #3a3a3a',
    borderRadius: '4px',
    zIndex: 100,
    minWidth: '130px',
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: '7px 12px',
    fontSize: '11px',
    color: '#777',
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'background-color 0.1s',
  },
  dropdownItemSelected: {
    color: '#00ff88',
    backgroundColor: '#0a1a10',
  },
  levelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderTop: '1px solid #222',
    fontSize: '11px',
    color: '#555',
    letterSpacing: '1px',
  },
  levelBtn: {
    background: 'none',
    border: '1px solid #2a2a2a',
    borderRadius: '2px',
    color: '#666',
    fontSize: '14px',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    padding: 0,
    lineHeight: 1,
  },
  levelValue: {
    minWidth: '22px',
    textAlign: 'center',
    color: '#00ff88',
    fontWeight: 'bold',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: '#111',
    borderTop: '1px solid #1e1e1e',
    fontSize: '11px',
    letterSpacing: '1px',
    color: '#444',
  },
  statValue: {
    color: '#888',
    fontWeight: 'bold',
    marginRight: '3px',
  },
}

export default function TerminalLog({
  player,
  logs,
  isCalculating,
  agent,
  onAgentChange,
  availableAgents,
  gameStarted,
  skillLevel,
  onSkillLevelChange,
  stats,
}) {
  const bottomRef = useRef(null)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hoveredAgent, setHoveredAgent] = useState(null)
  const selectorRef = useRef(null)

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  const headerColor = player === 'WHITE' ? styles.headerWhite : styles.headerBlack
  const canConfigure = !gameStarted

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={headerColor}>{player}</span>

        <div ref={selectorRef} style={styles.agentSelector}>
          <button
            style={{
              ...styles.agentButton,
              ...(dropdownOpen ? styles.agentButtonActive : {}),
              ...(gameStarted ? styles.agentButtonDisabled : {}),
            }}
            onClick={() => canConfigure && setDropdownOpen((o) => !o)}
            title={canConfigure ? 'Select agent' : 'Cannot change agent while game is running'}
          >
            <span>{agent === 'stockfish' ? `stockfish · ${skillLevel}` : agent}</span>
            <span style={{ opacity: 0.5, letterSpacing: 0, fontSize: '10px' }}>···</span>
          </button>

          {dropdownOpen && (
            <div style={styles.dropdown}>
              {(availableAgents || []).map((a) => (
                <div
                  key={a}
                  style={{
                    ...styles.dropdownItem,
                    ...(a === agent ? styles.dropdownItemSelected : {}),
                    ...(hoveredAgent === a && a !== agent
                      ? { backgroundColor: '#1f1f1f', color: '#aaa' }
                      : {}),
                  }}
                  onMouseEnter={() => setHoveredAgent(a)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  onClick={() => {
                    onAgentChange(a)
                    setDropdownOpen(false)
                  }}
                >
                  {a === agent ? `✓ ${a}` : a}
                </div>
              ))}
              {agent === 'stockfish' && (
                <div style={styles.levelRow}>
                  <span>LEVEL</span>
                  <button
                    style={{ ...styles.levelBtn, ...(!canConfigure ? { opacity: 0.4, cursor: 'default' } : {}) }}
                    onClick={() => canConfigure && onSkillLevelChange(Math.max(0, skillLevel - 1))}
                  >−</button>
                  <span style={styles.levelValue}>{skillLevel}</span>
                  <button
                    style={{ ...styles.levelBtn, ...(!canConfigure ? { opacity: 0.4, cursor: 'default' } : {}) }}
                    onClick={() => canConfigure && onSkillLevelChange(Math.min(20, skillLevel + 1))}
                  >+</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.logArea}>
        {logs.length === 0 && !isCalculating ? (
          <span style={styles.empty}>awaiting moves...</span>
        ) : (
          logs.map((entry, i) => {
            const entryStyle =
              entry.type === 'thinking' ? styles.entryThinking :
              entry.type === 'error'    ? styles.entryError :
              styles.entry
            return (
              <div key={i} style={entryStyle}>
                <span style={styles.prompt}>&gt;</span>
                {entry.text}
              </div>
            )
          })
        )}
        {isCalculating && (
          <div style={styles.spinner}>
            {SPINNER_FRAMES[spinnerFrame]}{` Calculating... ${elapsed}s`}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={styles.statsBar}>
        <span><span style={styles.statValue}>{stats?.moves ?? 0}</span>MOVES</span>
        <span><span style={styles.statValue}>{stats?.invalidMoves ?? 0}</span>INVALID</span>
        <span><span style={styles.statValue}>{(stats?.totalTime ?? 0).toFixed(1)}s</span>TOTAL TIME</span>
      </div>
    </div>
  )
}
