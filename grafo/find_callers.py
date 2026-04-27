#!/usr/bin/env python3
"""
Find which BIZ2017 modules call a given module.
Usage: python find_callers.py BNEGCM00

Searches for:
  1. NTSIstanziaDll calls referencing the target DLL name
  2. RunChild calls referencing the target module name
"""

import os
import re
import sys

BASE_DIR = r"C:\BIZ2017"

RE_COMMENT = re.compile(r"^\s*'")

RE_ISTANZIA = re.compile(
    r'NTSIstanziaDll\s*\([^,]+,\s*[^,]+,\s*"([^"]+)"',
    re.IGNORECASE
)
RE_RUNCHILD = re.compile(
    r'RunChild\s*\(.+?"(BN[A-Z0-9_]+)"',
    re.IGNORECASE
)


def find_callers(target: str) -> list[str]:
    target = target.upper()
    callers = set()

    try:
        bn_dirs = [
            d for d in os.listdir(BASE_DIR)
            if d.upper().startswith("BN")
            and os.path.isdir(os.path.join(BASE_DIR, d))
            and not d.endswith((" - Copia", " - Copia (2)", " - Copia (3)"))
        ]
    except FileNotFoundError:
        print(f"ERROR: BIZ2017 not found at {BASE_DIR}", file=sys.stderr)
        sys.exit(1)

    for bn_dir in bn_dirs:
        source = bn_dir.upper()
        if source == target:
            continue

        dir_path = os.path.join(BASE_DIR, bn_dir)
        try:
            vb_files = [f for f in os.listdir(dir_path)
                        if f.lower().endswith(".vb")
                        and not f.lower().endswith(".designer.vb")]
        except PermissionError:
            continue

        for vb_file in vb_files:
            filepath = os.path.join(dir_path, vb_file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if RE_COMMENT.match(line):
                            continue
                        for m in RE_ISTANZIA.finditer(line):
                            if m.group(1).upper() == target:
                                callers.add(source)
                        for m in RE_RUNCHILD.finditer(line):
                            if m.group(1).upper() == target:
                                callers.add(source)
            except Exception:
                continue

    return sorted(callers)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python find_callers.py <MODULE>")
        sys.exit(1)

    target = sys.argv[1]
    callers = find_callers(target)

    if callers:
        print(", ".join(callers))
    else:
        print("—")
