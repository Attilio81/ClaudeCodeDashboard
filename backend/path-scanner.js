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
  return projectPath
    .replace(/:\\/g, '--')
    .replace(/\\/g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-/, '');
}

/**
 * Scansiona le cartelle radice configurate e trova le sottocartelle
 * con sessioni Claude Code attive.
 * @param {string[]} rootPaths - Percorsi radice da scansionare
 * @param {string[]} excludedPaths - Percorsi da escludere
 * @returns {Array<{name, path, claudeDir, sessionCount}>}
 */
export function discoverFromRoots(rootPaths, excludedPaths = []) {
  const projects = [];
  const seenNames = new Set();

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    console.log('⚠️  Directory sessioni Claude non trovata:', CLAUDE_PROJECTS_DIR);
    return projects;
  }

  console.log('🗂️  Scansione percorsi radice...');

  for (const rootPath of rootPaths) {
    if (!fs.existsSync(rootPath)) {
      console.log(`  ⚠️  Percorso non trovato: ${rootPath}`);
      continue;
    }

    let subdirs;
    try {
      subdirs = fs.readdirSync(rootPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => ({ name: d.name, fullPath: path.join(rootPath, d.name) }));
    } catch (error) {
      console.log(`  ⚠️  Errore lettura ${rootPath}: ${error.message}`);
      continue;
    }

    let found = 0;
    for (const subdir of subdirs) {
      // Salta percorsi esclusi
      if (excludedPaths.some(ep => ep.toLowerCase() === subdir.fullPath.toLowerCase())) {
        continue;
      }

      // Salta nomi duplicati
      if (seenNames.has(subdir.name)) continue;

      // Controlla se esiste una sessione Claude per questo percorso
      const claudeDirName = pathToClaudeDirName(subdir.fullPath);
      const claudeProjectDir = path.join(CLAUDE_PROJECTS_DIR, claudeDirName);

      if (!fs.existsSync(claudeProjectDir)) continue;

      let sessionFiles;
      try {
        sessionFiles = fs.readdirSync(claudeProjectDir).filter(f => f.endsWith('.jsonl'));
      } catch {
        continue;
      }

      if (sessionFiles.length === 0) continue;

      seenNames.add(subdir.name);
      found++;
      projects.push({
        name: subdir.name,
        path: subdir.fullPath,
        claudeDir: claudeDirName,
        sessionCount: sessionFiles.length
      });
    }

    console.log(`  📁 ${rootPath}: ${found} progetti con sessioni`);
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
