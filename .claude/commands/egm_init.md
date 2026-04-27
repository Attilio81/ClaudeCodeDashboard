Inietta header `codedna:` nei file VB del modulo corrente. Zero wiki — solo annotazioni inline nel sorgente.

## Quando usarlo
- Prima volta su un modulo BIZ2017: crea header codedna in tutti i file VB
- Per aggiungere header mancanti senza toccare quelli esistenti
- NON scrive nulla nella wiki → usa /egm_manifest per la mappa leggibile
- NON aggiorna dipendenze già esistenti → usa /egm_refresh

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente (esegui `pwd` se non lo conosci):
- `modulo` = ultimo componente uppercase (es. `BNEGAS09`)

**Passaggio 2 — Trova chi chiama questo modulo**

```bash
python "C:\Progetti Pilota\DashboardClaudeCode\grafo\find_callers.py" {MODULO}
```

Output: lista moduli separati da virgola, oppure `—` se nessuno.
Salva il risultato come `used_by` da inserire nell'header.

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

**Passaggio 5 — Estrai pattern specifici da ogni file VB**

Per ogni file VB, leggi con Read ed esegui:

### 5a — Estrai `init_dlls` (da `Public Overloads Function Init`)

Trova il blocco `Public Overloads Function Init` → `End Function`.
All'interno, trova le righe **non commentate** (non iniziano con `'`) che contengono `NTSIstanziaDll`.

Pattern: `NTSIstanziaDll(..., ..., "DLL_NAME", "CLASS_NAME", ...)`
- arg3 = DLL_NAME (3° stringa quoted)
- arg4 = CLASS_NAME (4° stringa quoted)

Raccogli coppie `DLL_NAME → CLASS_NAME`. Escludi auto-riferimenti (DLL_NAME == modulo).

### 5b — Estrai `runchild` (da tutto il file)

Trova righe **non commentate** contenenti `RunChild`.

Due pattern:
1. `RunChild("NTSInformatica", "FRM...", ..., "BN...", ...)` → 6° argomento stringa = modulo BN*
2. `RunChild("BS...", "CLS...", ...)` → 1° argomento stringa (se inizia con `BS` o `BN`)

Raccogli lista moduli BN* distinti. Escludi duplicati.

**Passaggio 6 — Inietta header codedna: in ogni file VB**

**Se il file ha già un block `' codedna:`:** non toccare — salta il file.

**Se il file NON ha header:** aggiungi in cima al file (prima di `Imports` o prima della prima riga di codice):

```vb
' ============================================================
' codedna:purpose    ⚠️ da compilare
' codedna:exports    ⚠️ da compilare
' codedna:used_by    {lista da grafo — chi chiama questo modulo}
' codedna:init_dlls  {DLL_NAME → CLASS_NAME | DLL_NAME → CLASS_NAME}
' codedna:runchild   {BNXX, BNXX, BNXX}
' codedna:rules      ⚠️ da compilare
' codedna:agent      claude-sonnet-4-6 | {YYYY-MM-DD} | "egm_init"
' ============================================================
```

Se `init_dlls` o `runchild` sono vuoti, scrivi `—` come valore.

**Passaggio 7 — Crea o aggiorna CLAUDE.md**

Controlla se esiste `CLAUDE.md` nella directory corrente.

**Se non esiste:** crealo con questo contenuto:

```markdown
# {MODULO}

All'inizio di ogni sessione leggi `{MODULO}.egm` — contiene architettura,
dipendenze (init_dlls, runchild, used_by) e regole di business del modulo.
Esegui `/egm_manifest` se il file `.egm` non esiste ancora.
```

**Se esiste già:** controlla se contiene già un riferimento a `{MODULO}.egm`.
- Trovato → non modificare.
- Non trovato → aggiungi in fondo:

```markdown

## CodeDNA

All'inizio di ogni sessione leggi `{MODULO}.egm` — contiene architettura,
dipendenze (init_dlls, runchild, used_by) e regole di business del modulo.
Esegui `/egm_manifest` se il file `.egm` non esiste ancora.
```

**Passaggio 8 — Rapporto**

Comunica all'utente:
- Modulo: `{MODULO}`
- used_by trovati dal grafo: lista (o "nessuno")
- File scansionati: N
- Header iniettati (nuovi): N
- File saltati (già annotati): N
- File con `init_dlls` trovati: N (lista nomi)
- File con `runchild` trovati: N (lista nomi)
- CLAUDE.md: creato / aggiornato / già presente
- Prossimi passi: "Esegui /egm_manifest per generare la mappa .egm del modulo"
