import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { ClaudeSessionWatcher } from './claude-watcher.js';
import { discoverFromRoots, loadScanPaths, saveScanPaths } from './path-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;

// ── File di persistenza ──────────────────────────────────────
const EXCLUDED_PATHS_FILE = path.join(__dirname, 'excluded-paths.json');

function loadExcludedPaths() {
  try {
    if (fs.existsSync(EXCLUDED_PATHS_FILE)) {
      return JSON.parse(fs.readFileSync(EXCLUDED_PATHS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveExcludedPaths(paths) {
  fs.writeFileSync(EXCLUDED_PATHS_FILE, JSON.stringify(paths, null, 2));
}

// ── Discovery iniziale ───────────────────────────────────────
const excludedPaths = loadExcludedPaths();
const scanPaths = loadScanPaths();

let config;

if (scanPaths.length > 0) {
  console.log(`🗂️  Modalità SCAN ROOTS (${scanPaths.length} percorsi configurati)\n`);
  const discovered = discoverFromRoots(scanPaths, excludedPaths);

  // Merge con config.json manuale se esiste
  try {
    const manualConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8')
    );
    const discoveredPaths = new Set(discovered.map(p => p.path.toLowerCase()));
    const manualOnly = manualConfig.projects.filter(p =>
      !discoveredPaths.has(p.path.toLowerCase()) &&
      !excludedPaths.some(ep => ep.toLowerCase() === p.path.toLowerCase())
    );
    const seenNames = new Set();
    const merged = [...manualOnly, ...discovered].filter(p => {
      if (seenNames.has(p.name)) return false;
      seenNames.add(p.name);
      return true;
    });
    config = { projects: merged };
    console.log(`📋 +${manualOnly.length} progetti da config.json`);
  } catch {
    config = { projects: discovered };
  }
} else {
  // Fallback: leggi da config.json
  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
    console.log(`📋 Caricati ${config.projects.length} progetti da config.json\n`);
  } catch {
    console.warn('⚠️  Nessun percorso configurato. Aggiungi percorsi dall\'area Admin.');
    config = { projects: [] };
  }
}

console.log(`📊 Progetti monitorati: ${config.projects.length}\n`);

// ── Express + WebSocket ──────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

// ── Watcher ──────────────────────────────────────────────────
const projectWatcher = new ClaudeSessionWatcher(config.projects, broadcastStatus);
projectWatcher.start();

// ── WebSocket ────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('🔌 Nuovo client connesso');
  clients.add(ws);

  ws.send(JSON.stringify({
    type: 'config',
    projects: config.projects.map(p => ({ name: p.name, path: p.path }))
  }));

  ws.on('close', () => { clients.delete(ws); });
  ws.on('error', () => { clients.delete(ws); });
});

function broadcastConfigUpdate() {
  const msg = JSON.stringify({
    type: 'config',
    projects: config.projects.map(p => ({ name: p.name, path: p.path }))
  });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

function broadcastStatus(data) {
  const msg = JSON.stringify({ type: 'status', data });
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// ── API: Progetto ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', projects: config.projects.length });
});

app.get('/api/projects', (req, res) => {
  res.json(config.projects);
});

app.post('/api/projects/:projectName/mark-checked', (req, res) => {
  const { projectName } = req.params;
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

  projectWatcher.markAsChecked(projectName);
  res.json({ success: true });
});

app.post('/api/projects/:projectName/exclude', (req, res) => {
  const { projectName } = req.params;
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

  const excluded = loadExcludedPaths();
  if (!excluded.some(ep => ep.toLowerCase() === project.path.toLowerCase())) {
    excluded.push(project.path);
    saveExcludedPaths(excluded);
  }

  projectWatcher.removeProject(projectName);
  config.projects = config.projects.filter(p => p.name !== projectName);
  broadcastConfigUpdate();

  console.log(`🚫 ${projectName} (${project.path}) escluso`);
  res.json({ success: true, projectName });
});

app.post('/api/projects/:projectName/open-terminal', (req, res) => {
  const { projectName } = req.params;
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  if (!fs.existsSync(project.path)) return res.status(404).json({ error: 'Directory non trovata' });

  const command = `start cmd.exe /K "cd /d "${project.path}""`;
  exec(command, (error) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, projectPath: project.path });
  });
});

