#!/usr/bin/env python3
"""
Extract inter-module connections from BN* projects in C:/BIZ2017/
Patterns:
  1. NTSIstanziaDll(..., "DLLNAME", "CLASSNAME", ...) -> 3rd string arg is target DLL
  2. oMenu.RunChild("NTSInformatica", "FRMXX", ..., "BNXX", ...) -> 6th string arg is target module
"""

import os
import re
import json
from collections import defaultdict

BASE_DIR = r"C:\BIZ2017"

# Regex patterns
RE_ISTANZIA = re.compile(
    r'NTSIstanziaDll\s*\([^,]+,\s*[^,]+,\s*"([^"]+)"\s*,\s*"([^"]+)"',
    re.IGNORECASE
)
RE_RUNCHILD = re.compile(
    r'RunChild\s*\(.+?"(BN[A-Z0-9_]+)"',
    re.IGNORECASE
)

def get_module_name(folder_path):
    """Get module name from folder path"""
    return os.path.basename(folder_path)

def extract_connections():
    connections = set()  # (source, target)
    modules = set()
    module_descriptions = {}  # module -> list of VB filenames (for tooltip)

    bn_dirs = [
        d for d in os.listdir(BASE_DIR)
        if d.startswith("BN") and os.path.isdir(os.path.join(BASE_DIR, d))
        and not d.endswith(" - Copia") and not d.endswith(" - Copia (2)") and not d.endswith(" - Copia (3)")
    ]

    print(f"Found {len(bn_dirs)} BN* directories")

    for bn_dir in sorted(bn_dirs):
        source = bn_dir.upper()
        modules.add(source)
        dir_path = os.path.join(BASE_DIR, bn_dir)

        vb_files = []
        try:
            for f in os.listdir(dir_path):
                if f.lower().endswith(".vb") and not f.lower().endswith(".designer.vb"):
                    vb_files.append(f)
        except PermissionError:
            continue

        module_descriptions[source] = vb_files

        for vb_file in vb_files:
            filepath = os.path.join(dir_path, vb_file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            # Pattern 1: NTSIstanziaDll
            for m in RE_ISTANZIA.finditer(content):
                dll_name = m.group(1).upper()
                # Skip if self-reference or not a BN* project
                if dll_name == source:
                    continue
                if dll_name.startswith("BN"):
                    # Only include if target is a known BN* module
                    connections.add((source, dll_name))

            # Pattern 2: RunChild - find all "BN..." strings in RunChild calls
            for m in RE_RUNCHILD.finditer(content):
                target = m.group(1).upper()
                if target != source:
                    connections.add((source, target))

    # Also check vbproj for Reference to other BN projects
    for bn_dir in sorted(bn_dirs):
        source = bn_dir.upper()
        dir_path = os.path.join(BASE_DIR, bn_dir)
        try:
            for f in os.listdir(dir_path):
                if f.lower().endswith(".vbproj"):
                    filepath = os.path.join(dir_path, f)
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as fp:
                            content = fp.read()
                        # Find Reference Include="BNXX..."
                        for ref_m in re.finditer(r'<Reference\s+Include="(BNEG\d+|BNRG\w+|BNBU\d+|BNOW\d+)[^"]*"', content, re.IGNORECASE):
                            target = ref_m.group(1).upper()
                            if target != source:
                                connections.add((source, target))
                    except Exception:
                        pass
        except PermissionError:
            pass

    print(f"Found {len(modules)} modules")
    print(f"Found {len(connections)} connections")

    # Filter: only keep connections where both source AND target are known modules
    # but also add modules that are referenced but don't exist as folders (external)
    all_targets = {t for _, t in connections}
    all_sources = {s for s, _ in connections}

    referenced_external = (all_targets | all_sources) - modules
    if referenced_external:
        print(f"Referenced but no folder: {sorted(referenced_external)}")

    return modules, connections, module_descriptions

def group_module(name):
    """Return group/color category for module"""
    if name.startswith("BNEG"):
        return "BNEG"
    elif name.startswith("BNRG"):
        return "BNRG"
    elif name.startswith("BNBU"):
        return "BNBU"
    elif name.startswith("BNOW"):
        return "BNOW"
    elif name.startswith("BNEP") or name.startswith("BNEO"):
        return "OTHER"
    return "OTHER"

def build_graph_data(modules, connections, module_descriptions):
    # Keep only connections where BOTH endpoints have a real folder
    connections = {(s, t) for s, t in connections if s in modules and t in modules}

    # Build node list — only real modules (skip ghost references)
    all_nodes_names = modules

    node_list = sorted(all_nodes_names)
    node_index = {n: i for i, n in enumerate(node_list)}

    nodes = []
    for name in node_list:
        group = group_module(name)
        vb_count = len(module_descriptions.get(name, []))
        exists = name in modules
        nodes.append({
            "id": name,
            "name": name,
            "group": group,
            "val": max(1, vb_count),
            "exists": exists,
            "forms": module_descriptions.get(name, [])
        })

    links = []
    seen_links = set()
    for source, target in connections:
        key = (source, target)
        if key not in seen_links:
            seen_links.add(key)
            links.append({"source": source, "target": target})

    return {"nodes": nodes, "links": links}

if __name__ == "__main__":
    modules, connections, desc = extract_connections()
    graph = build_graph_data(modules, connections, desc)

    output_path = os.path.join(os.path.dirname(__file__), "graph_data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)

    print(f"\nGraph data saved to: {output_path}")
    print(f"Nodes: {len(graph['nodes'])}, Links: {len(graph['links'])}")

    # Print top connected modules
    from collections import Counter
    in_degree = Counter()
    out_degree = Counter()
    for link in graph["links"]:
        out_degree[link["source"]] += 1
        in_degree[link["target"]] += 1

    print("\nTop 10 most referenced (in-degree):")
    for name, cnt in in_degree.most_common(10):
        print(f"  {name}: {cnt}")

    print("\nTop 10 most connections out (out-degree):")
    for name, cnt in out_degree.most_common(10):
        print(f"  {name}: {cnt}")
