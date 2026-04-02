import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SCAN_PATHS_FILE = path.join(__dirname, 'scan-paths.json');

export function loadScanPaths() {
  try {
    if (fs.existsSync(SCAN_PATHS_FILE)) {
      return JSON.parse(fs.readFileSync(SCAN_PATHS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

export function saveScanPaths(paths) {
  fs.writeFileSync(SCAN_PATHS_FILE, JSON.stringify(paths, null, 2));
}

/**
 * Converti path progetto nel nome directory Claude
 * Es: C:\BIZ2017\BNEGS076 → C--BIZ2017-BNEGS076
 */
function pathToClaudeDirName(projectPath) {
  const base = projectPath
    .replace(/:\\/g, '--')
    .replace(/\\/g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-/, '');
  // Claude Code sostituisce ogni byte non-ASCII con '-'
  // (es. 'à' = 2 byte UTF-8 → '--')
  return base.replace(/[^\x00-\x7F]/g, c => '-'.repeat(Buffer.byteLength(c, 'utf8')));
}

/**
 * Scansiona le cartelle radice configurate e trova le sottocartelle
 * con sessioni Claude Code attive.
 * @param {string[]} rootPaths - Percorsi radice da scansionare
 * @param {string[]} excludedPaths - Percorsi da escludere
 * @returns {Array<{name, path, claudeDir, sessionCount}>}
 */
export function discoverFromRoots(rootPaths, excludedPaths = [], maxDepth = 2) {
  const projects = [];
  const seenPaths = new Set();
  const seenNames = new Map(); // name → count, per gestire duplicati

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    console.log('⚠️  Directory sessioni Claude non trovata:', CLAUDE_PROJECTS_DIR);
    return projects;
  }

  console.log('🗂️  Scansione percorsi radice...');

  function scanDir(dirPath, depth) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(d => d.isDirectory());
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Salta percorsi esclusi
      if (excludedPaths.some(ep => ep.toLowerCase() === fullPath.toLowerCase())) continue;
      // Salta già visti
      if (seenPaths.has(fullPath.toLowerCase())) continue;

      // Controlla se esiste una sessione Claude per questo percorso
      const claudeDirName = pathToClaudeDirName(fullPath);
      const claudeProjectDir = path.join(CLAUDE_PROJECTS_DIR, claudeDirName);

      if (fs.existsSync(claudeProjectDir)) {
        let sessionFiles;
        try {
          sessionFiles = fs.readdirSync(claudeProjectDir).filter(f => f.endsWith('.jsonl'));
        } catch {
          sessionFiles = [];
        }

        if (sessionFiles.length > 0) {
          seenPaths.add(fullPath.toLowerCase());

          // Calcola nome univoco: se il nome è già usato, aggiungi il parent
          let name = entry.name;
          if (seenNames.has(name.toLowerCase())) {
            name = `${path.basename(dirPath)}-${entry.name}`;
          }
          seenNames.set(name.toLowerCase(), true);

          projects.push({
            name,
            path: fullPath,
            claudeDir: claudeDirName,
            sessionCount: sessionFiles.length
          });
          continue; // non scende ulteriormente se ha già una sessione
        }
      }

      // Scendi nella sottocartella se non abbiamo raggiunto la profondità massima
      if (depth < maxDepth) {
        scanDir(fullPath, depth + 1);
      }
    }
  }

  for (const rootPath of rootPaths) {
    if (!fs.existsSync(rootPath)) {
      console.log(`  ⚠️  Percorso non trovato: ${rootPath}`);
      continue;
    }
    const before = projects.length;
    scanDir(rootPath, 1);
    console.log(`  📁 ${rootPath}: ${projects.length - before} progetti con sessioni`);
  }

  console.log(`\n✅ Totale trovati: ${projects.length} progetti\n`);
  return projects;
}

/**
 * Controlla se un singolo path ha sessioni Claude attive
 */
export function hasClaudeSession(projectPath) {
  const claudeDirName = pathToClaudeDirName(projectPath);
  const claudeProjectDir = path.join(CLAUDE_PROJECTS_DIR, claudeDirName);
  if (!fs.existsSync(claudeProjectDir)) return false;
  try {
    return fs.readdirSync(claudeProjectDir).some(f => f.endsWith('.jsonl'));
  } catch {
    return false;
  }
}
