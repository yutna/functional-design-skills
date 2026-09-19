#!/usr/bin/env bash
#
# Installs the skills into ~/.claude/skills, where Claude Code discovers
# personal skills in every project.
#
# Each plugin/skills/<name> directory is copied whole, so the installed copy
# is independent of this checkout. To work on the skills instead, use
# scripts/link-local.sh, which links them into the repository itself.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="${REPO_ROOT}/plugin/skills"

CLAUDE_DIR="${HOME}/.claude/skills"

dry_run=0
force=0

usage() {
  cat <<'USAGE'
Usage: scripts/install.sh [options]

Copies every plugin/skills/<name> directory into ~/.claude/skills.

Options:
  --force         Overwrite skills that are already installed
  --dry-run       Print what would happen and change nothing
  -h, --help      Show this message
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --force)       force=1 ;;
    --dry-run)     dry_run=1 ;;
    -h|--help)     usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ ! -d "$SKILLS_SRC" ]; then
  printf 'error: %s not found\n' "$SKILLS_SRC" >&2
  exit 1
fi

installed=0
skipped=0

for src in "$SKILLS_SRC"/*/; do
  [ -d "$src" ] || continue
  name="$(basename "$src")"
  dest="${CLAUDE_DIR}/${name}"

  if { [ -e "$dest" ] || [ -L "$dest" ]; } && [ "$force" -eq 0 ]; then
    printf 'skip   %s (already installed; use --force to replace)\n' "$name"
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$dry_run" -eq 1 ]; then
    printf 'would   copy %s -> %s\n' "$name" "$dest"
  else
    mkdir -p "$CLAUDE_DIR"
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      rm -rf "$dest"
    fi
    cp -R "$src" "$dest"
    printf 'copied %s -> %s\n' "$name" "$dest"
  fi

  installed=$((installed + 1))
done

printf '\n%d skill(s) installed, %d skipped\n' "$installed" "$skipped"

if [ "$installed" -gt 0 ] && [ "$dry_run" -eq 0 ]; then
  printf 'Start a new session for the skills to be discovered.\n'
fi
