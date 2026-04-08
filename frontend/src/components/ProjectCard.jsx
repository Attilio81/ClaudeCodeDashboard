import React, { useState } from 'react';
import { API_BASE } from '../config.js';

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

function WindowRow({ window: w }) {
  const [focusing, setFocusing] = useState(false);
  const [focusResult, setFocusResult] = useState(null);

  const handleFocus = async () => {
    setFocusing(true);
    setFocusResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/focus-window/${w.pid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: w.title, tabIndex: w.tabIndex ?? -1 })
      });
      setFocusResult(res.ok ? 'ok' : 'err');
    } catch {
      setFocusResult('err');
    } finally {
      setFocusing(false);
      setTimeout(() => setFocusResult(null), 2000);
    }
  };

  return (
    <div style={{
      padding: '5px 8px',
      background: 'var(--bg-inset)',
      border: '1px solid var(--border-dim)',
      borderRadius: 5,
      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
      display: 'flex', alignItems: 'center', gap: 6
    }}>
      <span style={{
        flexShrink: 0, fontSize: '0.58rem', padding: '1px 4px', borderRadius: 3,
        background: w.match === 'dashboard' ? 'rgba(179,136,255,0.12)' : w.match === 'tab' ? 'rgba(0,230,118,0.12)' : w.match === 'progetto' ? 'rgba(100,181,246,0.12)' : 'rgba(255,255,255,0.05)',
        color: w.match === 'dashboard' ? '#b388ff' : w.match === 'tab' ? 'var(--green)' : w.match === 'progetto' ? 'var(--blue)' : 'var(--text-muted)',
        border: `1px solid ${w.match === 'dashboard' ? 'rgba(179,136,255,0.3)' : w.match === 'tab' ? 'var(--green-border)' : w.match === 'progetto' ? 'rgba(100,181,246,0.3)' : 'var(--border-dim)'}`,
      }}>{w.match === 'dashboard' ? 'dashboard' : w.match === 'tab' ? 'match' : w.match === 'progetto' ? 'progetto' : 'fallback'}</span>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{w.name}</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</span>
      <button
        onClick={handleFocus}
        disabled={focusing}
        title="Porta in primo piano"
        style={{
          flexShrink: 0,
          background: focusResult === 'ok' ? 'rgba(0,230,118,0.1)' : focusResult === 'err' ? 'rgba(255,61,113,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${focusResult === 'ok' ? 'var(--green-border)' : focusResult === 'err' ? 'var(--red-border)' : 'var(--border-dim)'}`,
          borderRadius: 4, cursor: 'pointer',
          color: focusResult === 'ok' ? 'var(--green)' : focusResult === 'err' ? 'var(--red)' : 'var(--text-secondary)',
          fontSize: '0.7rem', padding: '2px 6px', lineHeight: 1.4,
          transition: 'all 0.15s'
        }}
        onMouseEnter={e => { if (!focusResult) { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-primary)'; }}}
        onMouseLeave={e => { if (!focusResult) { e.currentTarget.style.borderColor = 'var(--border-dim)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}}
      >
        {focusing ? <span className="spin" style={{ width: 8, height: 8 }} /> : focusResult === 'ok' ? '✓' : focusResult === 'err' ? '✗' : '⬆'}
      </button>
    </div>
  );
}

export default function ProjectCard({ project, status }) {
  const [showHistory, setShowHistory] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [markError, setMarkError] = useState(null);
  const [isOpeningTerminal, setIsOpeningTerminal] = useState(false);
  const [terminalError, setTerminalError] = useState(null);
  const [isExcluding, setIsExcluding] = useState(false);
  const [confirmExclude, setConfirmExclude] = useState(false);
  const [terminalWindows, setTerminalWindows] = useState(null);
  const [loadingTerminal, setLoadingTerminal] = useState(false);

  const statusKey = status?.status || 'idle';
  const s = STATUS_STYLE[statusKey] || STATUS_STYLE.idle;

  const handleMarkAsChecked = async () => {
    if (isMarking) return;
    setIsMarking(true);
    setMarkError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${encodeURIComponent(project.name)}/mark-checked`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Errore');
    } catch {
      setMarkError('Errore');
      setTimeout(() => setMarkError(null), 3000);
    } finally {
      setIsMarking(false);
    }
  };

  const handleExclude = async () => {
    if (isExcluding) return;
    if (!confirmExclude) {
      setConfirmExclude(true);
      setTimeout(() => setConfirmExclude(false), 4000);
      return;
    }
    setConfirmExclude(false);
    setIsExcluding(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${encodeURIComponent(project.name)}/exclude`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error('Errore');
    } catch {
      setIsExcluding(false);
    }
  };

  const handleFindTerminal = async () => {
    setLoadingTerminal(true);
    setTerminalWindows(null);
    try {
      const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(project.name)}/terminal-windows`);
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
    setTerminalError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/projects/${encodeURIComponent(project.name)}/open-terminal`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore');
      }
    } catch (e) {
      setTerminalError(e.message);
      setTimeout(() => setTerminalError(null), 3000);
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
            title={confirmExclude ? 'Clicca di nuovo per confermare' : 'Escludi questo percorso dal monitoraggio'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px',
              background: confirmExclude ? 'rgba(255,61,113,0.2)' : 'rgba(255,61,113,0.07)',
              border: `1px solid ${confirmExclude ? 'rgba(255,61,113,0.6)' : 'rgba(255,61,113,0.25)'}`,
              color: confirmExclude ? 'var(--red)' : 'rgba(255,61,113,0.6)',
              borderRadius: 5,
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!confirmExclude) { e.currentTarget.style.background = 'rgba(255,61,113,0.14)'; e.currentTarget.style.color = 'var(--red)'; }}}
            onMouseLeave={e => { if (!confirmExclude) { e.currentTarget.style.background = 'rgba(255,61,113,0.07)'; e.currentTarget.style.color = 'rgba(255,61,113,0.6)'; }}}
          >
            {isExcluding ? <span className="spin" /> : confirmExclude ? '⊗ sicuro?' : '⊗'}
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

      {/* ── Errore terminale inline ─────────────────────── */}
      {terminalError && (
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
          color: 'var(--red)', marginTop: 4, marginBottom: -4
        }}>
          ✗ {terminalError}
        </div>
      )}

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
                  <WindowRow key={i} window={w} />
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
          {markError && (
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
              color: 'var(--red)', marginLeft: 8
            }}>✗ {markError}</span>
          )}
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
