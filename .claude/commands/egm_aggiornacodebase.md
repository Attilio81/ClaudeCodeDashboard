Devi aggiornare incrementalmente la documentazione architetturale nella wiki Obsidian, analizzando solo i file sorgente cambiati dall'ultima analisi.

## Quando usarlo
- Dopo modifiche puntuali: aggiorna solo i file toccati
- NON usare per la prima analisi → usa /analizzacodebase
- NON usare dopo refactor grossi (rinominazioni, ristrutturazioni) → usa /analizzacodebase

**Nota:** gestisce dipendenze cross-file tramite propagazione inversa del campo `depends_on`. Dipendenze implicite non documentate non vengono rilevate — per consistenza totale usa /analizzacodebase.

---

**Passaggio 1 — Recupera il percorso wiki**

Leggi il file:
`C:\Users\attilio.pregnolato.EGMSISTEMI\.claude\wiki-config.json`

Estrai il campo `wikiPath`.

**Passaggio 2 — Identifica il progetto**

Dal cwd corrente (esegui `pwd` se non lo conosci), calcola:
- Normalizza il path: `/c/BIZ2017/BNEG0112` → `C:\BIZ2017\BNEG0112`
- `cartella` = penultimo componente (es. `BIZ2017`)
- `modulo` = ultimo componente lowercase (es. `bneg0112`)
- `wikiDir` = `{wikiPath}\Architettura\{cartella}\{modulo}`

**Passaggio 3 — Scansiona i file sorgente**

Elenca tutti i file sorgente nella directory corrente (ricorsivo):
```bash
find . -type f \( -iname "*.js" -o -iname "*.ts" -o -iname "*.jsx" -o -iname "*.tsx" -o -iname "*.py" -o -iname "*.cs" -o -iname "*.vb" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/build/*" \
  ! -path "*/vendor/*" \
  ! -path "*/.git/*" \
  ! -path "*/.vs/*" \
  ! -path "*/bin/*" \
  ! -path "*/obj/*"
```

**Passaggio 4 — Classifica ogni file sorgente**

Per ogni file trovato, determina la categoria:

**A) File nuovo** — il wiki doc corrispondente non esiste in `{wikiDir}\{nome-file}.md`
→ aggiungi a lista `da_analizzare`

**B) File modificato** — il wiki doc esiste. Controlla data ultima modifica git:
```bash
git log --format="%ai" -1 -- {percorso-file}
```
Se la data git è successiva al campo `last_analyzed` nel frontmatter del wiki doc → aggiungi a lista `da_analizzare`
Se non ci sono commit per il file (untracked), usa data filesystem:
```bash
stat -c "%y" {percorso-file}
```

**C) File invariato** — data git ≤ `last_analyzed` → skip

**Passaggio 5 — Rileva file orfani**

