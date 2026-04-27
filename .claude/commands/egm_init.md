Devi analizzare l'architettura del progetto corrente e generare documentazione tecnica nella wiki Obsidian.

## Quando usarlo
- Prima volta su un progetto: genera la mappa completa
- Dopo un refactor significativo: rigenera tutto da zero
- NON usare per aggiornamenti incrementali → usa /aggiornawiki

**ATTENZIONE:** questo comando rigenera l'intera cartella `Architettura/{cartella}/{modulo}/`. I file esistenti per quel modulo vengono sovrascritti. Moduli diversi nella stessa cartella non si toccano.

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
- Directory radice da analizzare = cwd completo

**Passaggio 3 — Scansiona i file sorgente**

Elenca i file sorgente nella directory corrente (ricorsivo):
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

**Passaggio 4 — Classifica i file per profondità di analisi**

Assegna ogni file a uno dei tre livelli in base al suo percorso. Se il percorso non è classificabile con certezza, leggi brevemente il file e decidi in base al contenuto.

**COMPACT** — file raggruppati in una pagina unica per categoria, nessuna pagina individuale:
- C#: path contiene `Models/`, `Entities/`, `DTOs/`, `Dto/`, `ViewModels/`, `Requests/`, `Responses/`
- Python: path contiene `schemas/`, `models/` (se Pydantic/SQLAlchemy)
- TypeScript: path contiene `types/`, `interfaces/`, `models/`
- VB.NET: classi con sole proprietà, senza logica
- Regola contenuto: se il file ha solo proprietà/campi e nessun metodo con logica reale → COMPACT

**MEDIUM** — una pagina per file, analisi concisa (elenco endpoint/componenti, no logica interna):
- C#: path contiene `Controllers/`, `Common/`, `Extensions/`, `Helpers/`
- React/TS: path contiene `components/`, `pages/`
- Python: path contiene `routes/`, `views/`
- VB.NET: form con UI ma logica minima

**DEEP** — una pagina per file, analisi completa con logica, query, dipendenze:
- C#: path contiene `Services/`, `Middleware/`, `Filters/`, `Handlers/`, `Managers/`; oppure file radice (`Program.cs`, `Startup.cs`, `ConnectionManager.cs`)
- Python: path contiene `services/`, `logic/`, `tasks/`, `business/`
- React/TS: path contiene `hooks/`, `context/`, `store/`, `reducers/`
- VB.NET: form o moduli con logica di business, query SQL, calcoli

Produci un riepilogo interno prima di proseguire:
```
COMPACT ({n} file) → _models.md, _dtos.md, _utility.md [raggruppati]
MEDIUM  ({n} file) → ArticoliController.md, OrdiniController.md, ...
DEEP    ({n} file) → ArticoloService.md, Program.md, Middleware.md, ...
```

**Passaggio 5 — Analizza e scrivi le pagine Architettura**

Percorso base: `{wikiPath}\Architettura\{cartella}\{modulo}\`

---

### Modalità COMPACT

Leggi tutti i file COMPACT velocemente. Raggruppa per tipo in pagine riassuntive:

- `_models.md` — classi dati/entità/DTO
- `_utility.md` — helper, extension methods, common

Formato per ogni pagina COMPACT:

````markdown
---
layer: data
last_analyzed: {YYYY-MM-DD}
---

# Modelli — {modulo}

| Classe | File | Proprietà principali |
|--------|------|---------------------|
| `{NomeClasse}` | `{file.cs}` | {prop1}, {prop2}, {prop3} |
````

---

### Modalità MEDIUM

Per ogni file MEDIUM, scrivi `{nome-file}.md`:

````markdown
---
layer: api
depends_on:
  - {ServiceChiamato}
last_analyzed: {YYYY-MM-DD}
---

# {NomeController / NomeComponent}

## Endpoint / Responsabilità

| Metodo | Route / Prop | Descrizione | Chiama |
|--------|-------------|-------------|--------|
| `GET` | `/api/v1/...` | {cosa fa} | `{Service}.{Metodo}` |

## Note

{Solo se c'è qualcosa di non ovvio: filtri, autorizzazioni, comportamenti speciali}
````

---

### Modalità DEEP

Per ogni file DEEP, scrivi `{nome-file}.md`:

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

{Se presenti — incolla le query significative in blocco codice}

## Dipendenze

- `{file-o-modulo}` — {perché è usato}

## Note

{Vincoli, comportamenti non ovvi, ⚠️ da verificare: {dubbio} se ambiguo}
````

---

**Passaggio 6 — Scrivi l'overview**

Scrivi `{wikiPath}\Architettura\{cartella}\{modulo}\_overview.md`:

````markdown
---
last_analyzed: {YYYY-MM-DD}
---

# {modulo} — Architettura

## Layer Diagram

```
[infrastructure] → Program.cs, ConnectionManager, Middleware
[api]            → {controller1}, {controller2}
[service]        → {service1}, {service2}
[data]           → _models.md ({n} classi)
[utility]        → _utility.md ({n} classi)
```

## File analizzati

| File | Livello | Layer | Scopo |
|------|---------|-------|-------|
| [[_models]] | compact | data | {n} modelli/DTO |
| [[{controller}]] | medium | api | {scopo} |
| [[{service}]] | deep | service | {scopo} |

## Dipendenze Principali

{Grafico testuale delle dipendenze più importanti tra i file DEEP}

## Entry Points

{Quali file sono i punti di ingresso del sistema}
````

**Passaggio 7 — Aggiungi wikilinks verso Sessioni/**

Controlla se esistono file in `{wikiPath}\Sessioni\{cartella}\`.
Se esistono, aggiungi nell'`_overview.md`:
```markdown
## Sessioni di lavoro

- [[Sessioni/{cartella}/{modulo}]]
```

**Passaggio 8 — Aggiorna index radice**

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
- Naming convention stabile: nome wiki = nome file sorgente senza estensione. Non cambiare mai questo nome — i link da Sessioni/ dipendono da esso.
- Le pagine COMPACT (`_models.md`, `_utility.md`) non compaiono nell'overview come link individuali — solo come riga aggregata.
- Audience: sviluppatori tecnici
- Conferma all'utente: quanti file per livello (compact/medium/deep), quante pagine wiki create, percorso overview.
- **Accuratezza:** scrivi solo ciò che è esplicitamente leggibile nel codice. Se il comportamento di una funzione o dipendenza non è chiaro dalla lettura, chiedi all'utente prima di scrivere — non inventare. Se qualcosa rimane ambiguo dopo la risposta, segnalalo nella sezione Note con `⚠️ da verificare: {dubbio}`.
