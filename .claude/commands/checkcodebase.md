Controlla la copertura delle annotazioni codedna: nei file VB del modulo corrente. Trova file non annotati e `used_by` / `depends_on` stale rispetto al grafo reale.

## Quando usarlo
- Per sapere quali file mancano di documentazione inline
- Per verificare se le dipendenze annotate sono ancora accurate
- NON modifica nessun file — solo report

---

**Passaggio 1 — Identifica il modulo**

Dal cwd corrente: `modulo` = ultimo componente uppercase.

**Passaggio 2 — Scansiona file VB**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb"
```

**Passaggio 3 — Leggi grafo reale**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Estrai per il modulo corrente:
- `real_depends_on` = tutti i target dove `link.source == modulo`
- `real_used_by` = tutti i source dove `link.target == modulo`

**Passaggio 4 — Analizza ogni file VB**

Per ogni file, leggi con Read e controlla:

**A) Header mancante** — nessun block `' codedna:` trovato → categoria `MISSING`

**B) Header presente ma stale** — confronta:
- `codedna:depends_on` nel file vs `real_depends_on` dal grafo
- `codedna:used_by` nel file vs `real_used_by` dal grafo
- Se differenza → categoria `STALE`

**C) Campi vuoti o `⚠️ da compilare`** — `purpose`, `exports`, `rules` non compilati → categoria `INCOMPLETE`

**D) OK** — tutto presente e allineato al grafo

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

## File mancanti di annotazione
- {nomefile.vb}
- ...
→ Esegui /refreshcodebase per aggiungere header automatico

## File con dipendenze stale
- {nomefile.vb}
  - depends_on nel file: BNEGBASE, BNEGZOOM
  - depends_on reale:    BNEGBASE, BNEGZOOM, BNEG0007  ← manca
→ Esegui /refreshcodebase per aggiornare

## File con campi incompleti
- {nomefile.vb}: purpose, rules non compilati
→ Esegui /analizzacodebase per analisi completa LLM

## Dipendenze reali del modulo (da grafo)
- depends_on: {lista}
- used_by:    {lista}
```

**Regole:**
- Non modificare mai file — solo leggere e riportare
- Se graph_data.json non trovato: avvisa e suggerisci di eseguire `python "C:\Progetti Pilota\GrafoEgm\extract_connections.py"`
- Considera stale solo se differenza > 0 moduli (aggiunte O rimozioni)
