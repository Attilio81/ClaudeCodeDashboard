import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude', 'projects');

export class ClaudeSessionWatcher {
  constructor(projects, onUpdate) {
    this.projects = projects;
    this.onUpdate = onUpdate;
    this.watchers = [];
    this.watcherMap = new Map(); // projectName -> chokidar watcher
    this.projectDirs = new Map();
    this.manuallyChecked = new Map(); // Progetti segnati manualmente come controllati (projectName -> timestamp)
    this.lastToolResultTime = new Map(); // Timestamp ultimo tool result per progetto
    this.periodicCheckInterval = null;
    this.discoveredProjects = new Set(); // Progetti già scoperti per evitare duplicati
    this.projectsWatcher = null; // Watcher sulla directory .claude/projects
  }

  // Converti path progetto in nome directory Claude
  projectPathToClaudeDirName(projectPath) {
    return projectPath
      .replace(/:\\/g, '--')  // Drive letter (C:\) -> C-- (prima di altre sostituzioni!)
      .replace(/\\/g, '-')    // Altri backslash -> -
      .replace(/\//g, '-')    // Forward slash -> -
      .replace(/\s+/g, '-')   // Spazi -> -
      .replace(/^-/, '');     // Rimuovi trattino iniziale se presente
  }

  // Trova file sessione attivo in una directory progetto
  findActiveSessionFile(claudeProjectDir) {
    if (!fs.existsSync(claudeProjectDir)) {
      return null;
    }

    const files = fs.readdirSync(claudeProjectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      return null;
    }

    // Prendi il file più recente
    const latest = jsonlFiles
      .map(f => ({
        name: f,
        path: path.join(claudeProjectDir, f),
        mtime: fs.statSync(path.join(claudeProjectDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)[0];

    return latest.path;
  }

  // Leggi ultima riga VALIDA del file JSONL (ignora system messages)
  readLastLine(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());

      if (lines.length === 0) return null;

      // Cerca ultima entry valida (non system)
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          // Ignora entry di tipo "system"
          if (entry.type !== 'system') {
            return entry;
          }
        } catch {
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Errore lettura ${filePath}:`, error.message);
      return null;
    }
  }

  // Leggi ultime N righe del file JSONL per storico output
  readLastNLines(filePath, n = 20) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());

      if (lines.length === 0) return [];

      // Prendi ultime N righe
      const lastNLines = lines.slice(-n);
      return lastNLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error(`❌ Errore lettura ${filePath}:`, error.message);
      return [];
    }
  }

  // Estrai output history dalle ultime righe
  extractOutputHistory(sessionEntries) {
    const history = [];

    for (const entry of sessionEntries) {
      const info = this.extractActivityInfo(entry);
      if (info && info.lastOutput) {
        history.push({
          timestamp: info.timestamp,
          output: info.lastOutput,
          toolName: info.toolName,
          type: entry.type
        });
      }
    }

    return history;
  }

  // Estrai info utili dalla sessione
  extractActivityInfo(sessionData) {
    if (!sessionData) return null;

    const info = {
      timestamp: sessionData.timestamp || new Date().toISOString(),
      type: sessionData.type,
      status: 'active',
      sessionId: sessionData.sessionId,
      slug: sessionData.slug,
      gitBranch: sessionData.gitBranch || null
    };

    // Se è un messaggio dell'assistant con tool_use
    if (sessionData.message?.content && Array.isArray(sessionData.message.content)) {
      const content = sessionData.message.content;

      // Cerca tool_use
      const toolUse = content.find(c => c.type === 'tool_use');
      if (toolUse) {
        const description = toolUse.input?.description || toolUse.input?.command || toolUse.input?.pattern || 'working...';
        info.lastOutput = `${toolUse.name}: ${description}`;
        info.activity = `Using tool: ${toolUse.name}`;
        info.toolName = toolUse.name;
        return info;
      }

      // Cerca text
      const textContent = content.find(c => c.type === 'text');
      if (textContent) {
        // Prendi più testo per visualizzazione completa
        const text = textContent.text.substring(0, 500);
        info.lastOutput = text;
        info.activity = 'Responding';
        info.fullText = textContent.text; // Testo completo
        return info;
      }
    }

    // Se è un tool result
    if (sessionData.toolUseResult) {
      info.lastOutput = 'Tool execution completed';
      info.activity = 'Tool result received';
      return info;
    }

    // Messaggio utente
    if (sessionData.type === 'user' && !sessionData.toolUseResult) {
      // Estrai primo contenuto del messaggio utente
      const userMessage = sessionData.message?.content;
      if (typeof userMessage === 'string') {
        info.lastOutput = `User: ${userMessage.substring(0, 100)}`;
      } else {
        info.lastOutput = 'User message received';
      }
      info.activity = 'Waiting for user';
      info.status = 'idle';
      return info;
    }

    return info;
  }

  // Determina lo stato basato sul tipo di ultima entry e content
  // active: Claude sta lavorando (usa tool) o ha appena ricevuto tool result (< 5 min)
  // check: Claude ha finito (solo text, nessun tool) o tool result > 5 min
  // idle: inattivo da tempo (> 60 min) o segnato manualmente come controllato
  getStatusFromActivity(sessionData, timestamp, projectName) {
    const activityTime = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now - activityTime) / 1000 / 60;
    const diffSeconds = (now - activityTime) / 1000;

    // Se segnato manualmente come controllato, controlla se c'è nuova attività
    if (this.manuallyChecked.has(projectName)) {
      const checkedTimestamp = this.manuallyChecked.get(projectName);

      // Se l'attività è più recente di quando è stato controllato → reset!
      if (activityTime > checkedTimestamp) {
        console.log(`🔄 ${projectName}: nuova attività rilevata, reset controllo manuale`);
        this.manuallyChecked.delete(projectName);
        // Continua con il controllo normale
      } else {
        // Attività vecchia, rimane controllato
        return 'idle';
      }
    }

    // Entry dell'assistant
    if (sessionData.type === 'assistant') {
      const content = sessionData.message?.content;

      // Controlla se il content contiene tool_use
      let hasToolUse = false;
      if (Array.isArray(content)) {
        hasToolUse = content.some(c => c.type === 'tool_use');
      }

      // Se contiene tool_use → Claude sta lavorando (chiama tool)
      if (hasToolUse) {
        // Ma solo se è recente! (< 5 minuti)
        // Sessioni appese con tool_use vecchi = inattive
        if (diffMinutes < 5) {
          return 'active';
        } else if (diffMinutes < 60) {
          return 'check'; // Tool call vecchio ma recente
        } else {
          return 'idle'; // Tool call molto vecchio (sessione appesa)
        }
      }

      // Se NON contiene tool_use (solo text/thinking)
      // Controlla se c'è stato un tool result recente (< 5 min)
      if (this.lastToolResultTime.has(projectName)) {
        const lastToolResult = this.lastToolResultTime.get(projectName);
        const diffMinutesFromToolResult = (now - lastToolResult) / 1000 / 60;
        
        // Se < 5 minuti dall'ultimo tool result → ancora attivo
        if (diffMinutesFromToolResult < 5) {
          return 'active';
        }
      }

      // Altrimenti → Claude ha finito
      // Recente (< 60 min) → da controllare
      if (diffMinutes < 60) {
        return 'check';
      }
      // Vecchio → inattivo
      return 'idle';
    }

    // Entry dell'utente (messaggio o tool result)
    if (sessionData.type === 'user') {
      // Se è un tool result
      if (sessionData.toolUseResult) {
        // Se < 5 minuti → Claude sta ancora processando → attivo
        if (diffMinutes < 5) {
          // Salva il timestamp del tool result
          this.lastToolResultTime.set(projectName, activityTime);
          return 'active';
        }

        // Se > 5 minuti → Claude probabilmente ha finito → da controllare
        if (diffMinutes < 60) {
          return 'check';
        }
        return 'idle';
      }

      // Se è un messaggio utente → Claude ha finito
      // Recente (< 60 min) → da controllare
      if (diffMinutes < 60) {
        return 'check';
      }
      // Vecchio → inattivo
      return 'idle';
    }

    return 'idle';
  }

  start() {
    console.log('🚀 Avvio monitoraggio sessioni Claude Code reali...\n');

    this.projects.forEach((project) => {
      this.addProjectWatcher(project);
    });

    console.log(`✅ Monitoraggio attivo su ${this.projects.length} progetti\n`);

    // Avvia controllo periodico ogni 10 secondi per gestire timeout tool result
    this.startPeriodicCheck();

    // Avvia monitoraggio directory .claude/projects per auto-discovery dinamico
    this.startDynamicDiscovery();
  }

  // Aggiungi watcher per un singolo progetto
  addProjectWatcher(project) {
    const claudeDirName = this.projectPathToClaudeDirName(project.path);
    const claudeProjectDir = path.join(CLAUDE_DIR, claudeDirName);

    // Segna come già scoperto
    this.discoveredProjects.add(claudeDirName);

    console.log(`📁 Progetto: ${project.name}`);
    console.log(`   Path: ${project.path}`);
    console.log(`   Claude dir: ${claudeDirName}`);

    // Trova file sessione attivo
    const sessionFile = this.findActiveSessionFile(claudeProjectDir);

    if (!sessionFile) {
      console.log(`   ⚠️  Nessuna sessione attiva trovata\n`);
      this.broadcastStatus(project, {
        status: 'idle',
        lastOutput: 'No active session',
        timestamp: new Date().toISOString(),
        outputHistory: []
      });
      return;
    }

    console.log(`   ✅ Sessione: ${path.basename(sessionFile)}\n`);
    this.projectDirs.set(project.name, sessionFile);

    // Leggi stato iniziale
    this.readAndBroadcastSession(project, sessionFile);

    // Monitora modifiche al file sessione
    const watcher = chokidar.watch(sessionFile, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    watcher
      .on('change', () => {
        this.readAndBroadcastSession(project, sessionFile);
      })
      .on('error', (error) => {
        console.error(`❌ Errore watcher ${project.name}:`, error.message);
      });

    this.watchers.push(watcher);
    this.watcherMap.set(project.name, watcher);
  }

  // Aggiungi un nuovo progetto al monitoraggio in tempo reale
  addNewProject(project) {
    if (this.projects.some(p => p.name === project.name)) return; // già presente
    this.projects.push(project);
    this.addProjectWatcher(project);
  }

  // Rimuovi un progetto dal monitoraggio dinamicamente
  removeProject(projectName) {
    const watcher = this.watcherMap.get(projectName);
    if (watcher) {
      watcher.close();
      this.watcherMap.delete(projectName);
      const idx = this.watchers.indexOf(watcher);
      if (idx !== -1) this.watchers.splice(idx, 1);
    }

    const project = this.projects.find(p => p.name === projectName);
    if (project) {
      const claudeDirName = this.projectPathToClaudeDirName(project.path);
      this.discoveredProjects.delete(claudeDirName);
    }

    this.projects = this.projects.filter(p => p.name !== projectName);
    this.projectDirs.delete(projectName);
    this.manuallyChecked.delete(projectName);
    this.lastToolResultTime.delete(projectName);

    console.log(`🚫 ${projectName} rimosso dal monitoraggio`);
  }

  // Avvia monitoraggio dinamico della directory .claude/projects
  startDynamicDiscovery() {
    if (!fs.existsSync(CLAUDE_DIR)) {
      console.log('⚠️  Directory .claude/projects non trovata, skip auto-discovery dinamico\n');
      return;
    }

    console.log('🔍 Avvio auto-discovery dinamico...\n');

    this.projectsWatcher = chokidar.watch(CLAUDE_DIR, {
      persistent: true,
      ignoreInitial: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 200
      }
    });

    this.projectsWatcher
      .on('addDir', (dirPath) => {
        const claudeDirName = path.basename(dirPath);
        
        // Ignora se già scoperto
        if (this.discoveredProjects.has(claudeDirName)) {
          return;
        }

        // Verifica che ci siano file .jsonl nella directory
        try {
          const files = fs.readdirSync(dirPath);
          const hasSession = files.some(f => f.endsWith('.jsonl'));

          if (!hasSession) {
            return;
          }

          // Converti nome directory in path originale
          const projectPath = this.claudeDirNameToPath(claudeDirName);
          const projectName = path.basename(projectPath);

          console.log(`\n🆕 Nuovo progetto rilevato: ${projectName}`);

          const newProject = {
            name: projectName,
            path: projectPath
          };

          // Aggiungi alla lista progetti
          this.projects.push(newProject);

          // Aggiungi watcher per il nuovo progetto
          this.addProjectWatcher(newProject);
        } catch (error) {
          console.error(`❌ Errore rilevamento progetto ${claudeDirName}:`, error.message);
        }
      })
      .on('add', (filePath) => {
        // Rileva nuovi file .jsonl in directory esistenti
        if (!filePath.endsWith('.jsonl')) return;

        const claudeProjectDir = path.dirname(filePath);
        const claudeDirName = path.basename(claudeProjectDir);

        // Ignora se già scoperto
        if (this.discoveredProjects.has(claudeDirName)) {
          return;
        }

        // Converti nome directory in path originale
        const projectPath = this.claudeDirNameToPath(claudeDirName);
        const projectName = path.basename(projectPath);

        console.log(`\n🆕 Nuova sessione rilevata per: ${projectName}`);

        const newProject = {
          name: projectName,
          path: projectPath
        };

        // Aggiungi alla lista progetti
        this.projects.push(newProject);

        // Aggiungi watcher per il nuovo progetto
        this.addProjectWatcher(newProject);
      })
      .on('error', (error) => {
        console.error('❌ Errore watcher directory progetti:', error.message);
      });
  }

  // Converti nome directory Claude in path originale (inverso di projectPathToClaudeDirName)
  claudeDirNameToPath(dirName) {
    return dirName
      .replace(/^([A-Z])--/, '$1:\\')  // C-- -> C:\
      .replace(/-/g, '\\');             // Altri trattini -> backslash
  }

  // Controllo periodico per aggiornare stati dopo timeout
  startPeriodicCheck() {
    this.periodicCheckInterval = setInterval(() => {
      this.projects.forEach(project => {
        const sessionFile = this.projectDirs.get(project.name);
        if (sessionFile) {
          this.readAndBroadcastSession(project, sessionFile);
        }
      });
    }, 10000); // Ogni 10 secondi

    console.log('🔄 Controllo periodico attivato (ogni 10s)\n');
  }

  // Segna un progetto come controllato manualmente
  markAsChecked(projectName) {
    // Salva il timestamp di quando è stato segnato come controllato
    const checkedTimestamp = new Date();
    this.manuallyChecked.set(projectName, checkedTimestamp);
    console.log(`✓ ${projectName} segnato come controllato manualmente alle ${checkedTimestamp.toLocaleTimeString('it-IT')}`);

    // Forza aggiornamento immediato
    const project = this.projects.find(p => p.name === projectName);
    if (project) {
      const sessionFile = this.projectDirs.get(projectName);
      if (sessionFile) {
        this.readAndBroadcastSession(project, sessionFile);
      }
    }
  }

  readAndBroadcastSession(project, sessionFile) {
    const lastEntry = this.readLastLine(sessionFile);

    if (!lastEntry) {
      this.broadcastStatus(project, {
        status: 'error',
        lastOutput: 'Cannot read session',
        timestamp: new Date().toISOString(),
        outputHistory: []
      });
      return;
    }

    // Leggi anche storico output (ultime 20 righe)
    const lastEntries = this.readLastNLines(sessionFile, 20);
    const outputHistory = this.extractOutputHistory(lastEntries);

    const activityInfo = this.extractActivityInfo(lastEntry);

    if (!activityInfo) {
      this.broadcastStatus(project, {
        status: 'idle',
        lastOutput: 'No recent activity',
        timestamp: lastEntry.timestamp,
        sessionId: lastEntry.sessionId,
        slug: lastEntry.slug,
        outputHistory
      });
      return;
    }

    // Determina stato basato su tipo di entry e tempo
    const status = this.getStatusFromActivity(lastEntry, activityInfo.timestamp, project.name);

    let output = activityInfo.lastOutput;
    if (status === 'check') {
      output = '✅ Completato - Da controllare';
    } else if (status === 'idle') {
      // Se segnato manualmente come controllato
      if (this.manuallyChecked.has(project.name)) {
        output = '✓ Controllato manualmente';
      } else {
        output = '💤 Inattivo da più di 60 minuti';
      }
    }

    this.broadcastStatus(project, {
      status,
      lastOutput: output,
      fullText: activityInfo.fullText,
      timestamp: activityInfo.timestamp,
      sessionId: activityInfo.sessionId,
      slug: activityInfo.slug,
      gitBranch: activityInfo.gitBranch,
      toolName: activityInfo.toolName,
      outputHistory
    });
  }

  broadcastStatus(project, data) {
    const output = data.lastOutput || 'No output';
    const statusData = {
      status: data.status,
      lastUpdate: data.timestamp,
      lastOutput: output, // Non troncare più
      fullText: data.fullText, // Testo completo se disponibile
      projectName: project.name,
      projectPath: project.path,
      timestamp: new Date().toISOString(),
      sessionId: data.sessionId,
      slug: data.slug,
      gitBranch: data.gitBranch,
      toolName: data.toolName,
      outputHistory: data.outputHistory || []
    };

    this.onUpdate(statusData);
    const sessionInfo = data.slug ? ` [${data.slug}]` : '';
    const historyInfo = data.outputHistory ? ` (${data.outputHistory.length} eventi)` : '';
    console.log(`📊 ${project.name}${sessionInfo}: ${data.status}${historyInfo} - "${output.substring(0, 50)}..."`);
  }

  stop() {
    console.log('🛑 Arresto watcher sessioni...');
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
    this.projectDirs.clear();

    // Ferma controllo periodico
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }

    // Ferma watcher directory progetti
    if (this.projectsWatcher) {
      this.projectsWatcher.close();
      this.projectsWatcher = null;
    }
  }
}
