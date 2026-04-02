<div align="center">

# 🚀 Dashboard Claude Code

**Real-time monitoring dashboard for multiple Claude Code sessions**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org/)
[![Status](https://img.shields.io/badge/status-active-success)](https://github.com)

*Monitora in tempo reale N sessioni Claude Code parallele su progetti diversi — zero configurazione manuale*

[Quick Start](#-quick-start) • [Features](#-features) • [Admin Panel](#-admin-panel) • [API](#-api-reference) • [Troubleshooting](#-troubleshooting)

</div>

---

## ✨ Features

### 🎯 Core
| Feature | Descrizione |
|---------|-------------|
| **🗂️ Scan Roots** | Configura cartelle radice (`C:\BIZ2017`, `C:\Progetti Pilota`, ecc.) — tutte le sottocartelle con sessioni Claude vengono monitorate automaticamente |
| **⚡ Real-Time Monitoring** | Aggiornamenti istantanei via WebSocket |
| **🔄 Dynamic Discovery** | Nuovi progetti rilevati senza riavvio (watcher `depth: 2`) |
| **🧠 Smart Status** | Distingue Active / Check / Idle / Error in base al tipo di entry e ai timeout |
| **🔌 Auto-Reconnect** | Riconnessione WebSocket automatica ogni 3 secondi |

### 🎨 UI — Terminal Noir
- Dark theme completo con palette CSS variabili
- Tipografia: **Syne** (UI) + **JetBrains Mono** (dati/codice)
- Neon glow animato sugli indicatori di stato
- Layout a 3 colonne: Attivi / Da Controllare / Inattivi

### 🛠️ Gestione Progetti
| Azione | Come |
|--------|------|
| **⊗ Escludi percorso** | Bottone su ogni card → rimozione immediata + salvataggio in `excluded-paths.json` |
| **📟 Apri CMD** | Apre cmd.exe nella directory del progetto |
| **⬡ Trova finestra** | PowerShell scansiona processi e titoli finestre per localizzare il terminale con la sessione attiva |
| **✓ Segna controllato** | Marca un progetto "Check" come rivisto → torna a Idle |

### ⚙️ Area Admin
- Pannello laterale accessibile con **⚙ ADMIN** nell'header
- Aggiungi / rimuovi cartelle radice di scansione
- **Riscansiona Ora** — trova nuovi progetti senza riavviare il server
- Visualizza e ripristina percorsi esclusi

---

## 🔬 Come Funziona

### Discovery: Scan Roots (v4.0.0+)

La dashboard non scansiona più `~/.claude/projects/` alla cieca. Invece:

1. Legge `backend/scan-paths.json` → lista cartelle radice configurate
2. Per ogni radice, elenca le **sottocartelle dirette**
3. Per ogni sottocartella controlla se esiste `~/.claude/projects/[path-codificato]/` con file `.jsonl`
4. Include solo quelle con sessioni reali

```
C:\BIZ2017\           ← cartella radice
├── BNEGS076\         ← ha ~/.claude/projects/C--BIZ2017-BNEGS076/*.jsonl → MONITORATA
├── BIZ2017\          ← ha sessioni → MONITORATA  
└── Archivio\         ← nessuna sessione → IGNORATA
```

### Codifica del percorso

Claude Code codifica i path come nome directory:
```
C:\BIZ2017\BNEGS076  →  C--BIZ2017-BNEGS076
```

La dashboard fa la conversione in entrambe le direzioni.

### Stato intelligente

| Stato | Colore | Trigger |
|-------|--------|---------|
| **Active** | 🟢 neon | Tool in esecuzione **o** < 5 min dall'ultimo tool result |
| **Check** | 🟠 amber | Completato da < 60 min — da rivedere |
| **Idle** | ⚪ grigio | > 60 min di inattività **o** segnato manualmente |
| **Error** | 🔴 | Impossibile leggere la sessione |

### Rilevamento finestra terminale

Endpoint `GET /api/projects/:name/terminal-windows`:

1. Cerca processi con il **nome del progetto nel titolo** della finestra
2. Trova processi `node.exe` con `@anthropic-ai/claude-code` nel command line (esclude MCP server, plugin, dashboard)
3. **Risale al terminale padre** (node → cmd/pwsh → Windows Terminal, fino a 2 livelli)
4. Restituisce PID + nome processo + titolo finestra

Usa `-EncodedCommand` base64 per evitare problemi di escaping PowerShell.

---

## 🛠️ Stack Tecnologico

| Layer | Tecnologie |
|-------|-----------|
| **Backend** | Node.js ≥ 18, Express, ws, chokidar |
| **Frontend** | React 18.2, Vite 5, Tailwind CSS 3 |
| **Fonts** | Syne (Google Fonts), JetBrains Mono |
| **Platform** | Windows (PowerShell per terminal detection) |

---

## 📁 Struttura Progetto

```
DashboardClaudeCode/
├── backend/
│   ├── server.js              # Express + WebSocket + API REST
│   ├── claude-watcher.js      # Monitora sessioni reali Claude Code
│   ├── path-scanner.js        # Discovery da cartelle radice ← NEW v4
│   ├── auto-discovery.js      # Discovery fallback da ~/.claude/projects/
│   ├── watcher.js             # Fallback: legacy status.json
│   ├── scan-paths.json        # Cartelle radice da scansionare ← NEW v4
│   ├── excluded-paths.json    # Percorsi esclusi dal monitoring ← NEW v4
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Layout + 3 colonne + Admin toggle
│   │   ├── components/
│   │   │   ├── ProjectCard.jsx        # Card progetto con azioni
│   │   │   └── AdminPanel.jsx         # Pannello Admin ← NEW v4
│   │   ├── hooks/
│   │   │   └── useWebSocket.js        # Hook WebSocket + reconnect
│   │   └── index.css                  # CSS variables + animazioni
│   ├── index.html
│   └── package.json
├── start.bat                  # Avvio rapido Windows ← NEW v4
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### Prerequisiti

```
Node.js >= 18
npm >= 9
Claude Code con sessioni attive
```

### Installazione

```bash
# 1. Clona il repository
git clone https://github.com/Attilio81/ClaudeCodeDashboard.git
cd ClaudeCodeDashboard

# 2. Installa dipendenze
npm install
cd backend && npm install
cd ../frontend && npm install && cd ..

# 3. Configura le cartelle radice (vedi sezione Admin)
# oppure modifica direttamente backend/scan-paths.json

# 4. Avvia
npm run dev
# oppure su Windows: doppio click su start.bat
```

Apri `http://localhost:5173`

---

## ⚙️ Configurazione

### Cartelle radice (`backend/scan-paths.json`)

Modifica il file per specificare dove cercare i tuoi progetti:

```json
[
  "C:\\BIZ2017",
  "C:\\Progetti Pilota",
  "C:\\ProgettiEgm",
  "C:\\Users\\nome.utente\\Documents\\GitHub"
]
```

Oppure usa l'**Area Admin** nell'UI per aggiungere/rimuovere percorsi senza toccare file.

### Percorsi esclusi (`backend/excluded-paths.json`)

Popolato automaticamente quando clicchi **⊗** su una card. Per ripristinare un percorso usa il pannello Admin → sezione "Percorsi esclusi".

```json
[
  "C:\\BIZ2017\\ProgettoArchiviato"
]
```

### Fallback: `backend/config.json`

Se `scan-paths.json` è vuoto, il server usa `config.json` con lista manuale:

```json
{
  "projects": [
    { "name": "MioProgetto", "path": "C:\\Progetti\\MioProgetto" }
  ]
}
```

---

## 🔌 API Reference

### Progetti

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/health` | Stato server |
| `GET` | `/api/projects` | Lista progetti monitorati |
| `POST` | `/api/projects/:name/mark-checked` | Segna come controllato |
| `POST` | `/api/projects/:name/exclude` | Escludi dal monitoring |
| `POST` | `/api/projects/:name/open-terminal` | Apri CMD nella directory |
| `GET` | `/api/projects/:name/terminal-windows` | Trova finestre terminale |

### Admin

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/admin/scan-paths` | Lista cartelle radice |
| `POST` | `/api/admin/scan-paths` | Aggiungi cartella radice (`{ "path": "C:\\..." }`) |
| `DELETE` | `/api/admin/scan-paths/:index` | Rimuovi cartella radice |
| `POST` | `/api/admin/rescan` | Riscansiona senza riavvio |
| `GET` | `/api/admin/excluded-paths` | Lista percorsi esclusi |
| `DELETE` | `/api/admin/excluded-paths/:index` | Ripristina percorso escluso |

### WebSocket (`ws://localhost:3001`)

**Config** (inviato alla connessione e ad ogni aggiornamento lista):
```json
{
  "type": "config",
  "projects": [{ "name": "BNEGS076", "path": "C:\\BIZ2017\\BNEGS076" }]
}
```

**Status update** (inviato ad ogni cambio sessione):
```json
{
  "type": "status",
  "data": {
    "status": "active",
    "projectName": "BNEGS076",
    "lastUpdate": "2026-04-02T10:00:00Z",
    "lastOutput": "Bash: npm test",
    "slug": "sharded-wibbling-crab",
    "gitBranch": "main",
    "sessionId": "abc-123",
    "outputHistory": [{ "timestamp": "...", "output": "...", "toolName": "Bash" }]
  }
}
```

---

## 🔧 Troubleshooting

<details>
<summary><b>Progetto non rilevato al primo avvio</b></summary>

Verifica che esista una directory sessione in `~/.claude/projects/`:

```powershell
ls "$env:USERPROFILE\.claude\projects\" | Where-Object Name -like "*NOMEPROGETTO*"
```

Se esiste ma non appare, controlla che il percorso del progetto sia in `scan-paths.json` e fai **Riscansiona** dal pannello Admin.

</details>

<details>
<summary><b>Nuovo progetto non rilevato in tempo reale</b></summary>

Il watcher dinamico usa `depth: 2` per rilevare nuovi file `.jsonl`. Se il server era avviato con una versione precedente (`depth: 1`), riavvialo. Dopo il riavvio i nuovi progetti vengono rilevati automaticamente.

</details>

<details>
<summary><b>"Trova finestra" non trova nulla</b></summary>

La funzione cerca:
1. Finestre con il nome del progetto nel **titolo** — funziona se il terminale mostra la directory corrente nel titolo (comportamento default di cmd, PowerShell, Windows Terminal)
2. Processi `node.exe` con `@anthropic-ai/claude-code` nel command line

Se non trova nulla è possibile che:
- Il titolo della finestra non rispecchi il nome del progetto
- La sessione Claude Code non sia attiva in questo momento

</details>

<details>
<summary><b>WebSocket si disconnette continuamente</b></summary>

Il frontend riconnette ogni 3 secondi automaticamente. Se il problema persiste:
- Verifica che il backend sia in esecuzione su porta 3001
- Controlla che non ci siano firewall locali che bloccano `localhost:3001`

</details>

---

## 📊 Changelog

### v4.0.0 (2026-04-02) — Scan Roots + Terminal Noir UI
- 🆕 **Scan Roots**: discovery da cartelle radice configurabili invece di `~/.claude/projects/`
- 🆕 **Area Admin**: pannello UI per gestire percorsi di scansione e percorsi esclusi
- 🆕 **Escludi percorso**: bottone ⊗ su ogni card + persistenza in `excluded-paths.json`
- 🆕 **Trova finestra terminale**: PowerShell risale al terminale padre del processo Claude
- 🆕 **start.bat**: avvio rapido su Windows
- 🎨 **Terminal Noir UI**: redesign completo — dark theme, Syne + JetBrains Mono, neon glow
- 🐛 **Fix**: `depth: 2` nel watcher dinamico — nuovi progetti rilevati in tempo reale
- 🐛 **Fix**: deduplicazione per nome progetto (non solo per path)
- 🐛 **Fix**: testo visibile su sfondo scuro (variabili CSS corrette)

### v3.0.0 (2026-01-22) — Dynamic Discovery
- 🆕 Auto-discovery dinamico — nuovi progetti aggiunti senza riavvio
- ⚡ Timeout intelligenti (5 min tool, 60 min idle)
- 📊 Storico sessione (ultimi 20 eventi)
- 🌿 Visualizzazione branch Git
- ✓ Marcatura manuale "controllato"

### v2.0.0 (2026-01-15) — Real Sessions
- Parsing file `.jsonl` in tempo reale
- Auto-detection sessioni Claude Code

### v1.0.0 (2026-01-01) — Initial Release
- Monitoraggio via `status.json`
- UI Tailwind CSS + WebSocket

---

<div align="center">

**[Report Bug](https://github.com/Attilio81/ClaudeCodeDashboard/issues)** • **[Request Feature](https://github.com/Attilio81/ClaudeCodeDashboard/issues)**

Made with ❤️ by developers, for developers

</div>
