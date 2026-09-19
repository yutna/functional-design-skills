#!/usr/bin/env node
// Checks that every core rule declares how strictly it is meant to be taken.
//
// Added in 3.0.0. Before it, every rule in the pack read with the same
// weight, so an agent had no way to tell "breaking this is a defect" from
// "do this unless the following holds". Both shapes were written in the same
// imperative voice:
//
//   Name the accumulator type first.           a technique; code still works
//   Do not export what callers should not use. a promise, once broken
//
// Twenty rules were sampled before this was built. Three carried their
// strictness in the verb already ("never", "prefer"); the rest did not. That
// measurement is why the label is a separate word rather than a rewrite.
//
// The format is a plain-text label before the bold statement, so the
// statement stays the thing the eye lands on:
//
//   1. Rule. **Split by who asks for the change.** Two calculations that ...
//
// This is a format check, not a judgement check. It cannot tell whether a
// rule was labelled correctly, only that exactly one label is present. The
// share of each label is reported as a health signal, not a gate: a pack
// that is nearly all Rule is overclaiming, and one with almost none is not
// saying anything.
//
// Usage:
//   node scripts/validate-rules.mjs
//   node scripts/validate-rules.mjs --report   every rule and its label

import { linesOf } from './lib/markdown.mjs'
import { everySkill } from './lib/pack.mjs'

const LABELS = ['Rule', 'Default', 'Judgement']
// A numbered list item that opens a core rule. The label is captured
// separately from the bold statement so a missing one is distinguishable
// from a misspelled one.
const ITEM = /^(\d+)\. (?:(\w+)\.\s+)?\*\*/
const HEADING = /^## /

const errors = []
const counts = new Map(LABELS.map((label) => [label, 0]))
const rows = []

function coreRules (body) {
  const lines = linesOf(body)
  const start = lines.findIndex((line) => line === '## Core rules')
  if (start === -1) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => HEADING.test(line))
  return end === -1 ? rest : rest.slice(0, end)
}

let withSection = 0
for (const { id, raw } of everySkill()) {
  const lines = coreRules(raw)
  if (lines.length === 0) continue
  withSection++
  for (const line of lines) {
    const match = ITEM.exec(line)
    if (match === null) continue
    const [, number, label] = match
    if (label === undefined) {
      errors.push(`${id}: core rule ${number} has no strictness label`)
      continue
    }
    if (!LABELS.includes(label)) {
      errors.push(
        `${id}: core rule ${number} is labelled "${label}", not one of ` +
          LABELS.join(', '),
      )
      continue
    }
    counts.set(label, counts.get(label) + 1)
    rows.push(`${label.padEnd(9)} ${id} ${number}`)
  }
}

if (process.argv.includes('--report')) {
  for (const row of rows.sort()) process.stdout.write(`${row}\n`)
  process.stdout.write('\n')
}

for (const error of errors) {
  process.stderr.write(`error ${error}\n`)
}
if (errors.length > 0) {
  process.stderr.write(`\n${errors.length} unlabelled or mislabelled rule(s)\n`)
  process.exit(1)
}

const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
// everySkill() refuses to return an empty pack, so this floor is only
// about the section: the skills are there and none of them has core rules,
// which means the heading stopped matching.
if (total === 0 || withSection === 0) {
  process.stderr.write(
    `error found ${total} core rule(s) in ${withSection} skill(s). This ` +
      'check measured nothing, which is a failure, not a pass.\n',
  )
  process.exit(1)
}
const share = LABELS.map(
  (label) =>
    `${label.toLowerCase()} ${counts.get(label)}` +
    ` (${Math.round((counts.get(label) / total) * 100)}%)`,
).join(', ')
process.stdout.write(
  `ok    ${total} core rule(s) labelled across ${withSection} skill(s)\n`,
)
process.stdout.write(`      ${share}\n`)
