<div align="center">

# Dashboard Claude Code

**Monitoraggio in tempo reale di sessioni Claude Code parallele**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org/)
[![Status](https://img.shields.io/badge/status-active-success)](https://github.com)

*Monitora N sessioni Claude Code parallele su progetti diversi — zero configurazione manuale*

[Avvio Rapido](#-avvio-rapido) • [Funzionalità](#-funzionalità) • [Come Funziona](#-come-funziona) • [API](#-api-reference) • [Troubleshooting](#-troubleshooting)

</div>

---

## Funzionalità

### Core
| Funzionalità | Descrizione |
|--------------|-------------|
| **Scan Roots** | Configura cartelle radice (`C:\BIZ2017`, `C:\Progetti Pilota`, ecc.) — tutte le sottocartelle con sessioni Claude vengono monitorate automaticamente, fino a 2 livelli di profondità |
| **Aggiornamenti in tempo reale** | Notifiche istantanee via WebSocket |
| **Discovery dinamico** | Nuovi progetti rilevati automaticamente senza riavvio del server |
| **Stato intelligente** | Distingue Attivo / Da Controllare / Inattivo / Errore in base al tipo di entry e ai timeout |
| **Riconnessione automatica** | Il client WebSocket si riconnette ogni 3 secondi |

### UI — Terminal Noir
- Dark theme completo con palette CSS tramite variabili
- Tipografia: **Syne** (interfaccia) + **JetBrains Mono** (dati/codice)
- Indicatori di stato con neon glow animato
- Layout a 3 colonne: **Attivi** / **Da Controllare** / **Inattivi** (colonna Inattivi collassabile)

### Gestione Progetti
| Azione | Descrizione |
|--------|-------------|
| **Escludi percorso** | Bottone ⊗ su ogni card — rimozione immediata + salvataggio in `excluded-paths.json` |
| **Apri CMD** | Apre cmd.exe nella directory del progetto |
| **Trova finestra** | Individua la sessione Claude nel terminale leggendo `~/.claude/sessions/` — elenca ogni tab di Windows Terminal via UIAutomation |
| **Porta in primo piano** | Bottone ⬆ su ogni risultato — porta Windows Terminal in primo piano e seleziona la tab corretta |
| **Segna controllato** | Marca un progetto "Da Controllare" come rivisto → torna a Inattivo |

### Area Admin
- Pannello laterale accessibile con **⚙ ADMIN** nell'header
- Aggiungi / rimuovi cartelle radice di scansione
- **Riscansiona Ora** — trova nuovi progetti senza riavviare il server
- Visualizza e ripristina percorsi esclusi

---

## Come Funziona

### Discovery: Scan Roots

La dashboard non scansiona `~/.claude/projects/` alla cieca. Il flusso è:

1. Legge `backend/scan-paths.json` — lista cartelle radice configurate
2. Per ogni radice, scansiona le sottocartelle ricorsivamente (profondità massima 2)
3. Per ogni sottocartella controlla se esiste `~/.claude/projects/[path-codificato]/` con file `.jsonl`
4. Include solo le cartelle con sessioni reali

```
C:\Progetti Pilota\           ← cartella radice
├── DashboardClaudeCode\      ← ha sessioni Claude → MONITORATA
├── gestione-preattività\     
│   └── consultation-panel\  ← ha sessioni Claude (2 livelli) → MONITORATA
└── Archivio\                 ← nessuna sessione → IGNORATA
```

### Codifica del percorso

Claude Code converte i path in nomi di directory:
```
C:\Progetti Pilota\MioProgetto  →  C--Progetti-Pilota-MioProgetto
```

I caratteri non-ASCII vengono codificati come uno o più `-` in base ai byte UTF-8 (es. `à` = 2 byte → `--`). La dashboard gestisce correttamente questa codifica.

### Rilevamento finestra terminale

Il flusso di `Trova finestra`:

1. Legge i file `~/.claude/sessions/*.json` — contengono `{ pid, cwd, sessionId, startedAt }`
2. Trova la sessione con `cwd` uguale al percorso del progetto
3. Risale la catena dei processi padre fino a trovare Windows Terminal (max 6 livelli)
4. Usa **UIAutomation** (`System.Windows.Automation`) per enumerare le singole tab di Windows Terminal
5. Restituisce ogni tab come riga separata con titolo e indice

Il bottone ⬆ su ogni riga porta Windows Terminal in primo piano (con il trucco del tasto ALT per bypassare la restrizione di `SetForegroundWindow`) e poi seleziona la tab tramite `SelectionItemPattern`.

Gli script PowerShell vengono scritti su file temporaneo in `%TEMP%` invece di essere passati come `-EncodedCommand`, evitando il limite di 8191 caratteri della riga di comando Windows.

### Stato intelligente

| Stato | Colore | Condizione |
|-------|--------|------------|
| **Attivo** | Verde | Tool in esecuzione **o** meno di 5 minuti dall'ultimo tool result |
| **Da Controllare** | Arancione | Completato da meno di 60 minuti |
| **Inattivo** | Grigio | Più di 60 minuti di inattività **o** segnato manualmente |
| **Errore** | Rosso | Impossibile leggere la sessione |

---

## Stack Tecnologico

| Layer | Tecnologie |
|-------|-----------|
| **Backend** | Node.js >= 18, Express, ws, chokidar |
| **Frontend** | React 18.2, Vite 5 |
| **Font** | Syne (Google Fonts), JetBrains Mono |
| **Piattaforma** | Windows — PowerShell + UIAutomation per il rilevamento terminale |

---

## Struttura Progetto

```
DashboardClaudeCode/
├── backend/
│   ├── server.js              # Express + WebSocket + API REST
│   ├── claude-watcher.js      # Monitora le sessioni reali Claude Code
│   ├── path-scanner.js        # Discovery da cartelle radice
│   ├── scan-paths.json        # Cartelle radice da scansionare
│   ├── excluded-paths.json    # Percorsi esclusi dal monitoraggio
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Layout + 3 colonne + Admin toggle
│   │   ├── components/
│   │   │   ├── ProjectCard.jsx        # Card progetto con azioni
│   │   │   └── AdminPanel.jsx         # Pannello Admin
│   │   ├── hooks/
│   │   │   └── useWebSocket.js        # Hook WebSocket + riconnessione
│   │   └── index.css                  # Variabili CSS + animazioni
│   ├── index.html
│   └── package.json
├── start.bat                  # Avvio rapido Windows
├── package.json
└── README.md
```

---

## Avvio Rapido

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

# 2. Installa le dipendenze
npm install
cd backend && npm install
cd ../frontend && npm install && cd ..

# 3. Configura le cartelle radice (vedi sezione Admin o modifica direttamente)
# backend/scan-paths.json

# 4. Avvia
npm run dev
# oppure su Windows: doppio click su start.bat
```

Apri `http://localhost:5173`

---

## Configurazione

### Cartelle radice (`backend/scan-paths.json`)

```json
[
  "C:\\BIZ2017",
  "C:\\Progetti Pilota",
  "C:\\ProgettiEgm"
]
```

Puoi anche usare l'**Area Admin** nell'interfaccia per aggiungere o rimuovere percorsi senza toccare file.

### Percorsi esclusi (`backend/excluded-paths.json`)

Popolato automaticamente quando clicchi **⊗** su una card. Per ripristinare un percorso usa il pannello Admin → sezione "Percorsi esclusi".

```json
[
  "C:\\Progetti Pilota\\ProgettoDaIgnorare"
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

## API Reference

### Progetti

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/health` | Stato server |
| `GET` | `/api/projects` | Lista progetti monitorati |
| `POST` | `/api/projects/:name/mark-checked` | Segna come controllato |
| `POST` | `/api/projects/:name/exclude` | Escludi dal monitoraggio |
| `POST` | `/api/projects/:name/open-terminal` | Apri CMD nella directory |
| `GET` | `/api/projects/:name/terminal-windows` | Trova le tab del terminale |
| `POST` | `/api/focus-window/:pid` | Porta finestra in primo piano e seleziona tab |

### Admin

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/admin/scan-paths` | Lista cartelle radice |
| `POST` | `/api/admin/scan-paths` | Aggiungi cartella (`{ "path": "C:\\..." }`) |
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

## Troubleshooting

<details>
<summary><b>Progetto non rilevato</b></summary>

Verifica che esista una directory sessione in `~/.claude/projects/`:

```powershell
ls "$env:USERPROFILE\.claude\projects\" | Where-Object Name -like "*NOMEPROGETTO*"
```

Se esiste ma non appare, controlla che il percorso sia in `scan-paths.json` e fai **Riscansiona** dal pannello Admin. Se il progetto è in una sottocartella con caratteri non-ASCII nel percorso (es. `gestione-preattività`), la codifica viene gestita automaticamente.

</details>

<details>
<summary><b>Nuovo progetto non compare in automatico</b></summary>

Il watcher dinamico rileva nuovi file `.jsonl` in tempo reale. Se il progetto non compare, fai **Riscansiona** dal pannello Admin oppure riavvia il server. Dopo il riavvio i nuovi progetti vengono rilevati automaticamente senza F5.

</details>

<details>
<summary><b>"Trova finestra" non trova nulla</b></summary>

La funzione richiede che:
1. Claude Code sia attivo nel progetto (deve esistere un file in `~/.claude/sessions/` con `cwd` corrispondente)
2. Il processo sia figlio di Windows Terminal o cmd

Se la sessione è attiva ma non viene trovata, verifica che i file in `~/.claude/sessions/*.json` contengano `cwd` uguale al percorso del progetto.

</details>

<details>
<summary><b>Il bottone ⬆ non porta la finestra in primo piano</b></summary>

Windows blocca `SetForegroundWindow` dai processi in background. La dashboard usa un workaround con la simulazione del tasto ALT (`keybd_event`) per ottenere il permesso. Se non funziona, prova a cliccare prima sulla dashboard e poi su ⬆.

</details>

<details>
<summary><b>WebSocket si disconnette continuamente</b></summary>

Il client si riconnette ogni 3 secondi automaticamente. Se il problema persiste:
- Verifica che il backend sia in esecuzione sulla porta 3001
- Controlla che non ci siano firewall locali che bloccano `localhost:3001`

</details>

---

## Changelog

### v4.1.0 (2026-04-02) — UIAutomation Tab Detection + Bugfix
- **Trova finestra**: rilevamento sessioni da `~/.claude/sessions/*.json` invece di scansione processi
- **Trova finestra**: elenca ogni singola tab di Windows Terminal via UIAutomation
- **Porta in primo piano**: selezione della tab specifica tramite `SelectionItemPattern`
- **Porta in primo piano**: workaround ALT-key per bypassare restrizione `SetForegroundWindow`
- **Fix**: script PowerShell scritti su file temporaneo (evita limite 8191 char della riga di comando)
- **Fix**: codifica percorsi non-ASCII (`à` = 2 byte UTF-8 → `--`) in `path-scanner.js`, `claude-watcher.js`, `server.js`
- **Fix**: scansione ricorsiva a profondità 2 per rilevare progetti in sottocartelle (es. `gestione-preattività/consultation-panel`)
- **Fix**: broadcast `config` al rilevamento dinamico di nuovi progetti (non più necessario fare F5)
- **Fix**: log deduplicati — stampa solo quando lo stato cambia
- Colonna Inattivi collassabile (strip verticale 32px)
- Esclusione progetti con bottone ⊗ e persistenza

### v4.0.0 (2026-04-02) — Scan Roots + Terminal Noir UI
- **Scan Roots**: discovery da cartelle radice configurabili
- **Area Admin**: pannello UI per gestire percorsi di scansione e percorsi esclusi
- **Trova finestra terminale**: prima implementazione
- **start.bat**: avvio rapido su Windows
- Redesign completo UI — dark theme, Syne + JetBrains Mono, neon glow

### v3.0.0 (2026-01-22) — Dynamic Discovery
- Auto-discovery dinamico — nuovi progetti aggiunti senza riavvio
- Timeout intelligenti (5 min tool, 60 min idle)
- Storico sessione (ultimi 20 eventi)
- Visualizzazione branch Git
- Marcatura manuale "controllato"

### v2.0.0 (2026-01-15) — Sessioni Reali
- Parsing file `.jsonl` in tempo reale
- Auto-detection sessioni Claude Code

### v1.0.0 (2026-01-01) — Prima Release
- Monitoraggio via `status.json`
- WebSocket + UI

---

<div align="center">

**[Segnala un Bug](https://github.com/Attilio81/ClaudeCodeDashboard/issues)** • **[Richiedi una Funzionalità](https://github.com/Attilio81/ClaudeCodeDashboard/issues)**

</div>
