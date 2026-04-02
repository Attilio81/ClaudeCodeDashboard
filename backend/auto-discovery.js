import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Percorsi da escludere dal monitoraggio (es. directory di sistema Claude)
const EXCLUDED_PATHS = [
  path.join(os.homedir(), '.claude'),
  path.join(os.homedir(), '.claude', 'projects'),
];

/**
 * Converte nome directory Claude in path originale
 * Esempio: "C--BIZ2017-BNRG0022" -> "C:\\BIZ2017\\BNRG0022"
 */
function claudeDirNameToPath(dirName) {
  // Rimuovi i trattini e ricostruisci il path
  return dirName
    .replace(/^([A-Z])--/, '$1:\\')  // C-- -> C:\
    .replace(/-/g, '\\');             // Altri trattini -> backslash
}

/**
 * Scopre automaticamente tutti i progetti con sessioni Claude Code attive
 * @returns Array di oggetti {name, path}
 */
export function discoverProjects(excludedPaths = []) {
  console.log('🔍 Auto-discovery progetti da:', CLAUDE_PROJECTS_DIR);

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    console.log('⚠️  Directory sessioni Claude non trovata');
    return [];
  }

  try {
    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
    const projects = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const dirPath = path.join(CLAUDE_PROJECTS_DIR, dir.name);

      // Verifica che ci sia almeno un file .jsonl (sessione attiva o passata)
      const files = fs.readdirSync(dirPath);
      const hasSession = files.some(f => f.endsWith('.jsonl'));

      if (!hasSession) continue;

      // Converti nome directory in path originale
      const projectPath = claudeDirNameToPath(dir.name);

      // Escludi percorsi di sistema
      if (EXCLUDED_PATHS.some(excluded => projectPath.toLowerCase() === excluded.toLowerCase())) {
        console.log(`  ⏭️  Escluso (percorso sistema): ${projectPath}`);
        continue;
      }

      // Escludi percorsi nella lista esclusioni utente
      if (excludedPaths.some(ep => ep.toLowerCase() === projectPath.toLowerCase())) {
        console.log(`  ⏭️  Escluso (lista utente): ${projectPath}`);
        continue;
      }

      // Usa ultimo segmento del path come nome
      const projectName = path.basename(projectPath);

      projects.push({
        name: projectName,
        path: projectPath,
        claudeDir: dir.name,
        sessionCount: files.filter(f => f.endsWith('.jsonl')).length
      });

      console.log(`  ✅ ${projectName} (${files.filter(f => f.endsWith('.jsonl')).length} sessioni)`);
    }

    console.log(`\n🎉 Trovati ${projects.length} progetti\n`);
    return projects;
  } catch (error) {
    console.error('❌ Errore auto-discovery:', error.message);
    return [];
  }
}

/**
 * Verifica se auto-discovery è abilitato
 */
export function isAutoDiscoveryEnabled() {
  return process.env.AUTO_DISCOVERY !== 'false';
}