Controlla i file `.md` in `{wikiDir}\` (escludi `_overview.md`).
Per ogni wiki doc, verifica che esista il file sorgente corrispondente.
Se non esiste → aggiungi a lista `orfani` (da segnalare, non eliminare automaticamente).

**Passaggio 6 — Propagazione inversa dipendenze**

Per ogni file in `da_analizzare`, ricava il nome base (es. `clienti.vb` → `clienti`).

Per ogni wiki doc esistente in `{wikiDir}\`:
- Leggi il frontmatter
- Se `depends_on` contiene il nome base → il file sorgente corrispondente potrebbe essere stale
- Aggiungi quel file sorgente a `da_analizzare` se non già presente

Ripeti finché la lista `da_analizzare` non si stabilizza (al massimo 2 iterazioni — evita loop).

**Passaggio 7 — Analizza i file in da_analizzare**

Prima di analizzare, classifica ogni file in `da_analizzare` per profondità:

**COMPACT** — path contiene `Models/`, `Entities/`, `DTOs/`, `Dto/`, `ViewModels/`, `Requests/`, `Responses/`, `types/`, `interfaces/`, `schemas/`; oppure file con sole proprietà e nessuna logica → raggruppa in pagina `_models.md` esistente (aggiorna solo le righe dei file modificati)

**MEDIUM** — path contiene `Controllers/`, `Common/`, `Extensions/`, `Helpers/`, `components/`, `pages/`, `routes/` → una pagina concisa per file

**DEEP** — path contiene `Services/`, `Middleware/`, `Filters/`, `Handlers/`, `hooks/`, `context/`, `store/`; oppure file radice (`Program.cs`, `Startup.cs`, `ConnectionManager.cs`) → analisi completa

Se path non classificabile, leggi brevemente e decidi da contenuto.

---

Per file **COMPACT**: aggiorna la riga corrispondente in `{wikiDir}\_models.md` (o `_utility.md`). Non creare pagine individuali.

Per file **MEDIUM**, scrivi/sovrascrivi `{wikiDir}\{nome-file}.md`:

````markdown
---
layer: api
depends_on:
  - {ServiceChiamato}
last_analyzed: {YYYY-MM-DD}
---

# {NomeFile}

## Endpoint / Responsabilità

| Metodo | Route / Prop | Descrizione | Chiama |
|--------|-------------|-------------|--------|
| `GET` | `/api/v1/...` | {cosa fa} | `{Service}.{Metodo}` |

## Note

{Solo se c'è qualcosa di non ovvio}
````

Per file **DEEP**, scrivi/sovrascrivi `{wikiDir}\{nome-file}.md`:

````markdown
---
layer: {service|middleware|infrastructure}
depends_on:
  - {dipendenza1}
  - {dipendenza2}
last_analyzed: {YYYY-MM-DD}
---

# {NomeFile}

## Scopo

{Cosa fa in 2-3 frasi}

## Funzioni / Metodi Principali

| Nome | Input | Output | Descrizione |
|------|-------|--------|-------------|
| `{Metodo}` | {params} | {return} | {cosa fa} |

## Logica rilevante

{Pattern usati, algoritmi, decisioni architetturali non ovvie}

## Query SQL principali

{Se presenti}

## Dipendenze

- `{file-o-modulo}` — {perché è usato}

## Note

{Vincoli, comportamenti non ovvi, ⚠️ da verificare: {dubbio} se ambiguo}
````

**Passaggio 8 — Rigenera _overview.md**

Se almeno un file è stato aggiornato o creato, rigenera `{wikiDir}\_overview.md` leggendo i frontmatter di tutti i wiki doc esistenti (non rileggere i sorgenti — usa solo i dati già in wiki):

````markdown
---
last_analyzed: {YYYY-MM-DD}
---

# {modulo} — Architettura

## Layer Diagram

```
[ui]       → {file-ui1}, {file-ui2}
[api]      → {file-api1}
[service]  → {file-service1}, {file-service2}
[data]     → {file-data1}
[utility]  → {file-util1}
```

## Moduli

| File | Layer | Scopo |
|------|-------|-------|
| [[{nome-file}]] | {layer} | {scopo breve} |

## Dipendenze Principali

{Grafico testuale delle dipendenze più importanti}

## Entry Points

{Quali file sono i punti di ingresso del sistema}
````

Controlla anche wikilinks Sessioni/ — se `{wikiPath}\Sessioni\{cartella}\` contiene file, aggiungi:
```markdown
## Sessioni di lavoro

- [[Sessioni/{cartella}/{modulo}]]
```

**Passaggio 9 — Rapporto finale**

Comunica all'utente:
- `{N} file aggiornati`: lista nomi
- `{N} file nuovi`: lista nomi
- `{N} file invariati`: solo conteggio
- `{N} file orfani`: lista nomi + avviso "verificare se eliminare manualmente da wiki"
- Percorso overview: `{wikiDir}\_overview.md`

**Passaggio 10 — Aggiorna index radice**

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
2. Cerca riga `{modulo}` nella tabella — se manca, aggiungila con `—` in tutte le colonne
3. Aggiorna colonna **Architettura**: sostituisci `—` con `[[Architettura/{cartella}/{modulo}/_overview|✓]]` (se già ha un link, lascia invariato)
4. Aggiorna `last_updated: {YYYY-MM-DD}`

**Regole:**
- Non eliminare mai file wiki automaticamente — solo segnala orfani
- Naming convention stabile: nome wiki = nome file sorgente senza estensione
- La propagazione dipendenze è limitata a 2 iterazioni — se ci sono dipendenze circolari non si blocca
- Audience: sviluppatori tecnici
- **Accuratezza:** scrivi solo ciò che è esplicitamente leggibile nel codice. Se il comportamento di una funzione o dipendenza non è chiaro dalla lettura, chiedi all'utente prima di scrivere — non inventare. Se qualcosa rimane ambiguo dopo la risposta, segnalalo nella sezione Note con `⚠️ da verificare: {dubbio}`.
