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

import {
  INDEX_SKILL as INDEX, languagePackIds, readRepoFile, routingCases, scenarios,
  skillIds,
} from './lib/pack.mjs'

const ids = skillIds()

// The pack list used to be parsed here. validate-skills.mjs came to need the
// same list, so it moved to lib/pack.mjs rather than being copied.
const languagePacks = languagePackIds()
const packSet = new Set([...languagePacks, INDEX])
const coreSkills = ids.filter((id) => !packSet.has(id))

for (const pack of languagePacks) {
  if (!ids.includes(pack)) {
    throw new Error(
      `plugin/skills/${INDEX}/SKILL.md lists "${pack}" as a language pack, ` +
        'but no such skill exists',
    )
  }
}

// Every count here comes from lib/pack.mjs, which is also what the scorer
// and the scenario runner read. Two of these used to be computed here with
// a regex of their own, and the copies did not agree: one tolerated CRLF
// and one did not, so on Windows this script called the documentation
// wrong about a number the scorer was perfectly happy with. Reading
// nothing throws there rather than returning a zero that every caller has
// to remember to check.
const FACTS = {
  skills: ids.length,
  languagePacks: languagePacks.length,
  coreSkills: coreSkills.length,
  scenarios: scenarios().length,
  routingCases: routingCases().length,
  // Three counts of the skills seen from somewhere else. A description is
  // distinct from every skill but itself; a version bump touches every
  // skill plus package.json and both manifests, and bump-version.mjs
  // carries all of that except package.json, which npm version owns.
  otherSkills: ids.length - 1,
  versionedFiles: ids.length + 3,
  filesTheScriptBumps: ids.length + 2,
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
  // The same pack counted from somewhere other than the directory listing.
  // The first of these drifted silently: written at 2.0.0 when there were
  // forty skills, wrong three packs later, and it shipped wrong in both
  // 3.0.0 and 3.0.1. The remaining hand-written number is the "+ 3" above:
  // the list of manifests lives in bump-version.mjs, so a third manifest
  // would make both the prose and the fact wrong together, and pass.
  ['CLAUDE.md', 'otherSkills', /distinct from the other ([a-z-]+) so/],
  ['CLAUDE.md', 'versionedFiles', /The number appears in ([a-z-]+) files/],
  ['CLAUDE.md', 'filesTheScriptBumps',
    /to the other ([a-z-]+), touching one line/],
  ['CLAUDE.md', 'versionedFiles', /then proves all\s+([a-z-]+) agree/],
  ['README.md', 'coreSkills', /^([A-Za-z-]+) core skills carry one rule each/m],
]

const errors = []
for (const [file, fact, pattern] of CLAIMS) {
  const match = pattern.exec(readRepoFile(file))
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
