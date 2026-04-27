Inietta header `codedna:` nei file VB del modulo corrente e genera un `_overview.md` nella wiki. Zero pagine wiki per-file — solo annotazioni inline nel sorgente.

## Quando usarlo
- Prima volta su un modulo BIZ2017: crea header codedna in tutti i file VB
- Per aggiungere header mancanti senza toccare quelli esistenti
- NON scrive pagine wiki individuali per file → usa /egm_session per la documentazione estesa
- NON aggiorna dipendenze già esistenti → usa /egm_refresh

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente (esegui `pwd` se non lo conosci):
- Normalizza il path: `/c/BIZ2017/BNEG0112` → `C:\BIZ2017\BNEG0112`
- `cartella` = penultimo componente (es. `BIZ2017`)
- `modulo` = ultimo componente uppercase (es. `BNEG0112`)

**Passaggio 2 — Recupera il percorso wiki**

Leggi `C:\Users\attilio.pregnolato.EGMSISTEMI\.claude\wiki-config.json`, estrai `wikiPath`.

**Passaggio 3 — Scansiona file VB**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb" \
  ! -path "*/.vs/*" ! -path "*/bin/*" ! -path "*/obj/*"
```

**Passaggio 4 — Classifica file per profondità di analisi**

Per ogni file, leggi brevemente e assegna:

**COMPACT** — classi con sole proprietà, nessun metodo con logica reale
**MEDIUM** — form con UI ma logica minima, helper, extension
**DEEP** — form o moduli con logica di business, query SQL, calcoli complessi

**Passaggio 5 — Leggi il grafo per dipendenze cross-modulo**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Estrai per il modulo corrente:
- `used_by` = source dove `link.target == modulo` → chi chiama questo modulo
- `depends_on` = target dove `link.source == modulo` → cosa chiama questo modulo

**Passaggio 6 — Estrai pattern specifici da ogni file VB**

Per ogni file VB che sarà annotato, leggi con Read ed esegui:

### 6a — Estrai `init_dlls` (da `Public Overloads Function Init`)

Trova il blocco `Public Overloads Function Init` → `End Function`.
All'interno, trova le righe **non commentate** (non iniziano con `'`) che contengono `NTSIstanziaDll`.

Pattern: `NTSIstanziaDll(..., ..., "DLL_NAME", "CLASS_NAME", ...)`
- arg3 = DLL_NAME (3° stringa quoted)
- arg4 = CLASS_NAME (4° stringa quoted)

Raccogli coppie `DLL_NAME → CLASS_NAME`. Escludi auto-riferimenti (DLL_NAME == modulo).

### 6b — Estrai `runchild` (da tutto il file)

Trova righe **non commentate** contenenti `RunChild`.

Due pattern:
1. `RunChild("NTSInformatica", "FRM...", ..., "BN...", ...)` → 6° argomento stringa = modulo BN*
2. `RunChild("BS...", "CLS...", ...)` → 1° argomento stringa (se inizia con `BS` o `BN`)

Raccogli lista moduli BN* distinti. Escludi duplicati.

**Passaggio 7 — Inietta header codedna: in ogni file VB**

**Se il file ha già un block `' codedna:`:** non toccare — salta il file.

**Se il file NON ha header:** aggiungi in cima al file (prima di `Imports` o prima della prima riga di codice):

```vb
' ============================================================
' codedna:purpose    ⚠️ da compilare
' codedna:exports    ⚠️ da compilare
' codedna:used_by    {lista da grafo — chi chiama questo modulo}
' codedna:depends_on {lista da grafo — cosa chiama questo modulo}
' codedna:init_dlls  {DLL_NAME → CLASS_NAME | DLL_NAME → CLASS_NAME}
' codedna:runchild   {BNXX, BNXX, BNXX}
' codedna:rules      ⚠️ da compilare
' codedna:agent      claude-sonnet-4-6 | {YYYY-MM-DD} | "egm_init"
' ============================================================
```

Se `init_dlls` o `runchild` sono vuoti, scrivi `—` come valore.

**Passaggio 8 — Scrivi _overview.md nella wiki**

Percorso: `{wikiPath}\Architettura\{cartella}\{modulo}\_overview.md`

```markdown
---
last_analyzed: {YYYY-MM-DD}
---

# {MODULO} — Overview

## Modulo

| Campo | Valore |
|-------|--------|
| Cartella | {cartella} |
| File VB | {n totale} |
| Annotati ora | {n nuovi} |
| Già annotati | {n skip} |

## Dipendenze Cross-Modulo (da grafo BIZ2017)

**depends_on:** {lista o "nessuna"}
**used_by:** {lista o "nessuna"}

## File del Modulo

| File | Livello | Scopo (da compilare) |
|------|---------|----------------------|
| `{file.vb}` | COMPACT/MEDIUM/DEEP | ⚠️ da compilare |

## Note

Header codedna: iniettati da /egm_init in data {YYYY-MM-DD}.
Compilare `purpose`, `exports`, `rules` in ogni file con /egm_session.
```

**Passaggio 9 — Aggiorna index radice**

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
| {modulo} | [[Architettura/{cartella}/{modulo}/_overview\|✓]] | — | — | — |
```

**Se esiste**:
1. Cerca `## {cartella}` — se manca, aggiungila con tabella
2. Cerca riga `{modulo}` nella tabella — se manca, aggiungila
3. Aggiorna colonna Architettura: `[[Architettura/{cartella}/{modulo}/_overview|✓]]`
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Passaggio 10 — Rapporto**

Comunica all'utente:
- Modulo: `{MODULO}`
- File scansionati: N
- Header iniettati (nuovi): N
- File saltati (già annotati): N
- File con `init_dlls` trovati: N (lista nomi)
- File con `runchild` trovati: N (lista nomi)
- Path _overview.md scritto
- Prossimi passi: "Esegui /egm_session per compilare purpose/exports/rules"
