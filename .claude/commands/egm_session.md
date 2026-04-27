Devi aggiungere una voce di changelog nella wiki Obsidian del progetto corrente.

## Quando usarlo
- Dopo ogni sessione significativa: bug fix, feature, decisione architettuale
- NON usare per: documentazione utente → usa /aggiornamanuale
- NON usare per: note di rilascio → usa /aggiornarilasci
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
- Percorso completo: `{wikiPath}\Sessioni\{cartella}\{modulo}.md`

**Passaggio 3 — Contenuto da documentare**

Se l'utente ha già descritto cosa documentare nel messaggio del comando, usalo.
Se non è specificato, chiedi: *"Cosa è stato fatto? Descrivi le modifiche o le decisioni di questa sessione."*

Ricava data e utente:
```bash
date +%Y-%m-%d
whoami
```

**Passaggio 4 — Scrivi nel file**

**Se il file non esiste:** crealo con:
```
# {modulo}

## {Titolo breve dell'intervento}

{Descrizione di cosa è stato fatto, perché, e cosa ha cambiato}

> *Cronologia: YYYY-MM-DD utente — prima stesura*
```

**Se il file esiste:** leggilo con Read, poi:
- Cerca se esiste già una sezione `##` che descrive lo stesso argomento (confronto semantico)
- **Trovata:** riscrivi il contenuto della sezione, aggiungi voce cronologia: `· YYYY-MM-DD utente — descrizione`
- **Non trovata:** appendi nuova sezione `##` in fondo con `> *Cronologia: YYYY-MM-DD utente — prima stesura*`

**Passaggio 5 — Aggiungi wikilink cross-area (opzionale)**

Controlla se esiste `{wikiPath}\Architettura\{cartella}\{modulo}\_overview.md`.
Se esiste, aggiungi in fondo alla sezione appena scritta:
```
→ Vedi anche: [[Architettura/{cartella}/{modulo}/_overview]]
```

**Passaggio 6 — Aggiorna index radice**

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
| {modulo} | — | [[Sessioni/{cartella}/{modulo}\|✓]] | — | — |
```

**Se esiste**:
1. Cerca `## {cartella}` — se manca, aggiungila con tabella
2. Cerca riga `{modulo}` nella tabella — se manca, aggiungila con `—` in tutte le colonne
3. Aggiorna colonna **Sessioni**: sostituisci `—` con `[[Sessioni/{cartella}/{modulo}|✓]]` (se già ha un link, lascia invariato)
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Regole:**
- Scrivi cosa è cambiato e perché — non solo "aggiornato X"
- Usa blocchi codice per snippet SQL/VB/config rilevanti
- NON aggiornare il manuale — per quello usa `/aggiornamanuale`
- Conferma all'utente il percorso del file e se è nuovo o aggiornato
