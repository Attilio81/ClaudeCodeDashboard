import React, { useState } from 'react';

const STATUS_STYLE = {
  active: { color: 'var(--green)', bg: 'var(--green-dim)', border: 'var(--green-border)', label: 'ATTIVO' },
  check:  { color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'var(--amber-border)', label: 'CHECK'  },
  idle:   { color: 'var(--slate)', bg: 'var(--slate-dim)', border: 'var(--slate-border)', label: 'IDLE'   },
  error:  { color: 'var(--red)',   bg: 'var(--red-dim)',   border: 'var(--red-border)',   label: 'ERRORE' },
};

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function InfoRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
        color: 'var(--text-secondary)', minWidth: 44, flexShrink: 0, paddingTop: 1
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
        color: valueColor || 'var(--text-primary)',
        lineHeight: 1.45, wordBreak: 'break-all'
      }}>
        {value}
      </span>
    </div>
  );
}

export default function ProjectCard({ project, status }) {
  const [showHistory, setShowHistory] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isOpeningTerminal, setIsOpeningTerminal] = useState(false);
  const [isExcluding, setIsExcluding] = useState(false);
  const [terminalWindows, setTerminalWindows] = useState(null);
  const [loadingTerminal, setLoadingTerminal] = useState(false);

  const statusKey = status?.status || 'idle';
  const s = STATUS_STYLE[statusKey] || STATUS_STYLE.idle;

  const handleMarkAsChecked = async () => {
    if (isMarking) return;
    setIsMarking(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${encodeURIComponent(project.name)}/mark-checked`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Errore');
    } catch {
      alert('Errore nel segnare il progetto come controllato');
    } finally {
      setIsMarking(false);
    }
  };

  const handleExclude = async () => {
    if (isExcluding) return;
    if (!confirm(`Escludere "${project.name}" dal monitoraggio?\nPercorso: ${project.path}\n\nPotrà essere rimosso da excluded-paths.json per ripristinarlo.`)) return;
    setIsExcluding(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${encodeURIComponent(project.name)}/exclude`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Errore');
      // La card sparirà automaticamente via WebSocket broadcast
    } catch {
      alert('Errore durante l\'esclusione del percorso');
      setIsExcluding(false);
    }
  };

  const handleFindTerminal = async () => {
    setLoadingTerminal(true);
    setTerminalWindows(null);
    try {
      const res = await fetch(`http://localhost:3001/api/projects/${encodeURIComponent(project.name)}/terminal-windows`);
      const data = await res.json();
      setTerminalWindows(data.windows || []);
    } catch {
      setTerminalWindows([]);
    }
    setLoadingTerminal(false);
  };

  const handleOpenTerminal = async () => {
    if (isOpeningTerminal) return;
    setIsOpeningTerminal(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/projects/${encodeURIComponent(project.name)}/open-terminal`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore');
      }
    } catch (e) {
      alert(`Errore: ${e.message}`);
    } finally {
      setIsOpeningTerminal(false);
    }
  };

  const hasHistory = status?.outputHistory && status.outputHistory.length > 0;

  return (
    <div className={`project-card status-${statusKey}`}>

      {/* ── Header: name + CMD + badge ──────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 7 }}>
        <h2 style={{
          flex: 1, margin: 0,
          fontFamily: 'Syne, sans-serif', fontSize: '0.95rem', fontWeight: 700,
          color: 'var(--text-bright)', lineHeight: 1.3, wordBreak: 'break-word'
        }}>
          {project.name}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            onClick={handleExclude}
            disabled={isExcluding}
            title="Escludi questo percorso dal monitoraggio"
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 8px',
              background: 'rgba(255,61,113,0.07)',
              border: '1px solid rgba(255,61,113,0.25)',
              color: 'rgba(255,61,113,0.6)',
              borderRadius: 5,
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,61,113,0.14)'; e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,61,113,0.07)'; e.currentTarget.style.color = 'rgba(255,61,113,0.6)'; }}
          >
            {isExcluding ? <span className="spin" /> : '⊗'}
          </button>
          <button
            onClick={handleOpenTerminal}
            disabled={isOpeningTerminal}
            className="btn-cmd"
            title="Apri CMD nella directory del progetto"
          >
            {isOpeningTerminal ? <span className="spin" /> : <span style={{ opacity: 0.6 }}>›</span>}
            CMD
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px',
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12,
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
            fontWeight: 600, letterSpacing: '0.1em',
            color: s.color, whiteSpace: 'nowrap'
          }}>
            {s.label}
          </span>
        </div>
      </div>

      {/* ── Path ────────────────────────────────────────── */}
      <p style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
        color: 'var(--text-secondary)', margin: '0 0 0',
        wordBreak: 'break-all', lineHeight: 1.5
      }}>
        {project.path}
      </p>

      {/* ── Session Info ────────────────────────────────── */}
      {status?.sessionId && (
        <>
          <div className="card-sep" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {status.slug && <InfoRow label="slug"   value={status.slug} valueColor="var(--text-primary)" />}
            <InfoRow label="id"     value={`${status.sessionId.substring(0, 8)}…`} />
            {status.gitBranch && <InfoRow label="branch" value={status.gitBranch} valueColor="var(--blue)" />}
          </div>
        </>
      )}

      {/* ── Last Update ─────────────────────────────────── */}
      {status && (
        <>
          <div className="card-sep" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
              color: 'var(--text-secondary)', letterSpacing: '0.05em'
            }}>
              aggiornato
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
              color: 'var(--text-primary)'
            }}>
              {fmt(status.lastUpdate)}
            </span>
          </div>
        </>
      )}

      {/* ── Output ──────────────────────────────────────── */}
      {status && (
        <>
          <div className="card-sep" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
              color: 'var(--text-secondary)', letterSpacing: '0.06em'
            }}>
              {statusKey === 'active' ? '⚡ output' : statusKey === 'check' ? '✓ output' : 'output'}
            </span>
            {hasHistory && (
              <button
                onClick={() => setShowHistory(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                  color: 'var(--blue)'
                }}
              >
                {showHistory ? '▼ chiudi' : '▶ storia'}
              </button>
            )}
          </div>

          {!showHistory ? (
            <div className="terminal-block">
              {statusKey === 'active' && (status.fullText || status.lastOutput)
                ? (status.fullText || status.lastOutput)
                : statusKey === 'check' && status.lastOutput
                ? status.lastOutput
                : <span style={{ opacity: 0.5 }}>// sessione inattiva</span>
              }
            </div>
          ) : (
            <div className="terminal-block" style={{ maxHeight: 240 }}>
              {hasHistory
                ? status.outputHistory.map((entry, i) => (
                    <div key={i} style={{
                      borderBottom: i < status.outputHistory.length - 1
                        ? '1px solid var(--border-dim)' : 'none',
                      paddingBottom: 4, marginBottom: 4
                    }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                        {new Date(entry.timestamp).toLocaleTimeString('it-IT')}
                      </span>
                      {entry.toolName && (
                        <span style={{
                          background: 'var(--blue-dim)', color: 'var(--blue)',
                          padding: '0 4px', borderRadius: 3,
                          fontSize: '0.58rem', marginRight: 6
                        }}>
                          {entry.toolName}
                        </span>
                      )}
                      {entry.output}
                    </div>
                  ))
                : <span style={{ opacity: 0.5 }}>// nessuno storico</span>
              }
            </div>
          )}
        </>
      )}

      {/* ── Trova Terminale ─────────────────────────────── */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={handleFindTerminal}
          disabled={loadingTerminal}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 5,
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
            color: 'var(--text-secondary)', cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          {loadingTerminal ? <span className="spin" /> : '⬡'}
          {loadingTerminal ? 'ricerca...' : 'trova finestra'}
        </button>

        {terminalWindows !== null && (
          <div style={{ marginTop: 7 }}>
            {terminalWindows.length === 0 ? (
              <p style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
                color: 'var(--text-muted)', margin: 0
              }}>
                // nessuna finestra terminale trovata
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {terminalWindows.map((w, i) => (
                  <div key={i} style={{
                    padding: '5px 8px',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-dim)',
                    borderRadius: 5,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem'
                  }}>
                    <span style={{ color: 'var(--blue)', marginRight: 6 }}>PID {w.pid}</span>
                    <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}>{w.name}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{w.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mark Checked ────────────────────────────────── */}
      {statusKey === 'check' && (
        <div style={{ marginTop: 12 }}>
          <button onClick={handleMarkAsChecked} disabled={isMarking} className="btn-check">
            {isMarking
              ? <><span className="spin" /> SEGNO...</>
              : <><span>✓</span> SEGNA COME CONTROLLATO</>
            }
          </button>
        </div>
      )}

      {/* ── No Data ─────────────────────────────────────── */}
      {!status && (
        <div style={{
          marginTop: 10, padding: '9px 11px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed var(--border-dim)', borderRadius: 6,
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
          color: 'var(--text-muted)'
        }}>
          // attesa dati...
        </div>
      )}

    </div>
  );
}
