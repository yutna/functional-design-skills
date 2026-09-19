#!/usr/bin/env node
// Carries the version in package.json to the forty-five other places that
// repeat it: two manifests and every skill's frontmatter.
//
// The version is written in forty-six files and nothing in the packaging
// tooling keeps them in step, which makes a repository-wide replace
// tempting. Doing that once rewrote twenty-one dependency versions in
// package-lock.json that happened to match the old number, and `npm ci`
// did not notice, because it installs from the resolved URL and the
// integrity hash.
//
// So this is deliberately narrow. It rewrites one line per skill -- the
// `version:` inside the metadata block -- and one key per manifest. It
// reads package.json and never writes it, and it does not know
// package-lock.json exists. Run `npm version` first; that is what owns
// those two files.
//
// Usage:
//   npm version 3.0.1 --no-git-tag-version
//   node scripts/bump-version.mjs
//   npm test          # validate-skills.mjs proves all forty-six agree

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, SKILLS_DIR, skillIds } from './lib/pack.mjs'

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  process.stderr.write(`package.json version "${version}" is not a version\n`)
  process.exit(1)
}

let changed = 0
let already = 0

// Only the frontmatter, and only inside its metadata block. A `version:`
// in the prose of a skill about versioning transfer types is not this.
for (const id of skillIds()) {
  const path = join(SKILLS_DIR, id, 'SKILL.md')
  const raw = readFileSync(path, 'utf8')
  const front = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(raw)
  if (front === null) {
    process.stderr.write(`${id}: no frontmatter block\n`)
    process.exit(1)
  }
  const updated = front[0].replace(/^(  version: ).*$/m, `$1${version}`)
  if (updated === front[0]) {
    if (!front[0].includes(`  version: ${version}`)) {
      process.stderr.write(`${id}: no "  version:" line in the metadata block\n`)
      process.exit(1)
    }
    already++
    continue
  }
  writeFileSync(path, updated + raw.slice(front[0].length))
  changed++
}

for (const manifest of [
  join('plugin', '.claude-plugin', 'plugin.json'),
  join('.claude-plugin', 'marketplace.json'),
]) {
  const path = join(ROOT, manifest)
  const raw = readFileSync(path, 'utf8')
  // Replaced as text, not as parsed JSON, so key order and formatting
  // survive: a manifest reformatted by a bump is a diff nobody can read.
  const updated = raw.replace(/("version": ")[^"]*(")/g, `$1${version}$2`)
  if (updated === raw) already++
  else {
    writeFileSync(path, updated)
    changed++
  }
}

process.stdout.write(
  `ok    ${version} written to ${changed} file(s), ${already} already there\n`,
)
process.stdout.write('      run npm test; validate-skills.mjs checks all of them\n')
