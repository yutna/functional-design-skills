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

import {
  cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync,
  unlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

// Two cases below break a count, and a count changes whenever a scenario is
// added. Pinning the number here meant editing this file every time, which
// is how a test ends up commented out, so the current wording is read rather
// than written down.
const EVALS_README = readFileSync(join(ROOT, 'evals', 'README.md'), 'utf8')
const SCENARIO_CLAIM = /holds ([a-z-]+) fuller problems/.exec(EVALS_README)
if (SCENARIO_CLAIM === null) {
  process.stderr.write(
    'evals/README.md no longer claims a scenario count, so two cases below ' +
      'cannot break one. Update them.\n',
  )
  process.exit(1)
}
const SCENARIO_SENTENCE = SCENARIO_CLAIM[0]
const SCENARIO_COUNT =
  (readFileSync(join(ROOT, 'evals', 'scenarios.md'), 'utf8')
    .match(/^## \d+\. /gm) ?? []).length
const SKILL = join('plugin', 'skills', 'functional-folding-over-data', 'SKILL.md')

// Two cases below need a description to copy or to replace. Reading them
// rather than writing them down keeps the cases working after an edit, for
// the reason SCENARIO_CLAIM above gives.
const descriptionOf = (id) =>
  /^description: .*$/m.exec(
    readFileSync(join(ROOT, 'plugin', 'skills', id, 'SKILL.md'), 'utf8'),
  )[0]
const OWN_DESCRIPTION = descriptionOf('functional-folding-over-data')
const ANOTHER_DESCRIPTION = descriptionOf('functional-composing-functions')

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
  ['a lock file whose version disagrees with what it resolves to',
    'package-lock.json',
    ['"version": "2.9.1"', '"version": "3.0.0"'],
    'but resolves to'],
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
    [SCENARIO_SENTENCE, 'holds nine fuller problems'],
    `but there are ${SCENARIO_COUNT}`, 'validate-counts.mjs'],
  ['a claim whose sentence was rewritten, so nothing checks it',
    join('evals', 'README.md'),
    [SCENARIO_SENTENCE, 'holds a good number of problems'],
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
  ['a skill whose body never opens a level-one heading', SKILL,
    ['\n# Folding Over Data\n', '\n## Folding Over Data\n'],
    'must open with a single level-one heading'],
  ['a SKILL.md with the frontmatter block removed', SKILL,
    ['---\nname: functional-folding-over-data', 'name: functional-folding-over-data'],
    'has no YAML frontmatter block'],
  ['a cross-skill link pointing at a name that does not exist', SKILL,
    ['../functional-managing-state-immutably/SKILL.md',
      '../functional-managing-state-immutable/SKILL.md', 'all'],
    'broken link ->'],
  ['two skills sharing one description, so routing cannot separate them', SKILL,
    [OWN_DESCRIPTION, ANOTHER_DESCRIPTION],
    'description is identical to'],
  ['a description that no longer contains the words its own symptoms use', SKILL,
    [OWN_DESCRIPTION,
      'description: Use when a clinic needs an audit trail before it closes.'],
    'Descriptions missing the words these symptoms use', 'eval-routing.mjs'],
  ['a broken relative link in a file outside plugin/skills', 'README.md',
    ['(CONTRIBUTING.md)', '(CONTRIBUTIONS.md)', 'all'],
    'broken link ->'],
  ['a routing case expecting a skill that does not exist',
    join('evals', 'routing-cases.md'),
    ['-> functional-folding-over-data', '-> functional-folding-over-datum'],
    'unknown skill named in cases', 'eval-routing.mjs'],
]

// A defect that is the presence of a file cannot be written as an edit to
// one. plugin/package.json is the case this repository cares about: a lock
// file at the plugin root runs npm on the machine of everyone who installs.
const CREATED = [
  ['a package file at the plugin root',
    join('plugin', 'package.json'), '{}\n',
    'must not exist', 'validate-skills.mjs'],
  ['a lock file at the plugin root',
    join('plugin', 'package-lock.json'), '{}\n',
    'must not exist', 'validate-skills.mjs'],
]

const work = mkdtempSync(join(tmpdir(), 'fds-negative-'))
for (const dir of ['scripts', 'plugin', '.claude-plugin', 'evals']) {
  cpSync(join(ROOT, dir), join(work, dir), { recursive: true })
}
// validate-counts.mjs checks sentences in some of these; the rest are here
// because validate-skills.mjs follows every relative link in the repository
// now, and a copy missing the file a link points at fails for the wrong
// reason. The baseline check above caught exactly that when the walk widened.
const TOP_LEVEL = [
  'package.json', 'package-lock.json', 'README.md', 'CLAUDE.md',
  'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'SECURITY.md',
  'CODE_OF_CONDUCT.md',
]
for (const file of TOP_LEVEL) {
  cpSync(join(ROOT, file), join(work, file))
}
// The validators import `yaml` and `typescript`, so a copy needs to resolve
// them. Link rather than copy: node_modules holds symlinks of its own, and
// copying those needs a privilege Windows does not grant by default. A
// junction is the one link type Windows makes without it.
function linkModules (into) {
  const target = join(ROOT, 'node_modules')
  try {
    symlinkSync(target, join(into, 'node_modules'), 'junction')
  } catch {
    cpSync(target, join(into, 'node_modules'), { recursive: true, dereference: true })
  }
}
linkModules(work)

function run (script = 'validate-skills.mjs') {
  const result = spawnSync(process.execPath, [join(work, 'scripts', script)], {
    encoding: 'utf8',
  })
  return { text: `${result.stdout}${result.stderr}`, status: result.status }
}

let failures = 0
for (const script of [
  'validate-skills.mjs',
  'validate-examples.mjs',
  'validate-rules.mjs',
  'validate-counts.mjs',
  'validate-prose.mjs',
  'eval-routing.mjs',
]) {
  const baseline = run(script)
  if (baseline.status !== 0) {
    process.stderr.write(`${script} baseline is not clean, so nothing below proves anything:\n${baseline.text}\n`)
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
  const output = run(script).text
  paths.forEach((path, i) => writeFileSync(path, originals[i]))
  if (output.includes(expected)) {
    process.stdout.write(`neg ok   ${label}\n`)
  } else {
    process.stderr.write(`neg FAIL ${label} -> expected "${expected}", got:\n${output}\n`)
    failures++
  }
}

for (const [label, file, content, expected, script] of CREATED) {
  const path = join(work, file)
  writeFileSync(path, content)
  const output = run(script).text
  unlinkSync(path)
  if (output.includes(expected)) {
    process.stdout.write(`neg ok   ${label}\n`)
  } else {
    process.stderr.write(`neg FAIL ${label} -> expected "${expected}", got:\n${output}\n`)
    failures++
  }
}

// Two whole-tree checks. Neither is an edit to one file, and both cover a
// way a check can stop working without failing: reading the wrong line
// ending, and finding nothing to read.

const SCRIPTS = [
  'validate-skills.mjs',
  'validate-examples.mjs',
  'validate-rules.mjs',
  'validate-counts.mjs',
  'validate-prose.mjs',
  'eval-routing.mjs',
]

// .gitattributes checks Markdown out with the platform's own line endings,
// so on Windows every file carries \r\n. Three readers were anchored to a
// bare \n. validate-rules.mjs was the worst: it matched no headings, found
// no rules at all, printed "0 core rule(s) labelled across 0 skill(s)" and
// exited zero, so the strictness gate was inert on Windows and green.
function convertToCrlf (dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      convertToCrlf(path)
      continue
    }
    if (!entry.endsWith('.md')) continue
    writeFileSync(path, readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n'))
  }
}

const lfSummary = new Map(SCRIPTS.map((script) => [script, run(script).text.trim()]))
convertToCrlf(work)
for (const script of SCRIPTS) {
  const after = run(script)
  if (after.status !== 0) {
    process.stderr.write(`crlf FAIL ${script} exits ${after.status} on a CRLF checkout:\n${after.text}\n`)
    failures++
  } else if (after.text.trim() !== lfSummary.get(script)) {
    process.stderr.write(
      `crlf FAIL ${script} reports something different on a CRLF checkout.\n` +
        `  lf:   ${lfSummary.get(script).split('\n')[0]}\n` +
        `  crlf: ${after.text.trim().split('\n')[0]}\n`,
    )
    failures++
  } else {
    process.stdout.write(`crlf ok  ${script} reads a CRLF checkout the same way\n`)
  }
}

// And the floor: with nothing to read, every one of these must fail rather
// than report a clean zero.
const empty = mkdtempSync(join(tmpdir(), 'fds-empty-'))
for (const dir of ['scripts', 'plugin', '.claude-plugin', 'evals']) {
  cpSync(join(ROOT, dir), join(empty, dir), { recursive: true })
}
for (const file of TOP_LEVEL) {
  cpSync(join(ROOT, file), join(empty, file))
}
linkModules(empty)
rmSync(join(empty, 'plugin', 'skills'), { recursive: true, force: true })
cpSync(join(ROOT, 'plugin', 'skills'), join(empty, 'plugin', 'skills'), {
  recursive: true,
  filter: (src) => !src.endsWith('.md'),
})
for (const script of SCRIPTS) {
  const result = spawnSync(process.execPath, [join(empty, 'scripts', script)], {
    encoding: 'utf8',
  })
  const text = `${result.stdout}${result.stderr}`
  if (result.status === 0) {
    process.stderr.write(`floor FAIL ${script} passed with nothing to read:\n${text}\n`)
    failures++
  } else {
    process.stdout.write(`floor ok ${script} refuses to pass on an empty pack\n`)
  }
}
rmSync(empty, { recursive: true, force: true })

rmSync(work, { recursive: true, force: true })

if (failures > 0) {
  process.stderr.write(`\n${failures} guard(s) did not fire on their own defect\n`)
  process.exit(1)
}
process.stdout.write(
  `\n${CASES.length + CREATED.length} guard(s) fired on the defect each was ` +
    `written for, ${SCRIPTS.length} read a CRLF checkout unchanged, and ` +
    `${SCRIPTS.length} refused to pass with nothing to read\n`,
)
