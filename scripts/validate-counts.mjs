#!/usr/bin/env node
// Checks that every number the documentation claims about this pack is the
// number the pack actually has.
//
// Added in 3.0.0, because a hand-written count is a count that drifts. Three
// had drifted by the time this was written: a changelog entry that said
// twenty-five where the bullets summed to twenty-six, a README skill count
// that no longer matched the directory, and evals/README.md describing
// thirty-five scenarios when scenarios.md held thirty-seven.
//
// Each claim names the file, the sentence that carries the number, and the
// fact the number is supposed to be. The script computes the fact and
// compares, accepting either the numeral or the English word, because the
// prose uses both and which one reads better is a style decision.
//
// A claim whose sentence has been rewritten fails loudly rather than being
// skipped, so this cannot quietly stop checking anything.
//
// CHANGELOG.md is deliberately not covered. Its numbers are a record of what
// was true when a version shipped, and a record that updates itself is not a
// record. Only prose that describes the pack as it is now belongs here.
//
// Usage: node scripts/validate-counts.mjs

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const skillIds = readdirSync(join(ROOT, 'plugin', 'skills'), {
  withFileTypes: true,
}).filter((entry) => entry.isDirectory()).map((entry) => entry.name)

// Since 3.0.0 every skill is named functional-something, so the name no
// longer says whether a skill is a core rule or a language pack. The index
// already lists the packs, and that list is maintained because readers use
// it, so it is the authority here rather than a second list in this script.
const INDEX = 'functional-design'

function declaredLanguagePacks () {
  const body = read(`plugin/skills/${INDEX}/SKILL.md`)
  const section = /^## Language packs\r?\n([\s\S]*?)^## /m.exec(body)
  if (section === null) {
    throw new Error(
      `plugin/skills/${INDEX}/SKILL.md: no "## Language packs" section, so ` +
        'nothing can tell a pack from a core skill',
    )
  }
  return [...section[1].matchAll(/^- \[([a-z0-9-]+)\]/gm)].map((m) => m[1])
}

const languagePacks = declaredLanguagePacks()
const packSet = new Set([...languagePacks, INDEX])
const coreSkills = skillIds.filter((id) => !packSet.has(id))

for (const pack of languagePacks) {
  if (!skillIds.includes(pack)) {
    throw new Error(
      `plugin/skills/${INDEX}/SKILL.md lists "${pack}" as a language pack, ` +
        'but no such skill exists',
    )
  }
}

// Line endings are normalised on the way in. Every pattern below is written
// against \n, and .gitattributes checks Markdown out with the platform's own
// endings, so on Windows a pattern anchored to \n matched nothing: the case
// block was "missing" and two claims read as "rewritten". Normalising here
// fixes all of them at once and cannot mask anything this script is for.
function read (relative) {
  return readFileSync(join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n')
}

// Counted the way eval-routing.mjs counts them: inside the fenced block, so
// the arrow in the prose that explains the format is not a case, and
// skipping comments, so the two scripts cannot disagree about the total.
//
// Both regexes tolerate CRLF. .gitattributes checks Markdown out with the
// platform's endings, so on Windows every line here ends \r\n; a pattern
// anchored to a bare \n found no block, returned zero, and reported that
// the documentation over-counted. Nothing caught it because the Windows job
// did not run this suite. It does now.
function routingCases () {
  const block = /```text\r?\n([\s\S]*?)```/.exec(read('evals/routing-cases.md'))
  if (block === null) {
    throw new Error(
      'evals/routing-cases.md: no fenced case block, so the case count ' +
        'cannot be computed. A zero here would read as a documentation error.',
    )
  }
  return block[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes(' -> '))
    .length
}

const FACTS = {
  skills: skillIds.length,
  languagePacks: languagePacks.length,
  coreSkills: coreSkills.length,
  scenarios: (read('evals/scenarios.md').match(/^## \d+\. /gm) ?? []).length,
  routingCases: routingCases(),
}

// Every fact here is a count of something this pack has always had. A zero
// means the reader broke, not that the pack emptied, and reporting "ok" on
// a zero is how a check stops working without anyone noticing.
for (const [name, value] of Object.entries(FACTS)) {
  if (value === 0) {
    process.stderr.write(
      `error counted zero ${name}, so this check measured nothing\n`,
    )
    process.exit(1)
  }
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety',
]

function inWords (n) {
  if (n < 20) return ONES[n]
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)]
    return n % 10 === 0 ? tens : `${tens}-${ONES[n % 10]}`
  }
  return String(n)
}

// Each claim: the file, the fact, and a pattern whose one capture group is
// the number as the prose writes it.
const CLAIMS = [
  ['README.md', 'coreSkills', /An index and ([a-z-]+) core skills/],
  ['README.md', 'languagePacks', /([a-z-]+) language packs translate/],
  ['README.md', 'skills', /the (\d+) skills score exactly zero/],
  ['CLAUDE.md', 'skills', /There are ([a-z-]+) skills, and every one/],
  ['CLAUDE.md', 'languagePacks', /([A-Za-z-]+) are\s+language packs, named for the stack/],
  ['CLAUDE.md', 'coreSkills', /the remaining ([a-z-]+) carry\s+one design/],
  ['evals/README.md', 'skills', /the (\d+) skills score exactly zero/],
  ['evals/README.md', 'scenarios', /holds ([a-z-]+) fuller problems/],
  // A record of a measurement, not a description of the suite. It stays
  // checked because the measurement is only meaningful against the suite it
  // was taken on: if the case count moves, the claim has to be re-measured,
  // not re-typed.
  ['evals/README.md', 'routingCases', /zero of the (\d+)\n  cases place/],
  ['evals/scenarios.md', 'scenarios', /^([A-Za-z-]+) problems in the form/m],
  // The record of an agent run, tied to the suite it was taken on for the
  // same reason as the one above: add a scenario and the run has to happen
  // again, not have its number retyped.
  ['evals/README.md', 'scenarios', /The ([a-z-]+) scenarios were run this way/],
]

const errors = []
for (const [file, fact, pattern] of CLAIMS) {
  const match = pattern.exec(read(file))
  if (match === null) {
    errors.push(
      `${file}: the sentence claiming "${fact}" was rewritten, so nothing ` +
        `checks that number any more. Update the pattern in this script.`,
    )
    continue
  }
  const written = match[1].toLowerCase()
  const expected = FACTS[fact]
  if (written !== String(expected) && written !== inWords(expected)) {
    errors.push(
      `${file}: says "${match[1]}" ${fact}, but there are ${expected} ` +
        `(write "${inWords(expected)}" or "${expected}")`,
    )
  }
}

for (const error of errors) {
  process.stderr.write(`error ${error}\n`)
}
if (errors.length > 0) {
  process.stderr.write(`\n${errors.length} count(s) do not match reality\n`)
  process.exit(1)
}
const summary = Object.entries(FACTS)
  .map(([name, n]) => `${name} ${n}`)
  .join(', ')
process.stdout.write(`ok    ${CLAIMS.length} documented count(s) match\n`)
process.stdout.write(`      ${summary}\n`)