// ── API: Rilevamento finestra terminale ──────────────────────
app.get('/api/projects/:projectName/terminal-windows', (req, res) => {
  const { projectName } = req.params;
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

  // Lo script PS cerca:
  // 1. Finestre terminale con il nome del progetto nel titolo
  // 2. Processo Claude Code CLI reale (non MCP server, non dashboard) → risale al terminale padre
  const psScript = `
$results = @()
$seen = @{}

# 1. Finestre con nome progetto nel titolo (cmd, wt, code, ecc.)
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | ForEach-Object {
  if ($_.MainWindowTitle -like '*${projectName}*') {
    if (-not $seen[$_.Id]) {
      $seen[$_.Id] = $true
      $results += [PSCustomObject]@{ pid=$_.Id; name=$_.ProcessName; title=$_.MainWindowTitle; match='titolo' }
    }
  }
}

# 2. Trova processi Claude Code CLI reali (esclude MCP server, plugin, dashboard, vite, concurrently)
try {
  $claudeProcs = Get-WmiObject Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $cl = $_.CommandLine
    $cl -and
    ($cl -like '*@anthropic-ai*' -or $cl -like '*claude-code*' -or $cl -like '*\\claude\\*') -and
    $cl -notlike '*mcp-server*' -and
    $cl -notlike '*plugins*' -and
    $cl -notlike '*concurrently*' -and
    $cl -notlike '*vite*' -and
    $cl -notlike '*DashboardClaudeCode*'
  }

  foreach ($proc in $claudeProcs) {
    # Risali al terminale padre (max 2 livelli: node -> shell -> wt)
    $parentId = $proc.ParentProcessId
    $parent = Get-Process -Id $parentId -ErrorAction SilentlyContinue

    if ($parent -and -not $parent.MainWindowTitle) {
      $gpWmi = Get-WmiObject Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
      if ($gpWmi) {
        $gp = Get-Process -Id $gpWmi.ParentProcessId -ErrorAction SilentlyContinue
        if ($gp -and $gp.MainWindowTitle) { $parent = $gp }
      }
    }

    if ($parent -and -not $seen[$parent.Id]) {
      $seen[$parent.Id] = $true
      $title = if ($parent.MainWindowTitle) { $parent.MainWindowTitle } else { $parent.ProcessName }
      $results += [PSCustomObject]@{ pid=$parent.Id; name=$parent.ProcessName; title=$title; match='terminale-claude' }
    }
  }
} catch {}

if ($results.Count -eq 0) { '[]' } else { $results | ConvertTo-Json -Depth 1 -Compress }
`;

  // -EncodedCommand evita tutti i problemi di escaping
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

  exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
    { timeout: 10000 },
    (error, stdout, stderr) => {
      if (error) {
        console.error('PS error:', error.message, stderr);
        return res.json({ windows: [], error: error.message });
      }
      try {
        const trimmed = stdout.trim();
        if (!trimmed || trimmed === '[]') return res.json({ windows: [] });
        const raw = JSON.parse(trimmed);
        const windows = Array.isArray(raw) ? raw : [raw];
        res.json({ windows });
      } catch {
        res.json({ windows: [] });
      }
    }
  );
});

// ── API: Admin - Scan Paths ──────────────────────────────────
app.get('/api/admin/scan-paths', (req, res) => {
  res.json({ paths: loadScanPaths() });
});

app.post('/api/admin/scan-paths', (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath || typeof newPath !== 'string') {
    return res.status(400).json({ error: 'Path non valido' });
  }
  const paths = loadScanPaths();
  if (!paths.some(p => p.toLowerCase() === newPath.toLowerCase())) {
    paths.push(newPath);
    saveScanPaths(paths);
  }
  res.json({ success: true, paths });
});

app.delete('/api/admin/scan-paths/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  const paths = loadScanPaths();
  if (isNaN(idx) || idx < 0 || idx >= paths.length) {
    return res.status(400).json({ error: 'Indice non valido' });
  }
  paths.splice(idx, 1);
  saveScanPaths(paths);
  res.json({ success: true, paths });
});

app.post('/api/admin/rescan', (req, res) => {
  const currentScanPaths = loadScanPaths();
  const currentExcluded = loadExcludedPaths();

  if (currentScanPaths.length === 0) {
    return res.json({ added: 0, total: config.projects.length });
  }

  const discovered = discoverFromRoots(currentScanPaths, currentExcluded);
  const existingPaths = new Set(config.projects.map(p => p.path.toLowerCase()));

  let added = 0;
  for (const project of discovered) {
    if (!existingPaths.has(project.path.toLowerCase())) {
      config.projects.push(project);
      projectWatcher.addNewProject(project);
      added++;
    }
  }

  if (added > 0) broadcastConfigUpdate();

  console.log(`🔄 Rescan: trovati ${discovered.length}, aggiunti ${added} nuovi`);
  res.json({ added, total: config.projects.length, found: discovered.length });
});

app.get('/api/admin/excluded-paths', (req, res) => {
  res.json({ paths: loadExcludedPaths() });
});

app.delete('/api/admin/excluded-paths/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  const paths = loadExcludedPaths();
  if (isNaN(idx) || idx < 0 || idx >= paths.length) {
    return res.status(400).json({ error: 'Indice non valido' });
  }
  paths.splice(idx, 1);
  saveExcludedPaths(paths);
  res.json({ success: true, paths });
});

// ── Avvio ────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Dashboard Claude Code Backend');
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`📊 ${config.projects.length} progetti monitorati`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

process.on('SIGINT', () => {
  projectWatcher.stop();
  server.close(() => process.exit(0));
});
