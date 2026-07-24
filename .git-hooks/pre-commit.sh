#!/usr/bin/env bash
# MyTools pre-commit hook
# 清理 repo-tree.json 中指向已删除文件的 stale 条目
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
TREE_FILE="$REPO_ROOT/assets/data/repo-tree.json"

if [ ! -f "$TREE_FILE" ]; then
  exit 0
fi

python3 << 'PYEOF'
import json, os

root = os.environ.get("REPO_ROOT", ".") or "."
tree_file = os.path.join(root, "assets/data/repo-tree.json")

def build_valid_paths(repo_root):
    """Build set of all files that currently exist on disk."""
    valid = set()
    skip_dirs = {'.git', '__pycache__', '.pytest_cache', '.mypy_cache'}
    for dirpath, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, repo_root)
            # Keep the original relative path — do NOT strip leading dots
            valid.add(rel)
    return valid

valid = build_valid_paths(root)

with open(tree_file) as f:
    tree = json.load(f)

removed_count = 0

def walk_clean(node):
    global removed_count
    if not isinstance(node, dict):
        return False

    path = node.get('path', '')
    if path:
        # Strip exactly leading "./" (2 chars), not arbitrary dots
        normalized = path[2:] if path.startswith('./') else path
        normalized = normalized.replace('\\', '/')
        if normalized not in valid:
            print(f'  🗑️  Stale: {node["name"]} ({path})')
            removed_count += 1
            return True

    elif node.get('type') == 'dir':
        new_children = []
        for child in node.get('children', []):
            should_remove = walk_clean(child)
            if not should_remove:
                new_children.append(child)
        node['children'] = new_children
        return False

    # Top-level file entry without explicit path field (e.g., old PORTAL.md)
    elif not path and node.get('type') == 'file':
        name = node.get('name', '')
        if name and name not in valid:
            print(f'  🗑️  Stale (no path): {name}')
            removed_count += 1
            return True

    return False

new_tree = []
for item in tree:
    should_remove = walk_clean(item)
    if not should_remove:
        new_tree.append(item)

tree = new_tree

with open(tree_file, 'w') as f:
    json.dump(tree, f, ensure_ascii=False, indent=2)
    f.write('\n')

if removed_count > 0:
    print(f'✅ 清理 {removed_count} 个失效条目。')
else:
    print('✅ repo-tree.json 无失效条目，无需更新。')
PYEOF
