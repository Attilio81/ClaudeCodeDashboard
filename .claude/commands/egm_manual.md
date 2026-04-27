Devi scrivere o aggiornare il manuale del progetto nella wiki Obsidian del progetto corrente.

## Quando usarlo
- Quando cambia come si usa il software: nuova feature visibile, cambio workflow utente
- NON usare per: log di sessione → usa /aggiornawiki
- NON usare per: DLL/tabelle DB/note rilascio → usa /aggiornarilasci
- NON usare per: analisi strutturale del codice → usa /analizzacodebase

---

**Passaggio 1 — Recupera il percorso wiki**

Leggi il file:
`C:\Users\attilio.pregnolato.EGMSISTEMI\.claude\wiki-config.json`

Estrai il campo `wikiPath`.

**Passaggio 2 — Determina il file di destinazione**

Dal cwd corrente (esegui `pwd` se non lo conosci), calcola:
- Normalizza il path: `/c/BIZ2017/BNEG0112` → `C:\BIZ2017\BNEG0112`
- `cartella` = penultimo componente (es. `BIZ2017`)
- `modulo` = ultimo componente lowercase (es. `bneg0112`)
- Percorso completo: `{wikiPath}\Manuali\{cartella}\{modulo}.md`

**Passaggio 3 — Template di riferimento**

Prima di scrivere, leggi la struttura attesa dal template:
`C:\Progetti Pilota\DashboardClaudeCode\Modelli\template_manuale_utente.md`

Rispetta la struttura: intestazione con versione/data/destinatari, indice rapido, sezioni con mockup ASCII dove applicabile, messaggi di errore, FAQ, supporto, riepilogo veloce.

**Passaggio 4 — Contenuto da documentare**

Se l'utente ha già descritto cosa documentare nel messaggio del comando, usalo.
Se non è specificato, chiedi: *"Cosa vuoi documentare nel manuale? Descrivi la logica, l'architettura o la procedura."*

Ricava data e utente:
```bash
date +%Y-%m-%d
whoami
```

**Passaggio 5 — Scrivi nel manuale**

**Se il file non esiste:** crealo seguendo il template (intestazione + indice + prima sezione).

**Se il file esiste:** leggilo con Read, poi:
- Cerca sezione `##` che descrive lo stesso argomento (confronto semantico)
- **Trovata:** riscrivi la sezione (unisci vecchio + nuovo), aggiorna cronologia
- **Non trovata:** appendi nuova sezione in fondo con `> *Cronologia: YYYY-MM-DD utente — prima stesura*`

**Passaggio 6 — Aggiungi wikilink cross-area**

Controlla se esiste `{wikiPath}\Architettura\{cartella}\{modulo}\_overview.md`.
Se esiste, aggiungi nell'intestazione del file (dopo il titolo `#`):
```
> Riferimento tecnico: [[Architettura/{cartella}/{modulo}/_overview]]
```
(Solo se non già presente.)

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
| {modulo} | — | — | [[Manuali/{cartella}/{modulo}\|✓]] | — |
```

**Se esiste**:
1. Cerca `## {cartella}` — se manca, aggiungila con tabella
2. Cerca riga `{modulo}` nella tabella — se manca, aggiungila con `—` in tutte le colonne
3. Aggiorna colonna **Manuali**: sostituisci `—` con `[[Manuali/{cartella}/{modulo}|✓]]` (se già ha un link, lascia invariato)
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Regole:**
- Scrivi SOLO quello che l'utente ha chiesto di documentare
- Usa tabelle Markdown per strutture dati, blocchi codice per logica/SQL/VB
- Il titolo della sezione descrive la procedura (es. `## Logica calcolo commissioni`), NON include la data
- NON scrivere log di sessione — per quello usa `/aggiornawiki`
- Conferma all'utente il percorso del file e se hai aggiornato o creato
