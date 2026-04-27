# Quick Start Guide

Dashboard Claude Code in 5 minuti.

## Prerequisiti

- Node.js >= 18 (verifica: `node -v`)
- Git

## 1. Installazione

```bash
git clone https://github.com/Attilio81/ClaudeCodeDashboard.git
cd ClaudeCodeDashboard
npm install
cd backend && npm install
cd ../frontend && npm install && cd ..
```

## 2. Configura le cartelle di lavoro

Apri `backend/scan-paths.json` e inserisci le cartelle radice dei tuoi progetti:

```json
["C:\\BIZ2017", "C:\\ProgettiEgm", "C:\\BUSEXP"]
```

## 3. (Opzionale) Telegram

```bash
cp backend/.env.example backend/.env
# Modifica con TELEGRAM_TOKEN e TELEGRAM_CHAT_ID
# Chiedi i valori ad Attilio Pregnolato
```

## 4. Avvia

```bash
npm run dev
# oppure doppio click su start.bat
```

Apri `http://localhost:5173`.

## 5. Hook Claude Code (stato in tempo reale)

```bash
mkdir -p ~/.claude/hooks

cat > ~/.claude/hooks/hook-event.sh << 'EOF'
#!/bin/bash
INPUT=$(cat)
curl -s -X POST "http://localhost:3001/api/hook-event" \
  -H "Content-Type: application/json" \
  -d "$INPUT" > /dev/null 2>&1 || true
EOF

chmod +x ~/.claude/hooks/hook-event.sh
```

Aggiungi in `~/.claude/settings.json` (nella sezione `hooks`):

```json
{
  "hooks": {
    "Stop":        [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<username>/.claude/hooks/hook-event.sh" }] }],
    "PreToolUse":  [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<username>/.claude/hooks/hook-event.sh" }] }],
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<username>/.claude/hooks/hook-event.sh" }] }],
    "Notification":[{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<username>/.claude/hooks/hook-event.sh" }] }]
  }
}
```

> Sostituisci `<username>` con il tuo nome utente Windows (es. `mario.rossi.EGMSISTEMI`).

## 6. Wiki condivisa (comandi egm_*)

Crea `~/.claude/wiki-config.json`:

```json
{ "wikiPath": "\\\\egmsql\\EGMStruttura\\Wiki-Egm" }
```

Copia i comandi nella tua home Claude Code:

```bash
cp .claude/commands/egm_*.md ~/.claude/commands/
```

## Comandi npm

| Comando | Azione |
|---------|--------|
| `npm run dev` | Avvia backend + frontend |
| `npm run dev:backend` | Solo backend (porta 3001) |
| `npm run dev:frontend` | Solo frontend (porta 5173) |
| `npm run build` | Build produzione |

## Troubleshooting rapido

**Porta 3001 in uso:**
```powershell
taskkill /f /im node.exe
```

**Progetto non rilevato:** verifica `backend/scan-paths.json`, poi usa **Riscansiona** dal pannello Admin.

**Hook non funzionano:** apri `http://localhost:3001/api/health` — se non risponde, backend non è avviato.

Vedi [README.md](README.md) per documentazione completa e [GUIDA-COLLEGHI.md](GUIDA-COLLEGHI.md) per il setup completo.
