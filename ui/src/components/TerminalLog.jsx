import { useEffect, useRef } from 'react'

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
}

export default function TerminalLog({ player, logs }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const headerColor = player === 'WHITE' ? styles.headerWhite : styles.headerBlack

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, ...headerColor }}>
        {player}
      </div>
      <div style={styles.logArea}>
        {logs.length === 0 ? (
          <span style={styles.empty}>awaiting moves...</span>
        ) : (
          logs.map((entry, i) => (
            <div key={i} style={styles.entry}>
              <span style={styles.prompt}>&gt;</span>
              {entry}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
