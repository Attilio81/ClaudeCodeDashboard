import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import ProjectCard from './components/ProjectCard';
import AdminPanel from './components/AdminPanel';

const CONN = {
  connecting:   { dot: 'dot dot-check', label: 'SYNC...',  color: 'var(--amber)' },
  connected:    { dot: 'dot dot-active', label: 'LIVE',    color: 'var(--green)' },
  disconnected: { dot: 'dot dot-idle',  label: 'OFFLINE',  color: 'var(--slate)' },
  error:        { dot: 'dot dot-error', label: 'FAULT',    color: 'var(--red)'   },
};

function ColHeader({ dotClass, label, count, color, dimColor, borderColor, onToggle, isOpen }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', marginBottom: 14,
        background: dimColor, border: `1px solid ${borderColor}`, borderRadius: 8,
        cursor: onToggle ? 'pointer' : 'default',
        userSelect: 'none'
      }}
    >
      <span className={dotClass} />
      <span style={{
        fontFamily: 'Syne, sans-serif', fontSize: '0.68rem',
        fontWeight: 700, letterSpacing: '0.13em',
        textTransform: 'uppercase', color
      }}>
        {label}
      </span>
      <span style={{
        marginLeft: 'auto',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
        fontWeight: 700, color, opacity: 0.75
      }}>
        {count}
      </span>
      {onToggle && (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
          color, opacity: 0.5, marginLeft: 6,
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'
        }}>
          ▼
        </span>
      )}
    </div>
  );
}

function EmptySlot({ text }) {
  return (
    <div style={{
      padding: '20px', textAlign: 'center',
      color: 'var(--text-muted)', fontSize: '0.68rem',
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
      background: 'rgba(255,255,255,0.01)',
      border: '1px dashed var(--border-dim)', borderRadius: 8
    }}>
      {text}
    </div>
  );
}

