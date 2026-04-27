Legge tutti gli header `codedna:` dai file VB del progetto e genera due output: un `.egm` YAML nella root del modulo (per Claude) e un `_manifest.md` nella wiki Obsidian (per i colleghi).

## Quando usarlo
- Dopo `/egm_init` o `/egm_refresh` per consolidare le annotazioni
- Per avere una mappa leggibile da Claude in una sola Read
- Per vedere il modulo in Obsidian con dipendenze e sessioni agente

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente:
- `cartella` = penultimo componente (es. `BIZ2017`)
- `modulo` = ultimo componente uppercase (es. `BNEGAS09`)

**Passaggio 2 — Recupera percorso wiki**

Leggi `C:\Users\attilio.pregnolato.EGMSISTEMI\.claude\wiki-config.json`, estrai `wikiPath`.

**Passaggio 3 — Scansiona file VB**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb" \
  ! -path "*/.vs/*" ! -path "*/bin/*" ! -path "*/obj/*"
```

**Passaggio 4 — Estrai header da ogni file**

Per ogni file VB, leggi con Read e cerca il block `' codedna:`.

Estrai campo per campo: `purpose`, `exports`, `used_by`, `depends_on`, `init_dlls`, `runchild`, `rules`, `agent`.
Se il block non esiste per un file, segna `annotated: false`.

**Passaggio 5 — Leggi grafo per dipendenze cross-modulo**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Estrai per il modulo corrente:
- `used_by` = source dove `link.target == modulo`
- `depends_on` = target dove `link.source == modulo`

**Passaggio 6 — Scrivi `.egm` nella root del modulo**

Scrivi `{cwd}\.egm` (machine-readable per Claude):

```yaml
# EGM Manifest — generato da /egm_manifest
# Lettura: /egm_manifest | Aggiornamento: /egm_refresh | Annotazione: /egm_init

project: {MODULO}
generated: {YYYY-MM-DD}

used_by:
  - {MODULO1}

files:
  {NomeFile.vb}:
    annotated: true
    purpose: {valore}
    exports: {valore}
    rules: {valore}
    init_dlls: {valore}
    runchild: {valore}
    last_agent: {valore}
  {AltroFile.vb}:
    annotated: false

agent_sessions:
  - agent: {model}
    date: {YYYY-MM-DD}
    note: {nota}
```

**Passaggio 7 — Scrivi `_manifest.md` nella wiki**

Percorso: `{wikiPath}\Architettura\{cartella}\{modulo}\_manifest.md`

```markdown
---
project: {MODULO}
cartella: {cartella}
generated: {YYYY-MM-DD}
annotated: {n annotati}/{n totali}
---

# {MODULO} — Manifest

## Dipendenze Cross-Modulo

| Direzione | Moduli |
|-----------|--------|
| **used_by** (chiamato da) | {MODULO1}, {MODULO2} |
| **init_dlls** (DLL istanziate) | {vedi tabella file} |
| **runchild** (moduli lanciati) | {vedi tabella file} |

## File del Modulo

| File | Annotato | Purpose | init_dlls | runchild |
|------|----------|---------|-----------|----------|
| `{NomeFile.vb}` | ✅ | {purpose} | {init_dlls} | {runchild} |
| `{AltroFile.vb}` | ❌ | — | — | — |

## Sessioni Agente

| Data | Agente | Note |
|------|--------|------|
| {YYYY-MM-DD} | {model} | {nota} |

## Note

_Generato automaticamente da /egm_manifest — non modificare manualmente._
_Aggiorna con: `/egm_refresh` → `/egm_manifest`_
```

**Passaggio 8 — Aggiorna index radice wiki**

Leggi `{wikiPath}\index.md`.

Se non esiste, crealo. Se esiste:
1. Cerca `## {cartella}` — se manca, aggiungila
2. Cerca riga `{modulo}` — se manca, aggiungila con `—` in tutte le colonne
3. Aggiorna colonna **Architettura**: `[[Architettura/{cartella}/{modulo}/_manifest|✓]]`
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Passaggio 9 — Rapporto**

Comunica:
- Modulo: `{MODULO}`
- File totali: N / annotati: N
- File non annotati: lista nomi (suggerisci `/egm_init`)
- `.egm` scritto in: `{cwd}\.egm`
- `_manifest.md` scritto in: `{wikiPath}\Architettura\{cartella}\{modulo}\_manifest.md`

**Regole:**
- Sovrascrive sempre entrambi i file (ricalcolati da zero)
- Se graph_data.json non trovato: genera senza sezioni depends_on/used_by, avvisa utente
- `.egm` non aggiungere commenti extra oltre l'intestazione
