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
conflicts=0

PACK_NAME="functional-design-skills"

# Skills are copied flat into ~/.claude/skills, so two packs can claim the
# same directory name. Without this the second install just says "skip" and
# the user is quietly missing skills they believe they installed. Every
# SKILL.md carries the pack it came from under metadata.pack.
# tr -d '\r' because a Windows checkout of a Markdown file ends its lines
# \r\n, and Git Bash and WSL both read it that way. Without it the pack name
# came back as "functional-design-skills\r", matched nothing, and every one
# of this pack's own skills was reported as belonging to somebody else:
# forty-three conflicts and nothing installed.
pack_of() {
  sed -n '1,20p' "$1/SKILL.md" 2>/dev/null \
    | tr -d '\r' \
    | sed -n 's/^  pack: *//p' | head -n 1
}

# No trailing slash on the glob: with one, the shell sorts
# "functional-typescript-effect/" before "functional-typescript/",
# because "-" sorts before "/". The PowerShell pair and both Node
# scripts sort by name, and this is the only place that did not.
for src in "$SKILLS_SRC"/*; do
  [ -d "$src" ] || continue
  name="$(basename "$src")"
  dest="${CLAUDE_DIR}/${name}"

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    owner="$(pack_of "$dest")"
    # A directory that names no pack is not this pack's to delete. Most
    # skills in the world carry no marker -- metadata.pack is this pack's
    # own convention -- so treating "unmarked" as "mine" meant --force
    # removed a stranger's work without saying so. Being told to remove it
    # by hand is the cost of never doing that.
    if [ -z "$owner" ]; then
      printf 'unmarked %s claims no pack; remove it first if this pack should own it\n' "$name"
      conflicts=$((conflicts + 1))
      continue
    fi
    if [ "$owner" != "$PACK_NAME" ]; then
      printf 'conflict %s belongs to %s; remove it first\n' "$name" "$owner"
      conflicts=$((conflicts + 1))
      continue
    fi
    if [ "$force" -eq 0 ]; then
      printf 'skip   %s (already installed; use --force to replace)\n' "$name"
      skipped=$((skipped + 1))
      continue
    fi
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

printf '\n%d skill(s) installed, %d skipped, %d in conflict\n' \
  "$installed" "$skipped" "$conflicts"

if [ "$conflicts" -gt 0 ]; then
  printf 'A conflict means that skill name is already taken, by another\n'
  printf 'pack or by something that does not say. Neither is replaced, even\n'
  printf 'with --force. Remove the directory yourself to hand it over.\n'
fi

if [ "$installed" -gt 0 ] && [ "$dry_run" -eq 0 ]; then
  printf 'Start a new session for the skills to be discovered.\n'
fi
