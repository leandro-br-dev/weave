#!/usr/bin/env python3
"""
Generate Project Context Script

This script analyzes a project directory and generates a structured JSON output containing:
1. File structure tree (filtered for relevant files)
2. Git information (if available)
3. Project statistics (file counts, directory overview)
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any, Set
from collections import defaultdict, Counter
import subprocess


# Default directories to ignore
IGNORED_DIRS = {
    'node_modules', 'venv', '.venv', '__pycache__', '.git', 'dist', 'build',
    '.next', '.cache', 'target', 'vendor', '.npm', '.yarn', '.idea', '.vscode',
    'coverage', '.nyc_output', 'tmp', 'temp', '.tmp'
}

# File patterns/extensions to ignore
IGNORED_PATTERNS = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '*.min.js', '*.min.css', '*.map',
    '.DS_Store', 'Thumbs.db'
}

# Relevant file extensions to include
RELEVANT_EXTENSIONS = {
    # Source code
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.kt', '.cs', '.cpp', '.c', '.h',
    '.php', '.rb', '.swift', '.dart', '.scala', '.clj',
    # Configs
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.env.example', '.env.dist',
    # Docs & other
    '.md', '.txt', '.rst', '.adoc',
    # Markup & Styles
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte',
    # Shell & Scripts
    '.sh', '.bash', '.zsh', '.fish', '.ps1',
    '.dockerfile', 'dockerfile'
}

# Always include these files regardless of extension
ALWAYS_INCLUDE = {
    'README', 'LICENSE', 'Makefile', 'Dockerfile', 'docker-compose.yml',
    '.gitignore', '.gitattributes', '.env.example',
    'package.json', 'tsconfig.json', 'pyproject.toml', 'setup.py',
    'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml'
}


def is_ignored(path: Path) -> bool:
    """Check if a path should be ignored based on patterns."""
    name = path.name

    # Check if it's in ignored directories
    if path.is_dir() and name in IGNORED_DIRS:
        return True

    # Check file patterns
    if path.is_file():
        # Check exact matches
        if name in IGNORED_PATTERNS:
            return True

        # Check wildcard patterns
        for pattern in IGNORED_PATTERNS:
            if pattern.startswith('*.'):
                if name.endswith(pattern[1:]):
                    return True

    return False


def is_relevant_file(path: Path) -> bool:
    """Check if a file is relevant for the project context."""
    if is_ignored(path):
        return False

    # Always include certain files
    if path.name in ALWAYS_INCLUDE:
        return True

    # Check extension
    if path.suffix.lower() in RELEVANT_EXTENSIONS:
        return True

    # Include files without extension if they're executable or special
    if path.suffix == '' and path.stat().st_size > 0 and path.stat().st_size < 100000:
        # Small text files without extension (likely scripts or configs)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                f.read(1024)  # Try to read as text
            return True
        except:
            pass

    return False


def should_traverse_directory(path: Path) -> bool:
    """Check if we should traverse into a directory."""
    return not is_ignored(path)


def build_file_tree(root_path: Path, max_depth: int = 10) -> Dict[str, Any]:
    """Build a tree structure of the project files."""
    def build_tree(path: Path, current_depth: int = 0) -> Dict[str, Any]:
        if current_depth > max_depth:
            return {}

        try:
            items = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        except PermissionError:
            return {}

        tree = {'type': 'directory', 'name': path.name, 'path': str(path.relative_to(root_path)), 'children': []}

        for item in items:
            if is_ignored(item):
                continue

            if item.is_dir() and should_traverse_directory(item):
                child_tree = build_tree(item, current_depth + 1)
                if child_tree:
                    tree['children'].append(child_tree)
            elif item.is_file() and is_relevant_file(item):
                tree['children'].append({
                    'type': 'file',
                    'name': item.name,
                    'path': str(item.relative_to(root_path)),
                    'extension': item.suffix
                })

        return tree

    return build_tree(root_path)


def get_git_info(project_path: Path, repo_url: str = None) -> Dict[str, Any]:
    """Get git information from the repository."""
    git_info = {
        'is_git_repo': False,
        'branch': None,
        'last_commit': None,
        'remote_url': repo_url,
        'has_changes': False
    }

    git_dir = project_path / '.git'
    if not git_dir.exists():
        return git_info

    git_info['is_git_repo'] = True

    try:
        # Try using git commands first
        result = subprocess.run(
            ['git', '-C', str(project_path), 'branch', '--show-current'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info['branch'] = result.stdout.strip()

        result = subprocess.run(
            ['git', '-C', str(project_path), 'log', '-1', '--pretty=%h|%s'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split('|', 1)
            if len(parts) == 2:
                git_info['last_commit'] = {
                    'hash': parts[0],
                    'message': parts[1]
                }

        result = subprocess.run(
            ['git', '-C', str(project_path), 'remote', '-v'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and not git_info['remote_url']:
            for line in result.stdout.strip().split('\n'):
                if 'origin' in line and '(fetch)' in line:
                    url = line.split()[1]
                    # Clean up URL
                    if url.startswith('git@'):
                        url = url.replace(':', '/').replace('git@', 'https://')
                    if url.endswith('.git'):
                        url = url[:-4]
                    git_info['remote_url'] = url
                    break

        result = subprocess.run(
            ['git', '-C', str(project_path), 'status', '--porcelain'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            git_info['has_changes'] = len(result.stdout.strip()) > 0

    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        # Git commands failed, try using gitpython if available
        try:
            import git
            repo = git.Repo(project_path)

            try:
                git_info['branch'] = repo.active_branch.name
            except:
                pass

            try:
                last_commit = repo.head.commit
                git_info['last_commit'] = {
                    'hash': last_commit.hexsha[:7],
                    'message': last_commit.message.strip()
                }
            except:
                pass

            try:
                if not git_info['remote_url'] and repo.remotes:
                    origin = repo.remotes.origin
                    url = origin.url
                    # Clean up URL
                    if url.startswith('git@'):
                        url = url.replace(':', '/').replace('git@', 'https://')
                    if url.endswith('.git'):
                        url = url[:-4]
                    git_info['remote_url'] = url
            except:
                pass

            git_info['has_changes'] = repo.is_dirty()
        except ImportError:
            pass
        except Exception:
            pass

    return git_info


def collect_statistics(root_path: Path, file_tree: Dict[str, Any]) -> Dict[str, Any]:
    """Collect project statistics from the already-built file tree."""
    stats = {
        'file_counts': Counter(),
        'total_files': 0,
        'total_dirs': 0,
        'languages': {}
    }

    # Common directory descriptions
    dir_descriptions = {
        'src': 'Source code',
        'lib': 'Library code',
        'app': 'Application code',
        'components': 'UI components',
        'pages': 'Page components',
        'views': 'View components',
        'utils': 'Utility functions',
        'helpers': 'Helper functions',
        'services': 'Service layer',
        'api': 'API endpoints/clients',
        'tests': 'Test files',
        'test': 'Test files',
        '__tests__': 'Test files',
        'spec': 'Test specifications',
        'specs': 'Test specifications',
        'config': 'Configuration files',
        'configs': 'Configuration files',
        'public': 'Public assets',
        'assets': 'Static assets',
        'static': 'Static files',
        'styles': 'Style files',
        'scripts': 'Build/utility scripts',
        'docs': 'Documentation',
        'doc': 'Documentation',
        'examples': 'Example files',
        'tools': 'Development tools',
        'types': 'Type definitions',
        'interfaces': 'Interface definitions',
        'store': 'State management',
        'stores': 'State management',
        'redux': 'Redux state management',
        'context': 'React context',
        'hooks': 'Custom hooks',
        'middleware': 'Middleware',
        'routes': 'Route definitions',
        'controllers': 'Controllers',
        'models': 'Data models',
        'schemas': 'Schemas/validation',
        'migrations': 'Database migrations',
        'seed': 'Database seed data',
        'seeds': 'Database seed data',
    }

    def count_in_tree(node: Dict[str, Any]):
        """Recursively count files and directories in the tree."""
        if node.get('type') == 'directory':
            stats['total_dirs'] += 1
            dir_name = node.get('name', '').lower()
            if dir_name in dir_descriptions:
                rel_path = node.get('path', '')
                stats['directories'][rel_path] = dir_descriptions[dir_name]

            for child in node.get('children', []):
                count_in_tree(child)
        elif node.get('type') == 'file':
            stats['total_files'] += 1
            ext = node.get('extension', '').lower()
            if ext:
                stats['file_counts'][ext] += 1
            else:
                stats['file_counts']['(no extension)'] += 1

    # Initialize directories dict
    stats['directories'] = {}

    # Count from the filtered tree
    count_in_tree(file_tree)

    # Convert extension counts to language names
    ext_to_lang = {
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript React',
        '.js': 'JavaScript',
        '.jsx': 'JavaScript React',
        '.mjs': 'JavaScript',
        '.cjs': 'JavaScript',
        '.py': 'Python',
        '.go': 'Go',
        '.rs': 'Rust',
        '.java': 'Java',
        '.kt': 'Kotlin',
        '.cs': 'C#',
        '.cpp': 'C++',
        '.c': 'C',
        '.h': 'C/C++ Header',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.dart': 'Dart',
        '.scala': 'Scala',
        '.clj': 'Clojure',
        '.json': 'JSON',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.toml': 'TOML',
        '.ini': 'INI',
        '.cfg': 'Config',
        '.conf': 'Config',
        '.md': 'Markdown',
        '.txt': 'Text',
        '.rst': 'reStructuredText',
        '.adoc': 'AsciiDoc',
        '.html': 'HTML',
        '.htm': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.sass': 'Sass',
        '.less': 'Less',
        '.vue': 'Vue',
        '.svelte': 'Svelte',
        '.sh': 'Shell',
        '.bash': 'Bash',
        '.zsh': 'Zsh',
        '.fish': 'Fish',
        '.ps1': 'PowerShell',
    }

    languages = Counter()
    for ext, count in stats['file_counts'].items():
        lang = ext_to_lang.get(ext, ext or 'Unknown')
        languages[lang] += count

    # Convert Counter to regular dict for JSON serialization
    stats['file_counts'] = dict(stats['file_counts'])
    stats['languages'] = dict(languages)

    return stats


def format_tree_for_display(tree: Dict[str, Any], indent: int = 0, prefix: str = '') -> str:
    """Format the file tree for display (optional text output)."""
    lines = []

    if tree['type'] == 'directory':
        lines.append(f"{'  ' * indent}{prefix}📁 {tree['name']}/")
        for i, child in enumerate(tree.get('children', [])):
            is_last = i == len(tree.get('children', [])) - 1
            child_prefix = '└── ' if is_last else '├── '
            lines.append(format_tree_for_display(child, indent + 1, child_prefix))
    else:
        icon = '📄'
        ext = tree.get('extension', '')
        if ext in ['.ts', '.tsx', '.js', '.jsx']:
            icon = '📜'
        elif ext == '.py':
            icon = '🐍'
        elif ext == '.json':
            icon = '📋'
        elif ext == '.md':
            icon = '📝'
        elif ext in ['.yaml', '.yml']:
            icon = '⚙️'

        lines.append(f"{'  ' * indent}{prefix}{icon} {tree['name']}")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Generate project context with file structure, git info, and statistics'
    )
    parser.add_argument(
        'project_path',
        type=str,
        help='Path to the project directory'
    )
    parser.add_argument(
        '--repo-url',
        type=str,
        default=None,
        help='Git repository URL (optional)'
    )
    parser.add_argument(
        '--output',
        '-o',
        type=str,
        choices=['json', 'text', 'both'],
        default='json',
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--max-depth',
        type=int,
        default=10,
        help='Maximum depth for file tree traversal (default: 10)'
    )

    args = parser.parse_args()

    project_path = Path(args.project_path).resolve()

    if not project_path.exists():
        print(f"Error: Path '{project_path}' does not exist", file=sys.stderr)
        sys.exit(1)

    if not project_path.is_dir():
        print(f"Error: Path '{project_path}' is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Analyzing project: {project_path}", file=sys.stderr)

    # Build file tree
    print("Building file structure...", file=sys.stderr)
    file_tree = build_file_tree(project_path, args.max_depth)

    # Get git information
    print("Gathering git information...", file=sys.stderr)
    git_info = get_git_info(project_path, args.repo_url)

    # Collect statistics
    print("Collecting statistics...", file=sys.stderr)
    stats = collect_statistics(project_path, file_tree)

    # Build output
    output = {
        'structure': file_tree,
        'git_info': git_info,
        'stats': stats
    }

    # Output results
    if args.output in ['json', 'both']:
        print(json.dumps(output, indent=2, ensure_ascii=False))

    if args.output in ['text', 'both']:
        if args.output == 'both':
            print("\n" + "="*80)
        print("\n📊 Project Structure:")
        print(format_tree_for_display(file_tree))

        if git_info['is_git_repo']:
            print("\n🔧 Git Information:")
            print(f"  Branch: {git_info['branch'] or 'N/A'}")
            if git_info['last_commit']:
                print(f"  Last Commit: {git_info['last_commit']['hash']} - {git_info['last_commit']['message']}")
            print(f"  Remote: {git_info['remote_url'] or 'N/A'}")
            print(f"  Status: {'✓ Clean' if not git_info['has_changes'] else '⚠ Has changes'}")

        print("\n📈 Statistics:")
        print(f"  Total Files: {stats['total_files']}")
        print(f"  Total Directories: {stats['total_dirs']}")
        print(f"  Files by Extension:")
        for ext, count in sorted(stats['file_counts'].items(), key=lambda x: x[1], reverse=True):
            print(f"    {ext or '(no ext)'}: {count}")

        if stats['directories']:
            print(f"\n  Key Directories:")
            for path, desc in sorted(stats['directories'].items()):
                print(f"    {path}: {desc}")


if __name__ == '__main__':
    main()
