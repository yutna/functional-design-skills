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
const SKILL = join('plugin', 'skills', 'functional-folding-over-data', 'SKILL.md')

// Each case: what we break, the edit that breaks it, the text the validator
// must produce, and which validator. The edit is [find, replace] applied to
// one file, or to each of several when the defect needs more than one --
// a paragraph only counts as duplicated once it is in two places. A third
// element in
// the edit array replaces every occurrence rather than the first, which some
// defects need: a link checked with `includes` is only broken once the last
// copy of it is gone.
const CASES = [
  ['name mismatches its directory', SKILL,
    ['name: functional-folding-over-data', 'name: folding-over-datum'], 'but the directory is'],
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
    join('plugin', 'skills', 'functional-folding-over-data', 'references', 'monoids.md'),
    ['## Contents', '## Table of contents'], 'has no contents list'],
  ['a contents list whose anchor matches no heading',
    join('plugin', 'skills', 'functional-folding-over-data', 'references', 'monoids.md'),
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
  ['a skill that does not say which pack it came from', SKILL,
    ['  pack: functional-design-skills\n', ''],
    '"metadata.pack" is missing'],
  ['a skill carrying another pack\'s name', SKILL,
    ['pack: functional-design-skills', 'pack: object-oriented-design-skills'],
    'but this pack is'],
  ['an eval naming a skill that no longer exists',
    join('evals', 'scenarios.md'),
    ['`functional-folding-over-data`', '`functional-folding-over-datum`'],
    'which is not a skill'],
  ['a pack that extends another without linking to it',
    join('plugin', 'skills', 'functional-typescript-effect', 'SKILL.md'),
    ['../functional-typescript/SKILL.md', '../functional-design/SKILL.md', 'all'],
    'but does not link to it'],
  ['a core rule with no strictness label', SKILL,
    ['1. Default. **Name the accumulator', '1. **Name the accumulator'],
    'has no strictness label', 'validate-rules.mjs'],
  ['a core rule labelled with a word that is not one of the three', SKILL,
    ['1. Default. **Name the accumulator', '1. Maybe. **Name the accumulator'],
    'not one of Rule, Default, Judgement', 'validate-rules.mjs'],
  ['a documented count that no longer matches reality',
    join('evals', 'README.md'),
    ['holds thirty-eight fuller problems', 'holds thirty-five fuller problems'],
    'but there are 38', 'validate-counts.mjs'],
  ['a claim whose sentence was rewritten, so nothing checks it',
    join('evals', 'README.md'),
    ['holds thirty-eight fuller problems', 'holds a good number of problems'],
    'was rewritten', 'validate-counts.mjs'],
  ['a bibliographic reference in a tracked file', SKILL,
    ['## Pattern', '## Pattern\n\nStated in Chapter 7 of the other book.'],
    'this pack cites no sources', 'validate-prose.mjs'],
  ['the same paragraph in a pack and its grandparent',
    [join('plugin', 'skills', 'functional-typescript', 'SKILL.md'),
      join('plugin', 'skills', 'functional-typescript-react-nextjs', 'SKILL.md')],
    ['## Red flags',
      '## Red flags\n\nA value that crosses a process boundary arrives as its ' +
      'shape without\nits guarantees, so the type on the far side is a claim ' +
      'nobody checked\nuntil something parses it back.'],
    'repeats a paragraph from', 'validate-prose.mjs'],
  ['the same paragraph in a pack and the pack it extends',
    [join('plugin', 'skills', 'functional-typescript', 'SKILL.md'),
      join('plugin', 'skills', 'functional-typescript-effect', 'SKILL.md')],
    ['## Pattern',
      '## Pattern\n\nA branded identifier survives the round trip only when ' +
      'the parser and\nthe serialiser agree on the encoded shape, which is ' +
      'why both live in\none module and neither is exported on its own.'],
    'repeats a paragraph from', 'validate-prose.mjs'],
]

const work = mkdtempSync(join(tmpdir(), 'fds-negative-'))
for (const dir of ['scripts', 'plugin', '.claude-plugin', 'evals']) {
  cpSync(join(ROOT, dir), join(work, dir), { recursive: true })
}
// validate-counts.mjs checks sentences in these, so the copy needs them.
for (const file of ['package.json', 'README.md', 'CLAUDE.md']) {
  cpSync(join(ROOT, file), join(work, file))
}
// The validator imports `yaml`; point the copy at the real install.
cpSync(join(ROOT, 'node_modules'), join(work, 'node_modules'), { recursive: true })

function run (script = 'validate-skills.mjs') {
  const result = spawnSync(process.execPath, [join(work, 'scripts', script)], {
    encoding: 'utf8',
  })
  return `${result.stdout}${result.stderr}`
}

let failures = 0
for (const script of [
  'validate-skills.mjs',
  'validate-examples.mjs',
  'validate-rules.mjs',
  'validate-counts.mjs',
  'validate-prose.mjs',
]) {
  const baseline = run(script)
  if (!baseline.startsWith('ok')) {
    process.stderr.write(`${script} baseline is not clean, so nothing below proves anything:\n${baseline}\n`)
    failures++
  }
}

for (const [label, target, [find, replace, scope], expected, script] of CASES) {
  const files = Array.isArray(target) ? target : [target]
  const paths = files.map((file) => join(work, file))
  const originals = paths.map((path) => readFileSync(path, 'utf8'))
  const missing = files.find((file, i) => !originals[i].includes(find))
  if (missing !== undefined) {
    process.stderr.write(`neg FAIL ${label} -> "${find}" is not in ${missing}\n`)
    failures++
    continue
  }
  paths.forEach((path, i) => {
    writeFileSync(
      path,
      scope === 'all'
        ? originals[i].replaceAll(find, replace)
        : originals[i].replace(find, replace),
    )
  })
  const output = run(script)
  paths.forEach((path, i) => writeFileSync(path, originals[i]))
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
