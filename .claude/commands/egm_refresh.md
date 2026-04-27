Ricalcola le dipendenze del progetto BIZ2017 corrente via regex e aggiorna gli header `codedna:` nei file VB. Zero token LLM — solo analisi statica.

## Quando usarlo
- Dopo aver aggiunto chiamate a nuovi moduli (`NTSIstanziaDll`, `RunChild`)
- Per sincronizzare i campi di dipendenza senza ranalizzare il codice
- NON usare per aggiornare la documentazione wiki → usa /egm_session

---

**Passaggio 1 — Identifica il modulo corrente**

Dal cwd corrente (esegui `pwd` se non lo conosci):
- `modulo` = ultimo componente uppercase (es. `BNEGCM00`)

**Passaggio 2 — Rigenera il grafo completo**

```bash
python "C:\Progetti Pilota\GrafoEgm\extract_connections.py"
```

Riscrive `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

**Passaggio 3 — Leggi il grafo per dipendenze cross-modulo**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Per il modulo corrente estrai:
- `used_by` = source dove `link.target == modulo` → chi chiama questo modulo

**Passaggio 4 — Trova i file VB nel modulo**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb"
```

**Passaggio 5 — Estrai pattern specifici da ogni file VB**

Per ogni file VB, leggi con Read ed esegui:

### 5a — Estrai `init_dlls` (da `Public Overloads Function Init`)

Trova il blocco `Public Overloads Function Init` → `End Function`.
All'interno, trova le righe **non commentate** (non iniziano con `'`) che contengono `NTSIstanziaDll`.

Pattern: `NTSIstanziaDll(..., ..., "DLL_NAME", "CLASS_NAME", ...)`
- arg3 = DLL_NAME (3° stringa quoted)
- arg4 = CLASS_NAME (4° stringa quoted)

Raccogli coppie `DLL_NAME → CLASS_NAME`. Escludi auto-riferimenti (DLL_NAME == nome file senza estensione).

Esempio estratto da `BNEGCM00.vb`:
```
BNEGCM00 → BEEGCM00 (entity)
BNEGCM00 → BEEGS999 (entity)
```

### 5b — Estrai `runchild` (da tutto il file)

Trova righe **non commentate** contenenti `RunChild`.

Due pattern:
1. `RunChild("NTSInformatica", "FRM...", ..., "BN...", ...)` → 6° argomento stringa = modulo BN*
2. `RunChild("BS...", "CLS...", ...)` → 1° argomento stringa (se inizia con `BS` o `BN`)

Raccogli lista moduli BN* distinti. Escludi duplicati e moduli commentati.

Esempio estratto da `BNEGCM00.vb`:
```
BNEGCN01, BNEGCN30, BNEGCM02, BNEGCM04, BNEGCM07, BNEGCM08, BNEGCM09, BNEGCM10,
BNEGET03, BNEGCA05, BNEGCA06, BNEGZE18, BNEGZE20, BNEGAG05, BNEGAG12
```

**Passaggio 6 — Aggiorna header codedna: in ogni file VB**

Per ogni file, cerca il block:
```
' ============================================================
' codedna:...
' ============================================================
```

**Se il block esiste:** aggiorna SOLO i campi dipendenza. Preserva `purpose`, `exports`, `rules`, `agent`.

**Se NON esiste:** crea da zero in cima al file (prima di `Imports`):

```vb
' ============================================================
' codedna:purpose    ⚠️ da compilare
' codedna:exports    ⚠️ da compilare
' codedna:used_by    {lista da grafo — chi chiama questo modulo}
' codedna:init_dlls  {DLL_NAME → CLASS_NAME | DLL_NAME → CLASS_NAME}
' codedna:runchild   {BNXX, BNXX, BNXX}
' codedna:rules      ⚠️ da compilare
' codedna:agent      claude-sonnet-4-6 | {YYYY-MM-DD} | "egm_refresh automatico"
' ============================================================
```

Campi aggiornati ad ogni refresh:
- `codedna:used_by` — da graph_data.json (chi chiama questo modulo dall'esterno)
- `codedna:init_dlls` — da analisi regex `Public Overloads Function Init`
- `codedna:runchild` — da analisi regex `RunChild` su tutto il file

**Passaggio 7 — Rapporto**

Comunica all'utente:
- Modulo: `{modulo}`
- File aggiornati: N
- Per ogni file: `init_dlls` trovati, `runchild` trovati
- File con header creato da zero: lista nomi
- File senza chiamate RunChild/NTSIstanziaDll: lista nomi
