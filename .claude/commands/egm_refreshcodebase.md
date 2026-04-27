Ricalcola le dipendenze del progetto BIZ2017 corrente via regex e aggiorna gli header `codedna:` nei file VB. Zero token LLM — solo analisi statica.

## Quando usarlo
- Dopo aver aggiunto chiamate a nuovi moduli (`NTSIstanziaDll`, `RunChild`)
- Per sincronizzare `used_by` / `depends_on` senza ranalizzare il codice
- NON usare per aggiornare la documentazione wiki → usa /aggiornacodebase

---

**Passaggio 1 — Identifica il modulo corrente**

Dal cwd corrente (esegui `pwd` se non lo conosci):
- `modulo` = ultimo componente uppercase (es. `BNEG0185`)

**Passaggio 2 — Rigenera il grafo completo**

Esegui:
```bash
python "C:\Progetti Pilota\GrafoEgm\extract_connections.py"
```

Questo riscrive `C:\Progetti Pilota\GrafoEgm\graph_data.json` con i dati aggiornati.

**Passaggio 3 — Leggi il grafo aggiornato**

Leggi `C:\Progetti Pilota\GrafoEgm\graph_data.json`.

Per il modulo corrente, estrai:
- `depends_on` = tutti i target dove `link.source == modulo` → lista moduli che questo chiama
- `used_by` = tutti i source dove `link.target == modulo` → lista moduli che chiamano questo

Formato risultato:
```
depends_on: BNEGBASE, BNEGZOOM, rep-web-service-egm
used_by:    BNEG0069, BNEG0044
```

**Passaggio 4 — Trova i file VB nel modulo**

```bash
find . -type f -iname "*.vb" ! -iname "*.designer.vb"
```

**Passaggio 5 — Aggiorna header codedna: in ogni file VB**

Per ogni file VB trovato:

1. Leggi il file con Read
2. Cerca il block esistente:
```
' ============================================================
' codedna:...
' ============================================================
```

**Se il block esiste:** sostituisci SOLO le righe `codedna:used_by` e `codedna:depends_on` con i valori freschi dal grafo. Preserva `purpose`, `exports`, `rules`, `agent`.

**Se il block NON esiste:** aggiungi in cima al file (prima di qualsiasi `Imports` o dichiarazione):
```vb
' ============================================================
' codedna:purpose   ⚠️ da compilare
' codedna:exports   ⚠️ da compilare
' codedna:used_by   {lista moduli che chiamano questo}
' codedna:depends_on {lista moduli che questo chiama}
' codedna:rules     ⚠️ da compilare
' codedna:agent     claude-sonnet-4-6 | {YYYY-MM-DD} | "refresh automatico"
' ============================================================
```

**Passaggio 6 — Rapporto**

Comunica all'utente:
- Modulo: `{modulo}`
- File aggiornati: N
- `depends_on` trovati: lista
- `used_by` trovati: lista
- File con header mancante (creato da zero): lista nomi
