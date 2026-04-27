Devi creare una nota di rilascio nella wiki Obsidian del progetto corrente.

## Quando usarlo
- Prima o dopo un deploy: include DLL, modifiche DB, istruzioni installazione
- NON usare per: log di sessione → usa /aggiornawiki
- NON usare per: documentazione utente → usa /aggiornamanuale

---

**Passaggio 1 — Recupera il percorso wiki**

Leggi il file:
`C:\Users\attilio.pregnolato.EGMSISTEMI\.claude\wiki-config.json`

Estrai il campo `wikiPath`.

**Passaggio 2 — Determina file e versione**

Dal cwd corrente (esegui `pwd` se non lo conosci), calcola:
- Normalizza il path: `/c/BIZ2017/BNEG0112` → `C:\BIZ2017\BNEG0112`
- `cartella` = penultimo componente (es. `BIZ2017`)
- `modulo` = ultimo componente lowercase (es. `bneg0112`)

La versione viene dall'argomento del comando (es. `/aggiornarilasci 1.3.0`).
Se non specificata, chiedi: *"Qual è il numero di versione di questo rilascio?"*

Percorso completo: `{wikiPath}\Rilasci\{cartella}\{modulo}-v{versione}.md`

**Passaggio 3 — Template di riferimento**

Leggi la struttura dal template:
`C:\Progetti Pilota\DashboardClaudeCode\Modelli\template_note_rilascio.md`

Il file da creare segue esattamente quella struttura:
- DLL Necessarie (con percorso e note)
- Modifiche a Tabelle (campo per campo)
- Funzionamento (procedura step-by-step + risultato atteso)
- Note Aggiuntive

**Passaggio 4 — Raccogli informazioni**

Se l'utente ha già fornito dettagli nel messaggio del comando, usali.
Altrimenti chiedi:
1. *"Quali DLL vanno aggiornate? (nome, percorso, note)"*
2. *"Ci sono modifiche a tabelle del database?"*
3. *"Descrivi il funzionamento della nuova versione."*
4. *"Note aggiuntive o dipendenze da altri rilasci?"*

Ricava data: `date +%Y-%m-%d`

**Passaggio 5 — Crea il file**

Il file è sempre nuovo (una versione = un file). Non modificare file esistenti per la stessa versione — se esiste già, avvisa l'utente.

Struttura:
```markdown
# Note Rilascio - v{versione}

**Progetto:** {modulo}
**Data:** {data}
**Autore:** {utente}

## DLL Necessarie
...

## Modifiche a Tabelle
...

## Funzionamento
...

## Note Aggiuntive
...
```

**Passaggio 6 — Aggiungi wikilinks cross-area**

Se il testo descrive modifiche a tabelle DB e esiste `{wikiPath}\Architettura\{cartella}\database.md`, aggiungi:
```
→ Schema DB: [[Architettura/{cartella}/database]]
```

Se esiste `{wikiPath}\Manuali\{cartella}\{modulo}.md`, aggiungi:
```
→ Manuale utente: [[Manuali/{cartella}/{modulo}]]
```

**Passaggio 7 — Aggiorna index radice**

Leggi `{wikiPath}\index.md`.

**Se non esiste**, crealo:
```markdown
---
last_updated: {YYYY-MM-DD}
---

# Wiki EGM — Index

## {cartella}

| Modulo | Architettura | Sessioni | Manuali | Rilasci |
|--------|-------------|---------|---------|---------|
| {modulo} | — | — | — | [[Rilasci/{cartella}/{modulo}-v{versione}\|v{versione}]] |
```

**Se esiste**:
1. Cerca `## {cartella}` — se manca, aggiungila con tabella
2. Cerca riga `{modulo}` nella tabella — se manca, aggiungila con `—` in tutte le colonne
3. Aggiorna colonna **Rilasci**: sostituisci il valore con `[[Rilasci/{cartella}/{modulo}-v{versione}|v{versione}]]` (sempre aggiorna — riflette l'ultima versione)
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Regole:**
- Audience: IT / sviluppatori che installano — non utenti finali
- Sii preciso su percorsi DLL (formato Windows assoluto)
- Per modifiche tabelle: specifica tipo dato e se nullable
- Conferma all'utente il percorso del file creato
