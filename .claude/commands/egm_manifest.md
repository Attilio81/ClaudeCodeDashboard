Legge tutti gli header `codedna:` dai file VB del progetto e genera un file `.egm` YAML nella root del modulo. Mappa architetturale completa in un singolo file — zero LLM, zero token sprecati.

## Quando usarlo
- Per avere una mappa del progetto leggibile da Claude in una sola Read
- Dopo `/egm_init` o `/egm_refresh` per consolidare le annotazioni
- Per condividere la struttura del modulo con colleghi senza aprire Obsidian

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente: `modulo` = ultimo componente uppercase (es. `BNEG0185`).

**Passaggio 2 — Scansiona file VB**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb"
```

**Passaggio 3 — Estrai header da ogni file**

Per ogni file VB, leggi con Read e cerca il block:
```
' ============================================================
' codedna:purpose   ...
' codedna:exports   ...
' codedna:used_by   ...
' codedna:depends_on ...
' codedna:rules     ...
' codedna:agent     ...
' ============================================================
```

Estrai i valori campo per campo. Se il block non esiste per un file, segna `annotated: false`.

**Passaggio 4 — Leggi grafo per dipendenze cross-modulo**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Estrai per il modulo corrente:
- `used_by` = moduli che chiamano questo
- `depends_on` = moduli che questo chiama

**Passaggio 5 — Genera `.egm` YAML**

Scrivi `{cwd}\.egm`:

```yaml
# EGM Manifest — generato da /egm_manifest
# Lettura: /egm_manifest | Aggiornamento: /egm_refresh | Analisi: /egm_init

project: {MODULO}
description: {desc da graph_data.json se disponibile}
generated: {YYYY-MM-DD}

# Dipendenze cross-modulo (da grafo BIZ2017)
depends_on:
  - {MODULO1}
  - {MODULO2}

used_by:
  - {MODULO3}
  - {MODULO4}

# Mappa file del modulo
files:
  {NomeFile.vb}:
    annotated: true
    purpose: {valore codedna:purpose}
    exports: {valore codedna:exports}
    rules: {valore codedna:rules}
    last_agent: {valore codedna:agent}
  {AltroFile.vb}:
    annotated: false

# Sessioni agenti (da codedna:agent di tutti i file, deduplicato e ordinato)
agent_sessions:
  - agent: {model}
    date: {YYYY-MM-DD}
    note: {nota dalla sessione}
```

**Passaggio 6 — Rapporto**

Comunica:
- File totali: N
- File annotati: N / N
- File non annotati: lista nomi
- Path manifest: `{cwd}\.egm`
- Suggerimento se file non annotati: "esegui /egm_init per annotarli"

**Regole:**
- `.egm` è machine-readable — non aggiungere commenti extra oltre l'intestazione
- Se graph_data.json non trovato: genera manifest senza sezioni `depends_on`/`used_by`, avvisa utente
- Sovrascrive sempre il manifest esistente (è ricalcolato da zero ogni volta)
