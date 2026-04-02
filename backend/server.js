import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { ClaudeSessionWatcher } from './claude-watcher.js';
import { discoverFromRoots, loadScanPaths, saveScanPaths } from './path-scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;

// ── Helper: esegui script PS da file temp (evita limite 8191 char) ──
function runPsFile(script, timeoutMs, callback) {
  const tmpFile = path.join(os.tmpdir(), `ccd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.ps1`);
  // UTF-8 BOM: PowerShell 5.1 legge correttamente caratteri non-ASCII
  fs.writeFileSync(tmpFile, '\ufeff' + script, 'utf-8');
  exec(
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { timeout: timeoutMs },
    (error, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      callback(error, stdout, stderr);
    }
  );
}

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
const projectWatcher = new ClaudeSessionWatcher(config.projects, broadcastStatus, broadcastConfigUpdate);
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

// ── Leggi slug dalla sessione più recente del progetto ───────
function readProjectSlug(projectPath) {
  try {
    const claudeDirName = projectPath
      .replace(/:\\/g, '--').replace(/\\/g, '-')
      .replace(/\//g, '-').replace(/\s+/g, '-').replace(/^-/, '')
      .replace(/[^\x00-\x7F]/g, c => '-'.repeat(Buffer.byteLength(c, 'utf8')));
    const claudeDir = path.join(
      process.env.USERPROFILE || process.env.HOME,
      '.claude', 'projects', claudeDirName
    );
    if (!fs.existsSync(claudeDir)) return null;
    const files = fs.readdirSync(claudeDir).filter(f => f.endsWith('.jsonl'));
    if (!files.length) return null;
    const latest = files
      .map(f => ({ f, m: fs.statSync(path.join(claudeDir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0].f;
    const lines = fs.readFileSync(path.join(claudeDir, latest), 'utf-8')
      .trim().split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      try { const e = JSON.parse(line); if (e.slug) return e.slug; } catch {}
    }
  } catch {}
  return null;
}

// ── API: Rilevamento finestra terminale ──────────────────────
app.get('/api/projects/:projectName/terminal-windows', (req, res) => {
  const { projectName } = req.params;
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });

  // Leggi lo slug dalla sessione corrente per cercare nei titoli finestre
  const slug = readProjectSlug(project.path);
  // Windows Terminal mostra il task nel titolo tab, es: "✦ aggiorna documentazione e repo"
  // Lo slug è tipo "aggiorna-documentazione-repo", lo convertiamo in parole per il confronto
  const slugWords = slug ? slug.replace(/-/g, ' ') : '';

  const psScript = `
$projectPath = '${project.path.replace(/\\/g, '/')}'
$sessionsDir = [System.IO.Path]::Combine($env:USERPROFILE, '.claude', 'sessions')

$results = @()

# 1. Cerca nelle sessioni attive di Claude quella con cwd = projectPath
if (Test-Path $sessionsDir) {
    Get-ChildItem $sessionsDir -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $s = Get-Content $_.FullName -Raw | ConvertFrom-Json
            if ($s.cwd -and $s.cwd.Replace('\','/').ToLower() -eq $projectPath.ToLower() -and $s.pid) {
                # Trovata sessione per questo progetto — risali al terminale padre
                $claudePid = [int]$s.pid
                $cur = $claudePid
                $visited = @{}
                $termPid = 0
                $termName2 = ''

                for ($i = 0; $i -lt 6; $i++) {
                    if ($visited[$cur]) { break }
                    $visited[$cur] = $true
                    $proc = Get-Process -Id $cur -ErrorAction SilentlyContinue
                    if (-not $proc) { break }
                    if ($proc.ProcessName -eq 'WindowsTerminal' -or $proc.ProcessName -eq 'cmd') {
                        $termPid = $cur
                        $termName2 = $proc.ProcessName
                        break
                    }
                    $parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -EA SilentlyContinue).ParentProcessId
                    if (-not $parentPid -or $parentPid -eq $cur) { break }
                    $cur = [int]$parentPid
                }

                if ($termPid -ne 0) {
                    $termProc = Get-Process -Id $termPid -ErrorAction SilentlyContinue
                    if ($termProc -and $termProc.MainWindowHandle -ne [IntPtr]::Zero) {
                        # Usa UIAutomation per trovare la tab esatta in Windows Terminal
                        try {
                            Add-Type -AssemblyName UIAutomationClient -ErrorAction SilentlyContinue
                            Add-Type -AssemblyName UIAutomationTypes -ErrorAction SilentlyContinue
                            $root = [System.Windows.Automation.AutomationElement]::FromHandle($termProc.MainWindowHandle)
                            $tabCond = New-Object System.Windows.Automation.PropertyCondition(
                                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                                [System.Windows.Automation.ControlType]::TabItem
                            )
                            $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond)
                            $tabIndex = 0
                            foreach ($tab in $tabs) {
                                $tabTitle = $tab.Current.Name
                                # Cerca la tab che appartiene a questa sessione Claude
                                $isThisSession = (
                                    ($s.slug -and $tabTitle -like "*$($s.slug -replace '-',' ')*") -or
                                    ($termName2 -ne '' -and $tabTitle -like "*$termName2*")
                                )
                                $results += [PSCustomObject]@{
                                    pid=$termPid; name=$termProc.ProcessName
                                    title=$tabTitle; match=if($isThisSession){'sessione'}else{'terminale'}
                                    tabIndex=$tabIndex
                                }
                                $tabIndex++
                            }
                        } catch {
                            # Fallback senza UIAutomation
                            $results += [PSCustomObject]@{ pid=$termPid; name=$termProc.ProcessName; title=$termProc.MainWindowTitle; match='sessione'; tabIndex=-1 }
                        }
                    }
                }
            }
        } catch {}
    }
}

# 2. Fallback: mostra tutti i WindowsTerminal con finestra visibile
if ($results.Count -eq 0) {
    Get-Process -Name 'WindowsTerminal','cmd' -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.MainWindowTitle) {
            $results += [PSCustomObject]@{ pid=$_.Id; name=$_.ProcessName; title=$_.MainWindowTitle; match='terminale'; claudePid=0 }
        }
    }
}

if ($results.Count -eq 0) { '[]' } else { $results | ConvertTo-Json -Depth 1 -Compress }
`;

  runPsFile(psScript, 10000, (error, stdout, stderr) => {
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
  });
});

// ── API: Porta finestra in primo piano ──────────────────────
app.post('/api/focus-window/:pid', (req, res) => {
  const pid = parseInt(req.params.pid);
  if (isNaN(pid)) return res.status(400).json({ error: 'PID non valido' });

  const title = (req.body?.title || '').replace(/'/g, "''"); // escape single quotes
  const tabIdx = Number.isInteger(req.body?.tabIndex) ? req.body.tabIndex : -1;

  const psScript = `
$targetPid = ${pid}
$titleHint  = '${title}'
$tabIdx     = ${tabIdx}

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ForceWindow {
    [DllImport("user32.dll")] static extern bool EnumWindows(WndProc e, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern int  GetWindowText(IntPtr h, StringBuilder b, int n);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    public delegate bool WndProc(IntPtr h, IntPtr p);

    public static long FindByPid(uint targetPid) {
        long found = 0;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            uint pid2 = 0; GetWindowThreadProcessId(h, out pid2);
            if (pid2 == targetPid) { found = h.ToInt64(); return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static long FindByTitle(string partial) {
        long found = 0;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            var b = new StringBuilder(512); GetWindowText(h, b, 512);
            if (b.Length > 0 && b.ToString().IndexOf(partial, StringComparison.OrdinalIgnoreCase) >= 0)
                { found = h.ToInt64(); return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static bool Focus(long hwndLong) {
        var h = new IntPtr(hwndLong);
        ShowWindow(h, 9);
        // ALT press/release: Windows concede il permesso SetForegroundWindow al thread corrente
        keybd_event(0x12, 0, 0, UIntPtr.Zero);   // ALT down
        keybd_event(0x12, 0, 2, UIntPtr.Zero);   // ALT up
        return SetForegroundWindow(h);
    }
}
'@

function GetParentPid([int]$p) {
    try { $r=(Get-CimInstance Win32_Process -Filter "ProcessId=$p" -EA SilentlyContinue).ParentProcessId; if($r){[int]$r}else{0} } catch{0}
}

$hwnd=[long]0; $cur=$targetPid; $seen=@{}
for($i=0;$i-lt6-and$hwnd-eq0;$i++){
    if($seen[$cur]){break}; $seen[$cur]=$true
    $hwnd=[ForceWindow]::FindByPid([uint]$cur)
    if($hwnd-eq0){ $nx=GetParentPid $cur; if($nx-eq0-or$nx-eq$cur){break}; $cur=$nx }
}
if($hwnd-eq0-and$titleHint-ne''){ $hwnd=[ForceWindow]::FindByTitle($titleHint) }

if ($hwnd -ne 0) {
    $ok = [ForceWindow]::Focus($hwnd)
    # Se specificato un tab index, seleziona la tab via UIAutomation
    if ($tabIdx -ge 0) {
        try {
            Add-Type -AssemblyName UIAutomationClient -EA SilentlyContinue
            Add-Type -AssemblyName UIAutomationTypes -EA SilentlyContinue
            Start-Sleep -Milliseconds 200
            $aeRoot = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$hwnd)
            $tabCond = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::TabItem)
            $tabs = $aeRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants, $tabCond)
            if ($tabIdx -lt $tabs.Count) {
                $tab = $tabs[$tabIdx]
                try {
                    $sp = $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
                    $sp.Select()
                } catch {
                    try {
                        $ip = $tab.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
                        $ip.Invoke()
                    } catch {}
                }
            }
        } catch {}
    }
    if ($ok) { 'ok' } else { 'focus_failed' }
} else { 'not_found' }
`;

  runPsFile(psScript, 10000, (error, stdout) => {
    if (error) return res.status(500).json({ error: error.message });
    const result = stdout.trim();
    if (result === 'not_found') return res.status(404).json({ error: 'Finestra non trovata' });
    res.json({ success: true });
  });
});

// ── API: Debug finestre ──────────────────────────────────────
app.get('/api/debug/windows', (req, res) => {
  const psScript = `
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class WinDbg {
    [DllImport("user32.dll")] static extern bool EnumWindows(WndProc e, IntPtr p);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder b, int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    public delegate bool WndProc(IntPtr h, IntPtr p);
    public static List<string> Scan() {
        var r = new List<string>();
        EnumWindows((h,p) => {
            if(!IsWindowVisible(h)) return true;
            var b=new StringBuilder(512);
            if(GetWindowText(h,b,512)>0){uint pid=0;GetWindowThreadProcessId(h,out pid);r.Add(pid+"|"+b);}
            return true;
        }, IntPtr.Zero);
        return r;
    }
}
'@
$procMap=@{}; Get-Process -EA SilentlyContinue | ForEach-Object { $procMap[$_.Id]=$_.ProcessName }
$all = [WinDbg]::Scan() | ForEach-Object {
    $p=$_ -split '\\|',2; $pid=[int]$p[0]; $title=$p[1]
    $name=if($procMap.ContainsKey($pid)){$procMap[$pid]}else{'unknown'}
    [PSCustomObject]@{pid=$pid;name=$name;title=$title}
}
$all | ConvertTo-Json -Depth 1 -Compress
`;
  runPsFile(psScript, 15000, (error, stdout, stderr) => {
      if (error) return res.json({ error: error.message, stderr });
      try {
        const raw = JSON.parse(stdout.trim() || '[]');
        const windows = Array.isArray(raw) ? raw : [raw];
        res.json({ total: windows.length, windows });
      } catch {
        res.json({ error: 'parse failed', raw: stdout.trim().substring(0, 500) });
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
