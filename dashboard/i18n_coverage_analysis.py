#!/usr/bin/env python3
"""
Comprehensive i18n key coverage analysis for the weave dashboard.

Extracts all t('...') calls from TypeScript/TSX source files, builds the full
resource tree from JSON locale files as assembled in i18n.ts, and reports
mismatches.
"""

import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

DASHBOARD_SRC = "/root/projects/weave/dashboard/src"
LOCALES_DIR = os.path.join(DASHBOARD_SRC, "locales")

# The resource assembly structure from i18n.ts
RESOURCE_STRUCTURE = {
    "common": "common.json",
    "pages": {
        "dashboard": "dashboard.json",
        "workflows": "workflows.json",
        "projects": "projects.json",
        "agents": "agents.json",
        "settings": "settings.json",
        "chat": "chat.json",
        "approvals": "approvals.json",
        "marketplace": "marketplace.json",
        "kanban": "kanban.json",
    },
    "components": "components.json",
    "colors": "colors.json",
    "status": "status.json",
    "createPlan": "createPlan.json",
    "planDetail": "planDetail.json",
    "projectSelectDemo": "projectSelectDemo.json",
}


def flatten_json(obj, prefix=""):
    """Recursively flatten a JSON object into dot-notation paths."""
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys.update(flatten_json(v, full_key))
            else:
                keys.add(full_key)
    return keys


def build_resource_keys(locale_code):
    """
    Build the full set of resource keys for a locale by following the
    structure defined in i18n.ts.
    """
    locale_dir = os.path.join(LOCALES_DIR, locale_code)
    keys = set()

    def process_node(node_structure, prefix, locale_dir):
        for key, value in node_structure.items():
            full_prefix = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                # It's a nested section (e.g., "pages")
                process_node(value, full_prefix, locale_dir)
            elif isinstance(value, str):
                # It's a filename
                filepath = os.path.join(locale_dir, value)
                if os.path.exists(filepath):
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    flat = flatten_json(data, full_prefix)
                    keys.update(flat)
                else:
                    print(f"  WARNING: Missing file {filepath}", file=sys.stderr)

    process_node(RESOURCE_STRUCTURE, "", locale_dir)
    return keys


def extract_t_keys_from_source(src_dir):
    """
    Extract all i18n keys from t() calls in .ts and .tsx files.
    Handles single quotes, double quotes, template literals, and
    ignores variable-based keys.
    """
    # Regex to match t() calls with a string literal first argument
    # Captures: t('key'), t("key"), t(`key`)
    # Also handles: t('key', { ... }) -- we only want the key
    pattern = re.compile(
        r"""\bt\s*\(\s*"""                     # t(
        r"""['"`]"""                            # opening quote (single, double, or backtick)
        r"""([^'"`}]+)"""                       # the key content (no interpolation in backticks)
        r"""['"`]"""                            # closing quote
        r"""[\s,)]""",                          # followed by whitespace, comma, or closing paren
        re.MULTILINE
    )

    key_sources = defaultdict(set)  # key -> set of files
    skipped_variable_keys = set()

    for root, _dirs, files in os.walk(src_dir):
        for fname in files:
            if not (fname.endswith(".ts") or fname.endswith(".tsx")):
                continue

            filepath = os.path.join(root, fname)
            # Skip the i18n setup file itself
            if filepath.endswith("lib/i18n.ts"):
                continue
            # Skip test/demo files
            if ".test." in fname or ".example." in fname or fname.endswith(".demo.tsx"):
                continue
            # Skip files in locales directory
            if "locales" in filepath:
                continue

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
            except (IOError, UnicodeDecodeError):
                continue

            rel_path = os.path.relpath(filepath, src_dir)
            matches = pattern.findall(content)

            for match in matches:
                match = match.strip()
                # Skip empty keys
                if not match:
                    continue
                # Skip keys that look like template interpolations
                if "${" in match:
                    skipped_variable_keys.add((match, rel_path))
                    continue
                # Skip keys that contain spaces (likely not real i18n keys)
                # unless they are very short (could be real)
                if " " in match and len(match) > 40:
                    skipped_variable_keys.add((match, rel_path))
                    continue
                key_sources[match].add(rel_path)

    return key_sources, skipped_variable_keys


