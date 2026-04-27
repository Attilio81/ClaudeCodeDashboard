Controlla la copertura delle annotazioni codedna: nei file VB del modulo corrente. Trova file non annotati, campi stale rispetto al grafo reale, e campi mancanti. Read-only — non modifica mai nulla.

## Quando usarlo
- Per sapere quali file mancano di documentazione inline
- Per verificare se le dipendenze annotate sono ancora accurate
- NON modifica nessun file — solo report

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente: `modulo` = ultimo componente uppercase.

**Passaggio 2 — Scansiona file VB**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb" \
  ! -path "*/.vs/*" ! -path "*/bin/*" ! -path "*/obj/*"
```

**Passaggio 3 — Leggi grafo reale**

Leggi `C:\Progetti Pilota\DashboardClaudeCode\grafo\graph_data.json`.

Estrai per il modulo corrente:
- `real_used_by` = tutti i source dove `link.target == modulo`

**Passaggio 4 — Analizza ogni file VB**

Per ogni file, leggi con Read e controlla:

**A) Header mancante** — nessun block `' codedna:` trovato → categoria `MISSING`

**B) Header presente ma stale** — confronta:
- `codedna:used_by` nel file vs `real_used_by` dal grafo
- Se differenza → categoria `STALE`

**C) Campi vuoti o `⚠️ da compilare`** — uno o più tra `purpose`, `exports`, `rules` non compilati → categoria `INCOMPLETE`

**D) Campi nuovi mancanti** — header presente ma manca `codedna:init_dlls` o `codedna:runchild` → categoria `OUTDATED_FORMAT`

**E) OK** — tutto presente, allineato al grafo, tutti i campi compilati

**Passaggio 5 — Output report**

```
# CodeDNA Check — {MODULO}
Data: {YYYY-MM-DD}

## Riepilogo
| Stato | File |
|-------|------|
| ✅ OK | N |
| ❌ Mancante | N |
| ⚠️ Stale | N |
| 🔶 Incompleto | N |
| 🔧 Formato obsoleto | N |

## File mancanti di annotazione
- {nomefile.vb}
→ Esegui /egm_init per aggiungere header automatico

## File con dipendenze stale
- {nomefile.vb}
  - depends_on nel file: BNEGBASE, BNEGZOOM
  - depends_on reale:    BNEGBASE, BNEGZOOM, BNEG0007  ← manca
→ Esegui /egm_refresh per aggiornare

## File con campi incompleti
- {nomefile.vb}: purpose, rules non compilati
→ Compilare manualmente o con /egm_session

## File con formato obsoleto (manca init_dlls/runchild)
- {nomefile.vb}: manca codedna:init_dlls, codedna:runchild
→ Esegui /egm_refresh per aggiornare al formato corrente

## Chi chiama questo modulo (da grafo)
- used_by: {lista}
```

**Regole:**
- Non modificare mai file — solo leggere e riportare
- Se graph_data.json non trovato: avvisa e suggerisci di eseguire `python "C:\Progetti Pilota\DashboardClaudeCode\grafo\extract_connections.py"`
- Considera stale solo se differenza > 0 moduli (aggiunte O rimozioni)
- Considera OUTDATED_FORMAT se header esiste ma mancano uno o entrambi i campi `init_dlls` / `runchild`
