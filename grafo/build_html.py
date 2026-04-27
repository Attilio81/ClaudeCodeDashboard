#!/usr/bin/env python3
"""Build single self-contained HTML with embedded graph data"""
import json
import os

base = os.path.dirname(__file__)

# Read graph data
with open(os.path.join(base, "graph_data.json"), "r", encoding="utf-8") as f:
    graph_data = json.load(f)

# Compact JSON (no indent to save space)
json_str = json.dumps(graph_data, ensure_ascii=False, separators=(',', ':'))

html = r"""<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrafoEGM — Dipendenze BIZ2017</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --amber:   #ffa31a;
      --amber2:  #ffcc66;
      --cyan:    #00e5cc;
      --red:     #ff4455;
      --green:   #39ff7a;
      --bg:      #020b0f;
      --bg2:     #040f14;
      --panel:   rgba(2, 10, 15, 0.94);
      --border:  rgba(255, 163, 26, 0.22);
      --border2: rgba(255, 163, 26, 0.5);
      --dim:     #3a4a44;
      --text:    #b8cec8;
      --mono:    'JetBrains Mono', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      overflow: hidden;
      cursor: crosshair;
    }

    /* scanlines overlay */
    body::after {
      content: '';
      position: fixed; inset: 0; z-index: 9999;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px,
        transparent 1px, transparent 3px
      );
    }

    /* vignette */
    body::before {
      content: '';
      position: fixed; inset: 0; z-index: 9998; pointer-events: none;
      background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%);
    }

    #graph-container { width: 100vw; height: 100vh; }

    /* ── PANEL ────────────────────────────────── */
    #panel {
      position: fixed; top: 0; left: 0;
      width: 280px; height: 100vh;
      background: var(--panel);
      border-right: 1px solid var(--border);
      z-index: 100;
      display: flex; flex-direction: column;
      overflow: hidden;
    }

    #panel-header {
      padding: 18px 16px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    #panel-header .sys-label {
      font-size: 9px; letter-spacing: 3px; color: var(--amber);
      text-transform: uppercase; margin-bottom: 6px; opacity: 0.7;
    }
    #panel-header h1 {
      font-size: 15px; font-weight: 600; color: var(--amber);
      letter-spacing: 1px; line-height: 1.2;
    }
    #panel-header h1 span { color: var(--cyan); }
    .blink { animation: blink 1.1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }

    #panel-body {
      flex: 1; overflow-y: auto; padding: 14px 16px;
      scrollbar-width: thin; scrollbar-color: var(--border) transparent;
    }

    .section { margin-bottom: 16px; }
    .section > .sec-label {
      font-size: 11px; letter-spacing: 2px; color: var(--amber);
      text-transform: uppercase; opacity: 0.6;
      margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
    }
    .section > .sec-label::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }

    /* search */
    .search-wrap { position: relative; display: flex; gap: 5px; }
    .search-prompt {
      position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      color: var(--amber); font-size: 12px; pointer-events: none;
    }
    #search {
      flex: 1; padding: 7px 8px 7px 26px;
      background: rgba(255,163,26,0.04);
      border: 1px solid var(--border); border-radius: 0;
      color: var(--amber2); font-family: var(--mono); font-size: 12px;
      caret-color: var(--amber);
      transition: border-color 0.15s;
    }
    #search::placeholder { color: var(--dim); }
    #search:focus { outline: none; border-color: var(--border2); background: rgba(255,163,26,0.06); }
    #search-results {
      display: none; position: absolute; left: 0; right: 0;
      background: #030e13; border: 1px solid var(--border); border-top: none;
      max-height: 160px; overflow-y: auto; z-index: 10;
      scrollbar-width: thin; scrollbar-color: var(--border) transparent;
    }
    .sr-item {
      padding: 7px 10px; cursor: pointer; font-size: 13px;
      border-bottom: 1px solid rgba(255,163,26,0.07);
      display: flex; justify-content: space-between; align-items: center;
    }
    .sr-item:hover { background: rgba(255,163,26,0.08); }
    .sr-deg { color: var(--dim); font-size: 11px; }

    /* stats */
    #stats {
      font-size: 13px; color: var(--dim);
      display: flex; gap: 12px; padding: 4px 0;
    }
    #stats .sv { color: var(--amber2); font-weight: 600; }

    /* buttons */
    .controls { display: flex; flex-wrap: wrap; gap: 5px; }
    .btn {
      padding: 5px 10px; border: 1px solid var(--border);
      background: transparent; color: var(--dim);
      font-family: var(--mono); font-size: 12px; letter-spacing: 0.5px;
      cursor: pointer; text-transform: uppercase;
      transition: all 0.12s;
      position: relative;
    }
    .btn::before { content: '['; margin-right: 2px; color: var(--border2); }
    .btn::after  { content: ']'; margin-left: 2px;  color: var(--border2); }
    .btn:hover { border-color: var(--amber); color: var(--amber); background: rgba(255,163,26,0.07); }
    .btn.active {
      border-color: var(--amber); color: var(--bg);
      background: var(--amber); font-weight: 600;
    }
    .btn.active::before, .btn.active::after { color: var(--bg); }
    .btn.danger { border-color: rgba(255,68,85,0.3); color: rgba(255,68,85,0.5); }
    .btn.danger:hover { border-color: var(--red); color: var(--red); background: rgba(255,68,85,0.07); }

    /* slider */
    input[type=range] {
      width: 100%; height: 2px;
      -webkit-appearance: none; appearance: none;
      background: var(--border); border-radius: 0; cursor: pointer;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 10px; height: 10px;
      background: var(--amber); border-radius: 0; cursor: pointer;
    }
    input[type=range]::-moz-range-thumb {
      width: 10px; height: 10px; background: var(--amber);
      border-radius: 0; border: none; cursor: pointer;
    }
    .slider-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-top: 6px; }
    .slider-val { min-width: 32px; text-align: right; color: var(--amber2); font-size: 12px; }

    /* legend */
    .legend { display: flex; flex-direction: column; gap: 4px; }
    .leg-item {
      display: flex; align-items: center; gap: 7px;
      font-size: 12px; cursor: pointer; padding: 4px 6px;
      border: 1px solid transparent; letter-spacing: 0.5px;
      transition: all 0.1s;
    }
    .leg-item:hover { border-color: var(--border); background: rgba(255,163,26,0.04); }
    .leg-item.disabled { opacity: 0.22; }
    .leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .leg-count { margin-left: auto; color: var(--dim); font-size: 11px; }

    /* hint bar */
    #hint-bar {
      flex-shrink: 0;
      padding: 10px 16px;
      border-top: 1px solid var(--border);
      font-size: 11px; color: var(--dim); line-height: 1.9;
      letter-spacing: 0.3px;
    }
    #hint-bar span { color: var(--amber); }

    /* ── INFO BOX (right) ─────────────────────── */
    #info-box {
      position: fixed; top: 12px; right: 12px; z-index: 100;
      background: var(--panel);
      border: 1px solid var(--border);
      width: 280px; max-height: calc(100vh - 24px);
      overflow-y: auto; display: none;
      scrollbar-width: thin; scrollbar-color: var(--border) transparent;
    }
    #info-header {
      padding: 12px 14px 10px;
      border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    #info-name {
      font-size: 14px; font-weight: 600; color: var(--amber);
      letter-spacing: 1px; word-break: break-all;
    }
    #info-desc {
      font-size: 10px; color: var(--cyan); margin-top: 3px;
      font-style: italic; opacity: 0.8;
    }
    #info-close {
      cursor: pointer; color: var(--dim); font-size: 16px; line-height: 1;
      margin-left: 8px; flex-shrink: 0;
      transition: color 0.1s;
    }
    #info-close:hover { color: var(--red); }
    #info-content { padding: 10px 14px; }
    .info-row { font-size: 12px; margin: 4px 0; display: flex; gap: 6px; }
    .info-row .k { color: var(--dim); min-width: 90px; }
    .info-row .v { color: var(--text); }
    .info-divider {
      font-size: 10px; letter-spacing: 2px; color: var(--amber); opacity: 0.6;
      text-transform: uppercase; margin: 10px 0 5px; display: flex; align-items: center; gap: 6px;
    }
    .info-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .node-link {
      display: inline-block; font-size: 11px; padding: 3px 7px; margin: 2px 2px 2px 0;
      border: 1px solid rgba(255,163,26,0.2); cursor: pointer;
      transition: all 0.1s;
    }
    .node-link:hover { border-color: var(--amber); color: var(--amber); background: rgba(255,163,26,0.07); }
    .node-link.out-link { color: #4a9eff; border-color: rgba(74,158,255,0.2); }
    .node-link.out-link:hover { border-color: #4a9eff; background: rgba(74,158,255,0.07); }
    .node-link.in-link  { color: var(--green); border-color: rgba(57,255,122,0.2); }
    .node-link.in-link:hover { border-color: var(--green); background: rgba(57,255,122,0.07); }
    .forms-list {
      font-size: 10px; color: var(--dim); margin-top: 4px;
      max-height: 120px; overflow-y: auto;
      scrollbar-width: thin; scrollbar-color: var(--border) transparent;
    }
    .forms-list div { padding: 2px 0; border-bottom: 1px solid rgba(255,163,26,0.04); }

    /* ── TOOLTIP ─────────────────────────────── */
    #tooltip {
      position: fixed; z-index: 300;
      background: rgba(2,10,15,0.97);
      border: 1px solid var(--border2);
      padding: 9px 13px; pointer-events: none; display: none;
      max-width: 220px;
      box-shadow: 0 0 20px rgba(255,163,26,0.15), 0 4px 20px rgba(0,0,0,0.8);
    }
    .tt-name { font-size: 13px; font-weight: 600; color: var(--amber); margin-bottom: 4px; letter-spacing: 1px; }
    .tt-desc { font-size: 10px; color: var(--cyan); margin-bottom: 6px; line-height: 1.4; }
    .tt-row  { font-size: 10px; color: var(--dim); margin: 2px 0; display: flex; gap: 6px; }
    .tt-row b { color: var(--text); }
    .tt-hint { font-size: 9px; color: rgba(255,163,26,0.3); margin-top: 6px; border-top: 1px solid var(--border); padding-top: 5px; }

    /* ── LOADING ─────────────────────────────── */
    #loading {
      position: fixed; inset: 0; z-index: 9000;
      background: var(--bg);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 24px;
    }
    .radar {
      width: 80px; height: 80px; border-radius: 50%;
      border: 1px solid rgba(255,163,26,0.3);
      position: relative;
    }
    .radar::before {
      content: ''; position: absolute; inset: 10px;
      border-radius: 50%; border: 1px solid rgba(255,163,26,0.15);
    }
    .radar::after {
      content: ''; position: absolute; top: 50%; left: 50%;
      width: 50%; height: 1px;
      background: linear-gradient(90deg, rgba(255,163,26,0.8), transparent);
      transform-origin: left center;
      animation: radar-sweep 1.5s linear infinite;
    }
    @keyframes radar-sweep { to { transform: rotate(360deg); } }
    .radar-dot {
      position: absolute; top: 50%; left: 50%;
      width: 4px; height: 4px; border-radius: 50%;
      background: var(--amber);
      transform: translate(-50%, -50%);
      box-shadow: 0 0 6px var(--amber);
    }
    #loading .load-text {
      font-size: 11px; letter-spacing: 3px; color: var(--amber);
      text-transform: uppercase; opacity: 0.8;
    }
    #loading .load-sub {
      font-size: 9px; color: var(--dim); letter-spacing: 2px;
      text-transform: uppercase; margin-top: -16px;
    }

    /* scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); }
  </style>
</head>
<body>

<div id="loading">
  <div class="radar"><div class="radar-dot"></div></div>
  <div class="load-text">GrafoEGM</div>
  <div class="load-sub">Inizializzazione sistema...</div>
</div>

<div id="graph-container"></div>
<div id="tooltip"></div>

<!-- ── LEFT PANEL ── -->
<div id="panel">
  <div id="panel-header">
    <div class="sys-label">EGM Sistemi &mdash; BIZ2017</div>
    <h1>GRAFO<span>EGM</span> <span class="blink" style="color:var(--amber);font-size:12px">_</span></h1>
  </div>

  <div id="panel-body">

    <div class="section">
      <div class="sec-label">Ricerca</div>
      <div class="search-wrap">
        <span class="search-prompt">&gt;_</span>
        <input type="text" id="search" placeholder="BNEG0012 ..." autocomplete="off" spellcheck="false"/>
        <button class="btn" id="btn-refresh" title="Ricarica nodo corrente" style="flex-shrink:0;padding:5px 8px;font-size:13px">&#8635;</button>
        <div id="search-results"></div>
      </div>
    </div>

    <div class="section">
      <div class="sec-label">Stato</div>
      <div id="stats">
        <span>NODI <span class="sv" id="stat-nodes">0</span></span>
        <span>LINK <span class="sv" id="stat-links">0</span></span>
      </div>
    </div>

    <div class="section">
      <div class="sec-label">Vista</div>
      <div class="controls">
        <button class="btn" id="btn-back" disabled style="opacity:0.25">&#8592; Indietro</button>
        <button class="btn" id="btn-show-all">Tutto</button>
        <button class="btn danger" id="btn-clear">Svuota</button>
      </div>
    </div>

    <div class="section" id="sec-minconn" style="display:none">
      <div class="sec-label">Min. connessioni</div>
      <div class="slider-row">
        <input type="range" id="min-conn" min="0" max="30" value="3" step="1">
        <span class="slider-val" id="min-conn-val">3</span>
      </div>
    </div>

    <div class="section">
      <div class="sec-label">Gruppi</div>
      <div class="legend" id="legend"></div>
    </div>

    <div class="section">
      <div class="sec-label">Zoom</div>
      <div class="controls">
        <button class="btn" id="btn-zoom-in">&#xFF0B;</button>
        <button class="btn" id="btn-zoom-out">&#xFF0D;</button>
      </div>
      <div class="slider-row">
        <input type="range" id="zoom-slider" min="100" max="3000" value="400" step="50">
        <span class="slider-val" id="zoom-val">400</span>
      </div>
    </div>

    <div class="section">
      <div class="sec-label">Fisica</div>
      <div class="slider-row">
        <span style="font-size:9px;color:var(--dim);min-width:70px">Distanza</span>
        <input type="range" id="link-dist" min="10" max="600" value="120" step="10">
        <span class="slider-val" id="link-dist-val">120</span>
      </div>
      <div class="slider-row" style="margin-top:4px">
        <span style="font-size:9px;color:var(--dim);min-width:70px">Repulsione</span>
        <input type="range" id="charge-str" min="10" max="500" value="80" step="10">
        <span class="slider-val" id="charge-str-val">80</span>
      </div>
    </div>

    <div class="section">
      <div class="sec-label">Opzioni</div>
      <div class="controls">
        <button class="btn" id="btn-dag">DAG</button>
        <button class="btn" id="btn-reset">Reset</button>
        <button class="btn" id="btn-arrows">Frecce</button>
        <button class="btn" id="btn-labels">Etichette</button>
      </div>
    </div>

  </div>

  <div id="hint-bar">
    <span>CERCA</span> → ego-network<br>
    <span>CLICK</span> seleziona &nbsp; <span>DBL-CLICK</span> esplodi<br>
    <span>SHIFT+CLICK</span> → espandi vicini<br>
    <span>DRAG</span> ruota &nbsp; <span>SCROLL</span> zoom
  </div>
</div>

<!-- ── RIGHT INFO BOX ── -->
<div id="info-box">
  <div id="info-header">
    <div>
      <div id="info-name"></div>
      <div id="info-desc"></div>
    </div>
    <div id="info-close" onclick="document.getElementById('info-box').style.display='none'">×</div>
  </div>
  <div id="info-content"></div>
</div>

<script src="https://unpkg.com/three@0.152.2/build/three.min.js"></script>
<script src="https://unpkg.com/three-spritetext@1.9.0/dist/three-spritetext.min.js"></script>
<script src="https://unpkg.com/3d-force-graph@1.73.0/dist/3d-force-graph.min.js"></script>
<script>
const RAW_DATA = """ + json_str + r""";

// Node history for back-navigation
const nodeHistory = [];
let historyPos = -1;

const GROUP_COLORS = {
  "BNEG":  "#4a9eff",
  "BNRG":  "#44dd88",
  "BNBU":  "#ff9a40",
  "BNOW":  "#ffdd44",
  "OTHER": "#cc88ff"
};

let graph = null;
let highlightNodes = new Set();
let highlightLinks = new Set();
let selectedNode = null;
let hiddenGroups = new Set();
let minConn = 3;
let showArrows = true;
let isDag = false;
let showAllMode = false;
let showLabels = false;
let linkDist = 120;
let chargeStr = 80;

// Index for fast lookup
const nodeById = {};
RAW_DATA.nodes.forEach(n => { nodeById[n.id] = n; });

// Adjacency: for each node, list of neighbor ids (both directions)
const adjOut = {}, adjIn = {};
RAW_DATA.nodes.forEach(n => { adjOut[n.id] = []; adjIn[n.id] = []; });
RAW_DATA.links.forEach(l => {
  adjOut[l.source] = adjOut[l.source] || [];
  adjIn[l.target]  = adjIn[l.target]  || [];
  adjOut[l.source].push(l.target);
  adjIn[l.target].push(l.source);
});

// Precompute degree
const degree = {};
RAW_DATA.nodes.forEach(n => { degree[n.id] = (adjOut[n.id]||[]).length + (adjIn[n.id]||[]).length; });

// Current visible set (ids)
let visibleSet = new Set();

function egoNetwork(nodeId) {
  const nodes = new Set();
  const links = [];
  nodes.add(nodeId);
  RAW_DATA.links.forEach(l => {
    if (l.source === nodeId || l.target === nodeId) {
      nodes.add(l.source); nodes.add(l.target);
    }
  });
  RAW_DATA.links.forEach(l => {
    if (nodes.has(l.source) && nodes.has(l.target)) links.push(l);
  });
  return {
    nodes: [...nodes].map(id => nodeById[id]).filter(Boolean),
    links
  };
}

function expandNode(nodeId) {
  RAW_DATA.links.forEach(l => {
    if (l.source === nodeId || l.target === nodeId) {
      visibleSet.add(l.source); visibleSet.add(l.target);
    }
  });
  visibleSet.add(nodeId);
  applyVisible();
}

function applyVisible() {
  const nodes = [...visibleSet].map(id => nodeById[id]).filter(Boolean)
    .filter(n => !hiddenGroups.has(n.group));
  const visIds = new Set(nodes.map(n => n.id));
  const links = RAW_DATA.links.filter(l => visIds.has(l.source) && visIds.has(l.target));
  updateStats(nodes.length, links.length);
  if (graph) graph.graphData({ nodes, links });
}

function filterAllData() {
  const nodes = RAW_DATA.nodes.filter(n =>
    !hiddenGroups.has(n.group) && (degree[n.id] || 0) >= minConn
  );
  const visIds = new Set(nodes.map(n => n.id));
  const links = RAW_DATA.links.filter(l => visIds.has(l.source) && visIds.has(l.target));
  updateStats(nodes.length, links.length);
  return { nodes, links };
}

function updateStats(n, l) {
  document.getElementById("stat-nodes").textContent = n;
  document.getElementById("stat-links").textContent = l;
}

function getCurrentData() {
  try { return graph.graphData(); } catch(e) { return { nodes: [], links: [] }; }
}

function nodeColor(node) {
  if (hiddenGroups.has(node.group)) return "rgba(0,0,0,0)";
  const base = GROUP_COLORS[node.group] || "#aaa";
  if (highlightNodes.size > 0) {
    return highlightNodes.has(node.id) ? base : "rgba(60,60,90,0.12)";
  }
  return base;
}

function linkColor(link) {
  if (highlightLinks.size > 0) {
    return highlightLinks.has(link) ? "#ffcc44" : "rgba(60,60,100,0.05)";
  }
  return "rgba(100,120,180,0.18)";
}

function linkWidth(link) {
  return highlightLinks.has(link) ? 2.5 : 0.5;
}

function updateHighlight(node) {
  highlightNodes.clear();
  highlightLinks.clear();
  if (!node) { refreshColors(); return; }
  highlightNodes.add(node.id);
  const gd = getCurrentData();
  gd.links.forEach(l => {
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const tid = typeof l.target === "object" ? l.target.id : l.target;
    if (sid === node.id || tid === node.id) {
      highlightLinks.add(l);
      highlightNodes.add(sid);
      highlightNodes.add(tid);
    }
  });
  refreshColors();
}

function refreshColors() {
  if (!graph) return;
  graph.nodeColor(nodeColor).linkColor(linkColor).linkWidth(linkWidth);
}

function showInfo(node) {
  const inDeg  = (adjIn[node.id]  || []).length;
  const outDeg = (adjOut[node.id] || []).length;
  const inNodes  = (adjIn[node.id]  || []).slice().sort();
  const outNodes = (adjOut[node.id] || []).slice().sort();

  document.getElementById("info-name").textContent = node.name;
  document.getElementById("info-desc").textContent = node.desc || "";
  let html = `
    <div class="info-row"><span class="k">Gruppo</span><span class="v">${node.group}</span></div>
    <div class="info-row"><span class="k">File VB</span><span class="v">${node.val || 0}</span></div>
    <div class="info-row"><span class="k">Gradi totali</span><span class="v">${degree[node.id] || 0}</span></div>
    <div class="info-row"><span class="k">← Usato da</span><span class="v" style="color:#39ff7a">${inDeg}</span></div>
    <div class="info-row"><span class="k">→ Usa</span><span class="v" style="color:#4a9eff">${outDeg}</span></div>
  `;
  if (outNodes.length) {
    html += `<div class="info-divider">Dipende da</div>
      <div>${outNodes.map(n => `<span class="node-link out-link" onclick="focusNode('${n}')">${n}</span>`).join("")}</div>`;
  }
  if (inNodes.length) {
    html += `<div class="info-divider">Chiamato da</div>
      <div>${inNodes.map(n => `<span class="node-link in-link" onclick="focusNode('${n}')">${n}</span>`).join("")}</div>`;
  }
  if (node.forms && node.forms.length) {
    const shown = node.forms.slice(0, 25);
    html += `<div class="info-divider">File (${node.forms.length})</div>
      <div class="forms-list">${shown.map(f => `<div>${f}</div>`).join("")}${node.forms.length > 25 ? `<div style="color:var(--amber);opacity:0.5">... +${node.forms.length-25} altri</div>` : ""}</div>`;
  }
  document.getElementById("info-content").innerHTML = html;
  document.getElementById("info-box").style.display = "block";
}

function focusNode(id, addHistory) {
  const node = nodeById[id];
  if (!node) return;
  showAllMode = false;
  document.getElementById("sec-minconn").style.display = "none";
  visibleSet = new Set();
  const ego = egoNetwork(id);
  ego.nodes.forEach(n => visibleSet.add(n.id));
  applyVisible();
  selectedNode = node;
  updateHighlight(node);
  showInfo(node);
  document.getElementById("search").value = id;
  // History
  if (addHistory !== false) {
    nodeHistory.splice(historyPos + 1);
    nodeHistory.push(id);
    historyPos = nodeHistory.length - 1;
  }
  updateBackBtn();
}
// Expose globally for inline onclick
window.focusNode = focusNode;

function updateBackBtn() {
  const btn = document.getElementById("btn-back");
  if (!btn) return;
  btn.disabled = historyPos <= 0;
  btn.style.opacity = historyPos <= 0 ? "0.25" : "1";
}

function initGraph() {
  const container = document.getElementById("graph-container");
  container.innerHTML = "";

  graph = ForceGraph3D()(container)
    .graphData({ nodes: [], links: [] })
    .nodeId("id")
    .nodeLabel(() => "")
    .nodeColor(nodeColor)
    .nodeVal(n => Math.max(1.5, Math.log(1 + (n.val || 1)) * 2.5))
    .nodeOpacity(0.92)
    .nodeThreeObject(node => {
      if (!showLabels) return null;
      const sprite = new SpriteText(node.name);
      sprite.color = GROUP_COLORS[node.group] || '#ccc';
      sprite.textHeight = 5;
      sprite.backgroundColor = 'rgba(5,5,18,0.72)';
      sprite.padding = 1.5;
      sprite.borderRadius = 2;
      sprite.fontFace = 'monospace';
      return sprite;
    })
    .nodeThreeObjectExtend(true)
    .linkColor(linkColor)
    .linkWidth(linkWidth)
    .linkDirectionalArrowLength(showArrows ? 5 : 0)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor(() => "rgba(255,200,60,0.6)")
    .linkDirectionalParticles(l => highlightLinks.has(l) ? 4 : 0)
    .linkDirectionalParticleWidth(2)
    .linkDirectionalParticleColor(() => "#ffcc44")
    .backgroundColor("#020b0f")
    .onNodeHover(node => {
      const tt = document.getElementById("tooltip");
      if (node) {
        if (!selectedNode) updateHighlight(node);
        const inDeg  = (adjIn[node.id]  || []).length;
        const outDeg = (adjOut[node.id] || []).length;
        tt.innerHTML = `
          <div class="tt-name">${node.name}</div>
          ${node.desc ? `<div class="tt-desc">${node.desc}</div>` : ""}
          <div class="tt-row"><span>Gruppo</span><b>${node.group}</b></div>
          <div class="tt-row"><span>File VB</span><b>${node.val || 0}</b></div>
          <div class="tt-row"><span>&#8592; da</span><b style="color:#39ff7a">${inDeg}</b></div>
          <div class="tt-row"><span>&#8594; usa</span><b style="color:#4a9eff">${outDeg}</b></div>
          <div class="tt-hint">CLICK seleziona &nbsp;·&nbsp; SHIFT+CLICK espandi</div>
        `;
        tt.style.left = ((window._mx || 400) + 16) + "px";
        tt.style.top  = ((window._my || 300) - 10) + "px";
        tt.style.display = "block";
      } else {
        if (!selectedNode) { highlightNodes.clear(); highlightLinks.clear(); refreshColors(); }
        tt.style.display = "none";
      }
    })
    .onNodeClick((node, event) => {
      document.getElementById("tooltip").style.display = "none";
      if (event && event.shiftKey) {
        expandNode(node.id);
        return;
      }
      // Double-click detection
      const now = Date.now();
      if (graph._lastClickNode === node.id && now - graph._lastClickTime < 300) {
        // DOUBLE CLICK → new ego-network
        graph._lastClickNode = null;
        focusNode(node.id);
        return;
      }
      graph._lastClickNode = node.id;
      graph._lastClickTime = now;
      // Single click
      if (selectedNode && selectedNode.id === node.id) {
        selectedNode = null;
        highlightNodes.clear(); highlightLinks.clear(); refreshColors();
        document.getElementById("info-box").style.display = "none";
      } else {
        selectedNode = node;
        updateHighlight(node);
        showInfo(node);
        if (node.x !== undefined) {
          graph.cameraPosition(
            { x: node.x + 60, y: node.y + 40, z: node.z + 60 },
            { x: node.x, y: node.y, z: node.z }, 600
          );
        }
      }
    })
    .onBackgroundClick(() => {
      if (!selectedNode && visibleSet.size === 0) return; // nulla da fare
      selectedNode = null;
      highlightNodes.clear(); highlightLinks.clear(); refreshColors();
      document.getElementById("info-box").style.display = "none";
      document.getElementById("tooltip").style.display = "none";
    });

  document.addEventListener("mousemove", e => {
    window._mx = e.clientX; window._my = e.clientY;
    const tt = document.getElementById("tooltip");
    if (tt.style.display !== "none") {
      tt.style.left = (e.clientX + 16) + "px";
      tt.style.top  = (e.clientY - 10) + "px";
    }
  });

  // Apply physics forces
  try {
    graph.d3Force('link').distance(linkDist);
    graph.d3Force('charge').strength(-chargeStr);
  } catch(e) {}

  document.getElementById("loading").style.display = "none";
  updateStats(0, 0);
}

function buildLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = "";
  Object.entries(GROUP_COLORS).forEach(([grp, col]) => {
    const count = RAW_DATA.nodes.filter(n => n.group === grp).length;
    const item = document.createElement("div");
    item.className = "leg-item";
    item.title = `${count} moduli`;
    item.innerHTML = `<div class="leg-dot" style="background:${col};box-shadow:0 0 5px ${col}44"></div><span style="color:${col};letter-spacing:0.5px">${grp}</span><span class="leg-count">${count}</span>`;
    item.addEventListener("click", () => {
      if (hiddenGroups.has(grp)) { hiddenGroups.delete(grp); item.classList.remove("disabled"); }
      else { hiddenGroups.add(grp); item.classList.add("disabled"); }
      if (showAllMode) { if (graph) graph.graphData(filterAllData()); }
      else applyVisible();
    });
    legend.appendChild(item);
  });
}

// Search with autocomplete
const searchEl = document.getElementById("search");
const resultsEl = document.getElementById("search-results");

searchEl.addEventListener("input", function() {
  const val = this.value.trim().toUpperCase();
  if (!val) { resultsEl.style.display = "none"; return; }
  const matches = RAW_DATA.nodes.filter(n => n.id.includes(val)).slice(0, 12);
  if (!matches.length) { resultsEl.style.display = "none"; return; }
  resultsEl.innerHTML = matches.map(n =>
    `<div class="sr-item" onmousedown="focusNode('${n.id}')">
       <span style="color:${GROUP_COLORS[n.group]||'#ffa31a'}">${n.id}</span>
       <span class="sr-deg">${degree[n.id]||0} conn</span>
     </div>`
  ).join("");
  resultsEl.style.display = "block";
});

searchEl.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    const val = this.value.trim().toUpperCase();
    const node = RAW_DATA.nodes.find(n => n.id === val) ||
                 RAW_DATA.nodes.find(n => n.id.includes(val));
    if (node) focusNode(node.id);
    resultsEl.style.display = "none";
  }
  if (e.key === "Escape") { resultsEl.style.display = "none"; }
});

searchEl.addEventListener("blur", () => {
  setTimeout(() => { resultsEl.style.display = "none"; }, 150);
});

document.getElementById("btn-refresh").addEventListener("click", () => {
  const val = document.getElementById("search").value.trim().toUpperCase();
  if (!val) return;
  const node = RAW_DATA.nodes.find(n => n.id === val) ||
               RAW_DATA.nodes.find(n => n.id.includes(val));
  if (node) focusNode(node.id, true);
});

document.getElementById("btn-back").addEventListener("click", () => {
  if (historyPos <= 0) return;
  historyPos--;
  focusNode(nodeHistory[historyPos], false);
  updateBackBtn();
});

document.getElementById("btn-show-all").addEventListener("click", () => {
  showAllMode = true;
  visibleSet.clear();
  document.getElementById("sec-minconn").style.display = "";
  if (graph) graph.graphData(filterAllData());
});

document.getElementById("btn-clear").addEventListener("click", () => {
  showAllMode = false;
  visibleSet.clear();
  document.getElementById("sec-minconn").style.display = "none";
  selectedNode = null;
  highlightNodes.clear(); highlightLinks.clear();
  document.getElementById("info-box").style.display = "none";
  document.getElementById("search").value = "";
  updateStats(0, 0);
  if (graph) graph.graphData({ nodes: [], links: [] });
});

document.getElementById("min-conn").addEventListener("input", function() {
  minConn = parseInt(this.value);
  document.getElementById("min-conn-val").textContent = minConn;
  if (showAllMode && graph) graph.graphData(filterAllData());
});

function getCameraDist() {
  if (!graph) return 1200;
  const pos = graph.cameraPosition();
  return Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z) || 1200;
}
function setCameraDist(dist, ms) {
  if (!graph) return;
  const pos = graph.cameraPosition();
  const cur = getCameraDist();
  const scale = dist / cur;
  graph.cameraPosition({ x: pos.x*scale, y: pos.y*scale, z: pos.z*scale }, undefined, ms || 400);
  document.getElementById("zoom-slider").value = Math.round(dist);
  document.getElementById("zoom-val").textContent = Math.round(dist);
}

document.getElementById("btn-zoom-in").addEventListener("click", () => {
  setCameraDist(Math.max(100, getCameraDist() * 0.6));
});
document.getElementById("btn-zoom-out").addEventListener("click", () => {
  setCameraDist(Math.min(3000, getCameraDist() * 1.6));
});
document.getElementById("zoom-slider").addEventListener("input", function() {
  document.getElementById("zoom-val").textContent = this.value;
  setCameraDist(parseInt(this.value), 200);
});

document.getElementById("btn-reset").addEventListener("click", () => {
  graph?.cameraPosition({ x: 0, y: 0, z: 1200 }, { x: 0, y: 0, z: 0 }, 800);
  document.getElementById("zoom-slider").value = 1200;
  document.getElementById("zoom-val").textContent = "1200";
});

document.getElementById("link-dist").addEventListener("input", function() {
  linkDist = parseInt(this.value);
  document.getElementById("link-dist-val").textContent = linkDist;
  if (!graph) return;
  try { graph.d3Force('link').distance(linkDist); graph.d3ReheatSimulation(); } catch(e) {}
});

document.getElementById("charge-str").addEventListener("input", function() {
  chargeStr = parseInt(this.value);
  document.getElementById("charge-str-val").textContent = chargeStr;
  if (!graph) return;
  try { graph.d3Force('charge').strength(-chargeStr); graph.d3ReheatSimulation(); } catch(e) {}
});

document.getElementById("btn-dag").addEventListener("click", function() {
  isDag = !isDag;
  this.classList.toggle("active", isDag);
  this.textContent = isDag ? "DAG ✓" : "DAG";
  if (showAllMode && graph) {
    try { graph.dagMode(isDag ? "td" : null); if (isDag) graph.dagLevelDistance(50); } catch(e) {}
  }
});

function makeSpriteLabel(node) {
  const sprite = new SpriteText(node.name);
  sprite.color = GROUP_COLORS[node.group] || '#ffa31a';
  sprite.textHeight = 4.5;
  sprite.backgroundColor = 'rgba(2,10,15,0.82)';
  sprite.padding = 1.5;
  sprite.borderRadius = 1;
  sprite.fontFace = 'JetBrains Mono, monospace';
  // push label above the sphere (radius ≈ cbrt(nodeVal)*4)
  const r = Math.cbrt(Math.max(1.5, Math.log(1 + (node.val || 1)) * 2.5)) * 4;
  sprite.position.set(0, r + 5, 0);
  return sprite;
}

document.getElementById("btn-labels").addEventListener("click", function() {
  showLabels = !showLabels;
  this.classList.toggle("active", showLabels);
  this.textContent = showLabels ? "Etichette ✓" : "Etichette";
  if (!graph) return;
  if (showLabels) {
    graph.nodeThreeObject(makeSpriteLabel).nodeThreeObjectExtend(true);
  } else {
    graph.nodeThreeObject(null).nodeThreeObjectExtend(false);
  }
});

document.getElementById("btn-arrows").addEventListener("click", function() {
  showArrows = !showArrows;
  this.classList.toggle("active", showArrows);
  if (graph) graph.linkDirectionalArrowLength(showArrows ? 4 : 0);
});



buildLegend();
initGraph();
</script>
</body>
</html>
"""

output_path = os.path.join(base, "GrafoEGM.html")
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html)

print(f"HTML self-contained creato: {output_path}")
print(f"Dimensione: {os.path.getsize(output_path):,} bytes")
