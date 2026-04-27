Traccia la catena di dipendenze di un modulo BIZ2017 usando il grafo esistente. Risponde a: "Se modifico X, cosa rischio di rompere?"

## Quando usarlo
- Prima di modificare un modulo: scopri chi dipende da te
- Prima di un rilascio: verifica l'impatto cross-modulo
- Per capire perché un bug si propaga

## Argomento
`/impactanalysis BNEG0185` — il nome modulo (case insensitive)

Se non specificato, usa il nome della directory corrente.

---

**Passaggio 1 — Identifica il modulo target**

- Se argomento fornito: usa quello (normalizza uppercase, es. `bneg0185` → `BNEG0185`)
- Se non fornito: prendi ultimo componente del cwd

**Passaggio 2 — Leggi il grafo**

Leggi `C:\Progetti Pilota\DashboardClaudeCode\grafo\graph_data.json`.

Costruisci due mappe dalla lista `links`:
- `chiama[source]` = lista di target (cosa chiama ogni modulo)
- `chiamato_da[target]` = lista di source (chi chiama ogni modulo)

**Passaggio 3 — Analisi impatto (chi dipende da me)**

BFS da `{modulo}` usando `chiamato_da`, massimo 3 livelli:

```
Livello 1: chi chiama direttamente {modulo}
Livello 2: chi chiama i moduli del livello 1
Livello 3: chi chiama i moduli del livello 2
```

Aggiungi descrizione da `node.desc` per ogni modulo trovato.

**Passaggio 4 — Analisi dipendenze (cosa chiamo io)**

Lista diretta da `chiama[{modulo}]` — un solo livello, no ricorsione.

**Passaggio 5 — Output**

```
# Impact Analysis — {MODULO}
{desc del modulo}

## Chi dipende da me (rischio rottura)

### Livello 1 — Dipendenza diretta ({N} moduli)
- BNEG0069 — Programma per elaborazioni notturne
- BNEG0044 — lancio dll da pianificazione

### Livello 2 — Dipendenza indiretta ({N} moduli)
- ...

### Livello 3 — Dipendenza transitiva ({N} moduli)
- ...

## Cosa chiamo io (dipendenze dirette)
- BNEGBASE — PRJ.FUNZIONI STANDARD EGM
- BNEGZOOM — PRJ.ZOOM EGM

## Riepilogo rischio
- Moduli a rischio diretto: N
- Moduli a rischio totale (1-3 livelli): N
- ⚠️ Moduli critici (>5 dipendenti): lista
```

**Regole:**
- Se modulo non trovato nel grafo: avvisa l'utente e suggerisci di eseguire `/refreshcodebase`
- Non mostrare il modulo stesso nella lista dipendenti
- Deduplicare: se stesso modulo appare in più livelli, tienilo solo al livello più vicino