def main():
    print("=" * 80)
    print("  I18N KEY COVERAGE ANALYSIS")
    print("=" * 80)
    print()

    # --- Step 1: Extract keys from source code ---
    print("[Step 1] Extracting t() keys from TypeScript/TSX source files...")
    key_sources, skipped = extract_t_keys_from_source(DASHBOARD_SRC)
    code_keys = set(key_sources.keys())
    print(f"  Found {len(code_keys)} unique t() keys in source code")
    print(f"  Skipped {len(skipped)} variable/interpolated keys")
    print()

    # --- Step 2: Build resource trees ---
    print("[Step 2] Building resource trees from locale JSON files...")
    en_us_keys = build_resource_keys("en-US")
    pt_br_keys = build_resource_keys("pt-BR")
    print(f"  en-US: {len(en_us_keys)} resource keys")
    print(f"  pt-BR: {len(pt_br_keys)} resource keys")
    print()

    # --- Step 3: Compare code keys vs resource keys ---
    missing_en_us = code_keys - en_us_keys
    missing_pt_br = code_keys - pt_br_keys
    unused_en_us = en_us_keys - code_keys
    unused_pt_br = pt_br_keys - code_keys

    print("=" * 80)
    print("  RESULTS")
    print("=" * 80)
    print()

    # Summary
    print("-" * 40)
    print("  SUMMARY")
    print("-" * 40)
    print(f"  Unique t() keys in code:         {len(code_keys)}")
    print(f"  Resource keys (en-US):           {len(en_us_keys)}")
    print(f"  Resource keys (pt-BR):           {len(pt_br_keys)}")
    print(f"  Keys missing from en-US:         {len(missing_en_us)}")
    print(f"  Keys missing from pt-BR:         {len(missing_pt_br)}")
    print(f"  en-US keys not used in code:     {len(unused_en_us)}")
    print(f"  pt-BR keys not used in code:     {len(unused_pt_br)}")
    print()

    # Missing from en-US
    print("-" * 40)
    print("  KEYS USED IN CODE BUT MISSING FROM en-US")
    print("-" * 40)
    if missing_en_us:
        for key in sorted(missing_en_us):
            files = sorted(key_sources[key])
            print(f"    {key}")
            for f in files:
                print(f"      -> {f}")
    else:
        print("    None - all code keys are present in en-US resources.")
    print()

    # Missing from pt-BR
    print("-" * 40)
    print("  KEYS USED IN CODE BUT MISSING FROM pt-BR")
    print("-" * 40)
    if missing_pt_br:
        for key in sorted(missing_pt_br):
            files = sorted(key_sources[key])
            print(f"    {key}")
            for f in files:
                print(f"      -> {f}")
    else:
        print("    None - all code keys are present in pt-BR resources.")
    print()

    # Keys present in en-US but not in pt-BR
    print("-" * 40)
    print("  KEYS IN en-US BUT MISSING FROM pt-BR (locale gap)")
    print("-" * 40)
    locale_gap = en_us_keys - pt_br_keys
    if locale_gap:
        for key in sorted(locale_gap):
            print(f"    {key}")
        print(f"  Total: {len(locale_gap)}")
    else:
        print("    None - pt-BR has full parity with en-US.")
    print()

    # Keys present in pt-BR but not in en-US
    print("-" * 40)
    print("  KEYS IN pt-BR BUT NOT IN en-US (extra translations)")
    print("-" * 40)
    extra_pt_br = pt_br_keys - en_us_keys
    if extra_pt_br:
        for key in sorted(extra_pt_br):
            print(f"    {key}")
        print(f"  Total: {len(extra_pt_br)}")
    else:
        print("    None.")
    print()

    # Unused keys (present in resources but never referenced in code)
    print("-" * 40)
    print("  RESOURCE KEYS NEVER REFERENCED IN CODE (potential dead keys)")
    print("-" * 40)
    print(f"  en-US unused: {len(unused_en_us)}")
    if unused_en_us:
        # Group by top-level namespace
        by_ns = defaultdict(list)
        for key in sorted(unused_en_us):
            ns = key.split(".")[0]
            by_ns[ns].append(key)
        for ns in sorted(by_ns.keys()):
            print(f"    [{ns}] ({len(by_ns[ns])} keys)")
            for key in by_ns[ns][:5]:  # Show first 5 per namespace
                print(f"      {key}")
            if len(by_ns[ns]) > 5:
                print(f"      ... and {len(by_ns[ns]) - 5} more")
    print()

    # Skipped keys (for reference)
    if skipped:
        print("-" * 40)
        print("  SKIPPED VARIABLE/INTERPOLATED KEYS (not analyzed)")
        print("-" * 40)
        for key, path in sorted(skipped):
            print(f"    {key}")
            print(f"      -> {path}")
        print()

    # Critical issues summary
    print("=" * 80)
    print("  CRITICAL ISSUES SUMMARY")
    print("=" * 80)
    critical_count = len(missing_en_us) + len(missing_pt_br) + len(locale_gap)
    if critical_count == 0:
        print("  No critical issues found. All t() keys resolve in both locales")
        print("  and pt-BR has full parity with en-US.")
    else:
        print(f"  {len(missing_en_us)} keys missing from en-US (will show raw key in UI)")
        print(f"  {len(missing_pt_br)} keys missing from pt-BR (will fall back to en-US)")
        print(f"  {len(locale_gap)} keys in en-US with no pt-BR translation")
    print()
    print("=" * 80)


if __name__ == "__main__":
    main()
