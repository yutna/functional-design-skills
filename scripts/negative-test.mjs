#!/usr/bin/env node
// Breaks each guard in validate-skills.mjs on purpose and confirms it fires.
//
// A guard that has never failed has never been tested. This repository's rule
// is that a new check must be given the defect it is meant to catch before it
// is trusted, and this script is how that stays true after the day it was
// written.
//
// Everything happens in a throwaway copy under the system temp directory, so
// the working tree is never modified and an interrupted run leaves nothing
// behind. validate-prose.mjs tests itself in memory with --selftest; run both.
//
// Usage: node scripts/negative-test.mjs

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILL = join('plugin', 'skills', 'folding-over-data', 'SKILL.md')

// Each case: what we break, the edit that breaks it, the text the validator
// must produce, and which validator. The edit is [find, replace] applied to
// one file; the script defaults to validate-skills.mjs.
const CASES = [
  ['name mismatches its directory', SKILL,
    ['name: folding-over-data', 'name: folding-over-datum'], 'but the directory is'],
  ['a frontmatter key the platform has not got', SKILL,
    ['license: MIT', 'license: MIT\ncolour: blue'], 'is not one Claude Code accepts'],
  ['a skill left on the previous version', SKILL,
    ['version: ', 'version: 0.'], 'but package.json is'],
  ['a licence that is not MIT', SKILL,
    ['license: MIT', 'license: Apache-2.0'], 'must be "MIT"'],
  ['a description that summarises instead of triggering', SKILL,
    ['description: Use when ', 'description: This skill covers '], 'must open with "Use when "'],
  ['a description past this pack\'s length limit', SKILL,
    ['description: Use when ', `description: Use when ${'x'.repeat(200)} `], "this pack's limit is"],
  ['a second level-one heading', SKILL,
    ['## Overview', '# Overview'], 'level-one headings, expected 1'],
  ['a link to a reference that is not there', SKILL,
    ['references/monoids.md', 'references/nope.md'], 'but the file is missing'],
  ['a long reference with no way into it',
    join('plugin', 'skills', 'folding-over-data', 'references', 'monoids.md'),
    ['## Contents', '## Table of contents'], 'has no contents list'],
  ['a contents list whose anchor matches no heading',
    join('plugin', 'skills', 'folding-over-data', 'references', 'monoids.md'),
    ['## Familiar examples', '## Familiar exampels'], 'no heading matches the anchor'],
  ['a reference no skill links to', SKILL,
    ['[fold-recipes.md](references/fold-recipes.md)', 'fold-recipes.md'], 'is not linked from its own SKILL.md'],
  ['a plugin manifest left behind at the old version', join('plugin', '.claude-plugin', 'plugin.json'),
    ['"version": "', '"version": "0.'], 'plugin.json: "version"'],
  ['a marketplace entry left behind', join('.claude-plugin', 'marketplace.json'),
    ['"version": "', '"version": "0.'], 'marketplace.json:'],
  ['a caret range instead of an exact pin', 'package.json',
    ['"yaml": "', '"yaml": "^'], 'pinned to an exact version'],
  ['an ellipsis where the language expects code',
    join('plugin', 'skills', 'functional-typescript', 'SKILL.md'),
    ['  /* ... */', '  ...'], 'not the language the fence claims',
    'validate-examples.mjs'],
  ['an example whose fence claims the wrong language',
    join('plugin', 'skills', 'functional-typescript', 'SKILL.md'),
    ['```ts', '```json'], 'not the language the fence claims',
    'validate-examples.mjs'],
]

const work = mkdtempSync(join(tmpdir(), 'fds-negative-'))
for (const dir of ['scripts', 'plugin', '.claude-plugin']) {
  cpSync(join(ROOT, dir), join(work, dir), { recursive: true })
}
cpSync(join(ROOT, 'package.json'), join(work, 'package.json'))
// The validator imports `yaml`; point the copy at the real install.
cpSync(join(ROOT, 'node_modules'), join(work, 'node_modules'), { recursive: true })

function run (script = 'validate-skills.mjs') {
  const result = spawnSync(process.execPath, [join(work, 'scripts', script)], {
    encoding: 'utf8',
  })
  return `${result.stdout}${result.stderr}`
}

let failures = 0
for (const script of ['validate-skills.mjs', 'validate-examples.mjs']) {
  const baseline = run(script)
  if (!baseline.startsWith('ok')) {
    process.stderr.write(`${script} baseline is not clean, so nothing below proves anything:\n${baseline}\n`)
    failures++
  }
}

for (const [label, file, [find, replace], expected, script] of CASES) {
  const path = join(work, file)
  const original = readFileSync(path, 'utf8')
  if (!original.includes(find)) {
    process.stderr.write(`neg FAIL ${label} -> "${find}" is not in ${file}\n`)
    failures++
    continue
  }
  writeFileSync(path, original.replace(find, replace))
  const output = run(script)
  writeFileSync(path, original)
  if (output.includes(expected)) {
    process.stdout.write(`neg ok   ${label}\n`)
  } else {
    process.stderr.write(`neg FAIL ${label} -> expected "${expected}", got:\n${output}\n`)
    failures++
  }
}

rmSync(work, { recursive: true, force: true })

if (failures > 0) {
  process.stderr.write(`\n${failures} guard(s) did not fire on their own defect\n`)
  process.exit(1)
}
process.stdout.write(`\n${CASES.length} guard(s) fired on the defect each was written for\n`)
