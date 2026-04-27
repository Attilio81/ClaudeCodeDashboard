# Guida: Dashboard Claude Code + Wiki EGM

Questa guida ti permette di collegare il tuo Claude Code alla dashboard condivisa e alla wiki tecnica del team.

---

## Cosa ottieni

- **Dashboard** su `http://localhost:5173` — vedi tutte le tue sessioni Claude Code attive, le cerchi, le esporti
- **Notifiche Telegram** — ricevi un messaggio quando una sessione finisce o va in errore
- **Wiki condivisa** su `\\egmsql\EGMStruttura\Wiki-Egm` — documentazione tecnica dei moduli, aggiornata da tutti i colleghi con i comandi `/egm_*`

---

## 1. Prerequisiti

- Node.js >= 18 — verifica con `node -v`
- Git

---

## 2. Installazione

```bash
# Clona il repository
git clone https://github.com/Attilio81/ClaudeCodeDashboard.git
cd ClaudeCodeDashboard

# Installa le dipendenze
npm install
cd backend && npm install
cd ../frontend && npm install && cd ..
```

---

## 3. Configura le tue cartelle di lavoro

Apri `backend/scan-paths.json` e inserisci le cartelle radice dei tuoi progetti:

```json
["C:\\BIZ2017", "C:\\ProgettiEgm", "C:\\BUSEXP"]
```

Usa le cartelle dove hai i tuoi progetti — la dashboard le scansiona automaticamente in profondità.

---

## 4. Configura Telegram (opzionale)

Copia il file `.env` di esempio:

```bash
cp backend/.env.example backend/.env
```

Chiedi ad Attilio Pregnolato i valori di `TELEGRAM_TOKEN` e `TELEGRAM_CHAT_ID` da inserire nel file.

---

## 5. Avvia la dashboard

```bash
npm run dev
# oppure doppio click su start.bat
```

Apri `http://localhost:5173` — vedrai subito le tue sessioni Claude Code.

---

## 6. Installa gli hook Claude Code

Gli hook aggiornano la dashboard in tempo reale e inviano le notifiche Telegram.

**Crea lo script hook:**

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

**Aggiungi gli hook in `~/.claude/settings.json`** (nella sezione `hooks`, accanto a quelli che hai già):

```json
"Stop":        [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<tuousername>/.claude/hooks/hook-event.sh" }] }],
"PreToolUse":  [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<tuousername>/.claude/hooks/hook-event.sh" }] }],
"PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<tuousername>/.claude/hooks/hook-event.sh" }] }],
"Notification":[{ "matcher": "", "hooks": [{ "type": "command", "command": "bash /c/Users/<tuousername>/.claude/hooks/hook-event.sh" }] }]
```

> Sostituisci `<tuousername>` con il tuo nome utente Windows (es. `mario.rossi.EGMSISTEMI`).

---

## 7. Configura la wiki condivisa

Crea il file `~/.claude/wiki-config.json` con il percorso del vault condiviso:

```json
{ "wikiPath": "\\\\egmsql\\EGMStruttura\\Wiki-Egm" }
```

Verifica che la share sia accessibile da Esplora risorse: `\\egmsql\EGMStruttura\Wiki-Egm`.

---

## 8. Installa i comandi egm_*

I comandi devono essere in `~/.claude/commands/` per essere disponibili in **qualsiasi** progetto.

```bash
cp .claude/commands/egm_*.md ~/.claude/commands/
```

> Se sei dentro questa repo, Claude Code carica i comandi automaticamente senza copiare. Per usarli da BIZ2017, BUSEXP, ProgettiEgm, ecc. **devi copiarli**.

### Comandi disponibili

| Comando | Scopo | Quando usarlo |
|---------|-------|---------------|
| `/egm_init` | Inietta header `codedna:` nei file VB | Prima volta su un modulo |
| `/egm_manifest` | Genera mappa codedna → wiki | Dopo `/egm_init` o `/egm_refresh` |
| `/egm_update` | Aggiorna architettura incrementalmente | Dopo modifiche puntuali al codice |
| `/egm_session` | Log di sessione nella wiki | Dopo ogni sessione significativa |
| `/egm_manual` | Manuale utente nella wiki | Quando cambia come si usa il software |
| `/egm_release` | Nota di rilascio nella wiki | Prima/dopo un deploy |
| `/egm_check` | Verifica copertura annotazioni | Per sapere quali file mancano |
| `/egm_impact` | Analisi catena dipendenze | Prima di modificare un modulo |
| `/egm_refresh` | Ricalcola dipendenze via regex | Dopo aver aggiunto chiamate a nuovi moduli |

---

## 9. Configura Obsidian sulla wiki condivisa

1. Apri Obsidian
2. **Apri cartella come vault** → seleziona `\\egmsql\EGMStruttura\Wiki-Egm`
3. La wiki è già popolata con la documentazione esistente

---

## Utilizzo quotidiano

### Registrare cosa hai fatto in sessione → `/egm_session`

```
/egm_session la logica di validazione in BNEG0128 funziona così:
controlla prima il flag ATTIVO nella tabella CLIENTI, poi verifica
la scadenza in CONTRATTI — se entrambi ok, procede con l'elaborazione
```

Scrive in `Wiki-Egm\Sessioni\BIZ2017\bneg0128.md`.

### Documentare la logica del progetto → `/egm_manual`

```
/egm_manual il modulo BNEG0128 gestisce la validazione dei contratti:
query su CLIENTI + CONTRATTI, flag ATTIVO, scadenza, poi elaborazione
```

Scrive in `Wiki-Egm\Manuali\BIZ2017\bneg0128.md`.

### Creare nota di rilascio → `/egm_release`

```
/egm_release v2.3.1
```

### Prima analisi di un nuovo modulo → `/egm_init` + `/egm_manifest`

Per moduli **BIZ2017 (file VB)**:

```
/egm_init
/egm_manifest
```

Per progetti **non-VB** (JS, TS, Python, C#, ecc.) usa invece:

```
/codedna:init
```

Il sistema CodeDNA supporta tutti i tipi di file — `/egm_init` è specifico per VB.

---

## Domande

Contatta Attilio Pregnolato per assistenza o per aggiungere nuove cartelle di progetto al monitoraggio.