function App() {
  const { projects, projectStatuses, connectionStatus } = useWebSocket();
  const conn = CONN[connectionStatus] || CONN.disconnected;
  const [showAdmin, setShowAdmin] = useState(false);
  const [showIdle, setShowIdle] = useState(false);

  const active  = projects.filter(p => projectStatuses[p.name]?.status === 'active');
  const check   = projects.filter(p => projectStatuses[p.name]?.status === 'check');
  const idle    = projects.filter(p => {
    const s = projectStatuses[p.name]?.status;
    return s === 'idle' || s === 'error' || !s;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-void)' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(180deg, #0d0f18 0%, #0a0c14 100%)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <div style={{
          maxWidth: 1440, margin: '0 auto',
          padding: '14px 32px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 24
        }}>
          {/* Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
              <h1 style={{
                fontFamily: 'Syne, sans-serif', fontSize: '1.45rem',
                fontWeight: 800, color: 'var(--text-bright)',
                letterSpacing: '-0.01em', margin: 0, lineHeight: 1
              }}>
                CLAUDE CODE
              </h1>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
                color: 'var(--text-muted)', letterSpacing: '0.12em',
                padding: '2px 7px',
                border: '1px solid var(--border-dim)',
                borderRadius: 4, background: 'rgba(255,255,255,0.02)'
              }}>
                DASHBOARD
              </span>
            </div>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
              color: 'var(--text-muted)', letterSpacing: '0.09em', margin: 0
            }}>
              MONITORAGGIO SESSIONI IN TEMPO REALE
            </p>
          </div>

          {/* Right: stats + connection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Stat chips */}
            {[
              { label: 'TOTALE', value: projects.length, color: 'var(--text-secondary)' },
              { label: 'ATTIVI', value: active.length,  color: 'var(--green)', show: true },
              ...(check.length > 0 ? [{ label: 'CHECK', value: check.length, color: 'var(--amber)' }] : []),
            ].map(chip => (
              <div key={chip.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-dim)',
                borderRadius: 6,
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
                color: 'var(--text-muted)', letterSpacing: '0.06em'
              }}>
                {chip.label}
                <span style={{ color: chip.color, fontWeight: 700, fontSize: '0.8rem' }}>
                  {chip.value}
                </span>
              </div>
            ))}

            {/* Admin button */}
            <button
              onClick={() => setShowAdmin(true)}
              title="Configurazione percorsi"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8, cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
                color: 'var(--text-secondary)',
                transition: 'border-color 0.15s, color 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              ⚙ ADMIN
            </button>

            {/* Connection pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 20,
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
              fontWeight: 600, letterSpacing: '0.12em',
              color: conn.color
            }}>
              <span className={conn.dot} />
              {conn.label}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────── */}
      <main style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 32px 72px' }}>

        {/* Loading */}
        {connectionStatus === 'connecting' && projects.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '80px 0', gap: 16
          }}>
            <div style={{
              width: 30, height: 30,
              border: '2px solid var(--border-mid)',
              borderTopColor: 'var(--amber)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem',
              color: 'var(--text-secondary)', letterSpacing: '0.1em', margin: 0
            }}>
              CONNESSIONE AL SERVER...
            </p>
          </div>
        )}

        {/* Error banner */}
        {connectionStatus === 'error' && (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid var(--red-border)',
            borderRadius: 10, padding: '16px 20px', marginBottom: 24
          }}>
            <p style={{ color: 'var(--red)', fontWeight: 700, fontSize: '0.78rem', margin: '0 0 4px' }}>
              ERRORE DI CONNESSIONE
            </p>
            <p style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
              color: 'var(--text-secondary)', margin: 0
            }}>
              Impossibile connettersi al server WebSocket. Verificare che il backend sia attivo sulla porta 3001.
            </p>
          </div>
        )}

        {/* Grid: 2 or 3 columns depending on idle visibility */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: showIdle ? 'repeat(3, 1fr)' : '1fr 1fr auto',
          gap: 24,
          alignItems: 'start'
        }}>
          {/* ACTIVE */}
          <div>
            <ColHeader
              dotClass="dot dot-active"
              label="Attivi"
              count={active.length}
              color="var(--green)"
              dimColor="var(--green-dim)"
              borderColor="var(--green-border)"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {active.map(p => (
                <ProjectCard key={p.name} project={p} status={projectStatuses[p.name]} />
              ))}
              {active.length === 0 && <EmptySlot text="// nessuno attivo" />}
            </div>
          </div>

          {/* CHECK */}
          <div>
            <ColHeader
              dotClass="dot dot-check"
              label="Da Controllare"
              count={check.length}
              color="var(--amber)"
              dimColor="var(--amber-dim)"
              borderColor="var(--amber-border)"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {check.map(p => (
                <ProjectCard key={p.name} project={p} status={projectStatuses[p.name]} />
              ))}
              {check.length === 0 && <EmptySlot text="// nessuno da controllare" />}
            </div>
          </div>

          {/* IDLE — full column or collapsed tab */}
          {showIdle ? (
            <div>
              <ColHeader
                dotClass="dot dot-idle"
                label="Inattivi"
                count={idle.length}
                color="var(--slate)"
                dimColor="var(--slate-dim)"
                borderColor="var(--slate-border)"
                onToggle={() => setShowIdle(false)}
                isOpen={true}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {idle.map(p => (
                  <ProjectCard key={p.name} project={p} status={projectStatuses[p.name]} />
                ))}
                {idle.length === 0 && <EmptySlot text="// tutti attivi ✦" />}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowIdle(true)}
              title="Mostra colonna Inattivi"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 10,
                width: 32, alignSelf: 'stretch', minHeight: 60,
                background: 'var(--slate-dim)',
                border: '1px solid var(--slate-border)',
                borderRadius: 8, cursor: 'pointer',
                padding: '12px 0',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.15)'; e.currentTarget.style.borderColor = 'rgba(100,116,139,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--slate-dim)'; e.currentTarget.style.borderColor = 'var(--slate-border)'; }}
            >
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem',
                color: 'var(--slate)', letterSpacing: '0.12em',
                writingMode: 'vertical-rl', textOrientation: 'mixed',
                transform: 'rotate(180deg)', whiteSpace: 'nowrap'
              }}>
                INATTIVI
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem',
                fontWeight: 700, color: 'var(--slate)', opacity: 0.7
              }}>
                {idle.length}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--slate)', opacity: 0.5 }}>▶</span>
            </button>
          )}
        </div>
      </main>

      {/* ── Admin Panel ────────────────────────────────────── */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border-dim)',
        padding: '14px 32px', textAlign: 'center'
      }}>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
          color: 'var(--text-muted)', letterSpacing: '0.08em', margin: 0
        }}>
          CLAUDE CODE DASHBOARD v3.0.0 — REACT + WEBSOCKET
        </p>
      </footer>

    </div>
  );
}

export default App;
