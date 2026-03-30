#!/usr/bin/env python3
"""
Project Context Generator for Workflow Injection

Lightweight module that generates a concise project context summary
(directory tree + git info) suitable for injecting into agent workflows.
"""

import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, List


# Directories to skip — matches the set in api/scripts/generate_project_context.py
IGNORED_DIRS = {
    'node_modules', 'venv', '.venv', '__pycache__', '.git', 'dist', 'build',
    '.next', '.cache', 'target', 'vendor', '.npm', '.yarn', '.idea', '.vscode',
    'coverage', '.nyc_output', 'tmp', 'temp', '.tmp',
}

MAX_TREE_LINES = 50


# ---------------------------------------------------------------------------
# Git info
# ---------------------------------------------------------------------------

def _get_git_info(project_path: Path) -> Dict[str, Any]:
    """Gather git metadata. Never raises — returns partial results on failure."""
    git_info: Dict[str, Any] = {
        'is_git_repo': False,
        'branch': None,
        'last_commit': None,
        'remote_url': None,
        'has_changes': False,
    }

    if not (project_path / '.git').exists():
        return git_info

    git_info['is_git_repo'] = True

    def _run(*args: str) -> str:
        result = subprocess.run(
            ['git', '-C', str(project_path), *args],
            capture_output=True, text=True, timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else ''

    try:
        git_info['branch'] = _run('branch', '--show-current') or None

        raw = _run('log', '-1', '--pretty=%h|%s')
        if raw:
            h, _, msg = raw.partition('|')
            git_info['last_commit'] = {'hash': h, 'message': msg}

        for line in _run('remote', '-v').splitlines():
            if 'origin' in line and '(fetch)' in line:
                url = line.split()[1]
                if url.startswith('git@'):
                    url = url.replace(':', '/').replace('git@', 'https://')
                if url.endswith('.git'):
                    url = url[:-4]
                git_info['remote_url'] = url
                break

        git_info['has_changes'] = bool(_run('status', '--porcelain'))
    except Exception:
        # On *any* failure just keep whatever we collected so far.
        pass

    return git_info


# ---------------------------------------------------------------------------
# Directory-only tree
# ---------------------------------------------------------------------------

def build_directory_only_tree(project_path: str, max_depth: int = 4) -> str:
    """Return an ASCII tree of **directories only**, capped at ~50 lines."""

    root = Path(project_path).resolve()
    if not root.is_dir():
        return ''

    lines: List[str] = []
    lines.append(root.name + '/')

    def _walk(directory: Path, prefix: str, depth: int) -> None:
        if depth > max_depth or len(lines) >= MAX_TREE_LINES:
            return

        try:
            entries = sorted(
                [e for e in directory.iterdir() if e.is_dir() and e.name not in IGNORED_DIRS],
                key=lambda e: e.name.lower(),
            )
        except (PermissionError, OSError):
            return

        for i, entry in enumerate(entries):
            if len(lines) >= MAX_TREE_LINES:
                # Add a "..." indicator when truncated
                if lines[-1] != prefix.rstrip('├└─│ ') + '...':
                    indent = '│   ' * depth
                    lines.append(indent + '...')
                return

            connector = '└── ' if i == len(entries) - 1 else '├── '
            lines.append(prefix + connector + entry.name + '/')

            child_prefix = prefix + ('    ' if i == len(entries) - 1 else '│   ')
            _walk(entry, child_prefix, depth + 1)

    _walk(root, '', 0)

    if len(lines) > MAX_TREE_LINES:
        lines = lines[:MAX_TREE_LINES - 1] + ['...']

    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Git info formatter
# ---------------------------------------------------------------------------

def format_git_info(git_info: Dict[str, Any]) -> str:
    """Format a git_info dict into a concise text block."""
    if not git_info.get('is_git_repo'):
        return 'Not a git repository.'

    parts: List[str] = []

    parts.append(f"Branch: {git_info.get('branch') or 'unknown'}")

    lc = git_info.get('last_commit')
    if lc:
        parts.append(f"Last commit: {lc['hash']} - {lc['message']}")
    else:
        parts.append('Last commit: unavailable')

    remote = git_info.get('remote_url')
    parts.append(f"Remote: {remote or 'none'}")

    status = 'has uncommitted changes' if git_info.get('has_changes') else 'clean'
    parts.append(f"Working tree: {status}")

    return '\n'.join(parts)


# ---------------------------------------------------------------------------
# Main entry-point
# ---------------------------------------------------------------------------

def generate_workflow_context(project_path: str) -> str:
    """Build the full ``## Project Context`` markdown section.

    Returns an empty string when *project_path* does not exist.
    Never raises — errors are swallowed and surfaced as best-effort text.
    """
    root = Path(project_path).resolve()
    if not root.is_dir():
        return ''

    sections: List[str] = []

    # --- Directory structure ---
    try:
        tree = build_directory_only_tree(str(root))
        if tree:
            sections.append(f"### Directory Structure\n\n```\n{tree}\n```")
    except Exception:
        sections.append("### Directory Structure\n\n*(unable to read directory tree)*")

    # --- Git information ---
    try:
        git_info = _get_git_info(root)
        formatted = format_git_info(git_info)
        sections.append(f"### Git Information\n\n{formatted}")
    except Exception:
        sections.append("### Git Information\n\n*(unable to gather git info)*")

    if not sections:
        return ''

    return f"## Project Context\n\n{root}\n\n" + "\n\n".join(sections) + "\n"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <project_path>", file=sys.stderr)
        sys.exit(1)

    result = generate_workflow_context(sys.argv[1])
    if result:
        print(result)
    else:
        print(f"Error: path '{sys.argv[1]}' does not exist or is not a directory",
              file=sys.stderr)
        sys.exit(1)
