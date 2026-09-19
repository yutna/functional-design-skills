#!/usr/bin/env node
// Routing keyword coverage for the functional-design skills pack.
//
// Scores each symptom in evals/routing-cases.md against every skill's
// discovery text — the `name` and `description` an agent sees before it opens
// anything — and reports where the expected skill ranked.
//
// Coverage is the gate. It catches false negatives: a skill that should have
// answered a symptom and did not reach the top ranks, which means its
// description is missing words people actually use.
//
// Noise is reported but does NOT gate. It counts how often a skill reaches the
// top ranks for symptoms it does not own. That was built as a false-positive
// gate and then measured: giving a skill a deliberately vague description
// raises its noise by almost nothing and instead makes it fail coverage,
// because inverse document frequency already gives common words almost no
// weight. There is no second hole to plug, so the number ships as a diagnostic
// for whoever adds the next skill, not as a check that can fail.
//
// Both are keyword lints for descriptions, not oracles for routing. A clean
// run does not prove an agent routes correctly. See evals/README.md.
//
// Usage:
//   node scripts/eval-routing.mjs                  summary, plus every miss
//   node scripts/eval-routing.mjs --report         full ranking for every case
//   node scripts/eval-routing.mjs --noise          per-skill noise, worst first
//   node scripts/eval-routing.mjs --profile full   also score "When to use"

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILLS = join(ROOT, 'plugin', 'skills')
const CASES = join(ROOT, 'evals', 'routing-cases.md')
const TOP_N = 3

const STOP = new Set(
  `a an the or of to in for is are be been being that this it its and with on
   at by from as into not no nor but if then than so such use used using when
   where while what which who whom how why can could should would may might will
   shall do does did done have has had i we you they them their our your my me
   all any each every some most more less other another same only just also very
   there here about after before between during over under again once`
    .split(/\s+/)
    .filter(Boolean),
)

// Strip the few suffixes that would otherwise split one concept in two:
// skill/skills, document/documentation, mutate/mutating/mutated.
const SUFFIXES = ['ations', 'ation', 'ingly', 'ing', 'ies', 'ers', 'er', 'ed', 'es', 's']

function stem (word) {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      const base = word.slice(0, -suffix.length)
      return suffix === 'ies' ? base + 'y' : base
    }
  }
  return word
}

function terms (text) {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
}

function counter (words) {
  const counts = new Map()
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)
  return counts
}

function loadSkills (profile) {
  const skills = new Map()
  for (const name of readdirSync(SKILLS).sort()) {
    const path = join(SKILLS, name, 'SKILL.md')
    let text
    try {
      if (!statSync(path).isFile()) continue
      text = readFileSync(path, 'utf8')
    } catch { continue }
    const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
    if (!front) continue
    const desc = /^description:\s*(.+)$/m.exec(front[1])?.[1]?.trim() ?? ''
    // What an agent sees before opening the file. The name counts twice
    // because it is the strongest signal the listing carries.
    const words = [...terms(name.replaceAll('-', ' ')), ...terms(name.replaceAll('-', ' ')), ...terms(desc)]
    if (profile === 'full') {
      const section = /## When to use\r?\n([\s\S]*?)\r?\n## /.exec(text)
      if (section) words.push(...terms(section[1]))
    }
    skills.set(name, counter(words))
  }
  return skills
}

function loadCases () {
  const block = /```text\r?\n([\s\S]*?)```/.exec(readFileSync(CASES, 'utf8'))
  if (!block) {
    process.stderr.write('no ```text case block found in evals/routing-cases.md\n')
    process.exit(1)
  }
  const cases = []
  for (const raw of block[1].split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const at = line.lastIndexOf(' -> ')
    if (at === -1) {
      process.stderr.write(`case line missing ' -> ': ${line}\n`)
      process.exit(1)
    }
    cases.push([line.slice(0, at).trim(), line.slice(at + 4).trim()])
  }
  return cases
}

function rank (skills, idf, symptom) {
  const wanted = terms(symptom)
  const scored = []
  for (const [name, counts] of skills) {
    let total = 0
    for (const term of wanted) {
      const n = counts.get(term)
      if (n !== undefined) total += (1 + Math.log(n)) * (idf.get(term) ?? 0)
    }
    scored.push([total, name])
  }
  scored.sort((a, b) => (b[0] - a[0]) || a[1].localeCompare(b[1]))
  return scored
}

const argv = process.argv.slice(2)
const report = argv.includes('--report')
const showNoise = argv.includes('--noise')
const profile = argv.includes('--profile') && argv.includes('full') ? 'full' : 'desc'

const skills = loadSkills(profile)
const cases = loadCases()

const docFreq = new Map()
for (const counts of skills.values()) {
  for (const term of counts.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
}
const idf = new Map(
  [...docFreq].map(([term, df]) => [term, Math.log(skills.size / df)]),
)

const unknown = [...new Set(cases.map(([, e]) => e).filter((e) => !skills.has(e)))]
if (unknown.length > 0) {
  process.stderr.write(`unknown skill named in cases: ${unknown.sort().join(', ')}\n`)
  process.exit(1)
}

let top1 = 0
const misses = []
const noise = new Map()
const owned = new Map()
const zeroScoring = []

for (const [symptom, expected] of cases) {
  const scored = rank(skills, idf, symptom)
  const names = scored.map(([, name]) => name)
  const pos = names.indexOf(expected) + 1
  if (pos === 1) top1++
  if (pos > TOP_N) misses.push([symptom, expected, pos, names.slice(0, TOP_N)])
  owned.set(expected, (owned.get(expected) ?? 0) + 1)
  zeroScoring.push(scored.filter(([score]) => score === 0).length)
  // A skill that shares no term with the symptom scores zero. Most skills do,
  // for most symptoms, and rank breaks those ties by name — so counting them
  // would rank noise alphabetically rather than by description quality. Only a
  // skill that actually matched some of the symptom's words can mislead.
  for (const [score, name] of scored.slice(0, TOP_N)) {
    if (name !== expected && score > 0) noise.set(name, (noise.get(name) ?? 0) + 1)
  }
  if (report) {
    const mark = pos === 1 ? 'ok  ' : `#${String(pos).padEnd(3)}`
    process.stdout.write(`${mark} ${expected.padEnd(38)} ${symptom.slice(0, 52)}\n`)
  }
}

const total = cases.length
const passed = total - misses.length
process.stdout.write(
  `\nrouting: ${passed}/${total} cases place the expected skill in the top ` +
    `${TOP_N}  (top-1: ${top1}/${total})\n`,
)

const byNoise = [...noise].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
if (byNoise.length > 0) {
  const [loudest, count] = byNoise[0]
  process.stdout.write(
    `noise:   ${loudest} is in the top ${TOP_N} for ${count} cases it does ` +
      'not own  (diagnostic, not a gate)\n',
  )
}
const medianZero = zeroScoring.sort((a, b) => a - b)[Math.floor(zeroScoring.length / 2)]
process.stdout.write(
  `ties:    a median of ${medianZero} of ${skills.size} skills score zero per ` +
    'case, so places below the first are often alphabetical\n',
)

if (showNoise) {
  process.stdout.write(`\n${'skill'.padEnd(38)} ${'noise'.padStart(5)} ${'owns'.padStart(5)}\n`)
  for (const [name, count] of byNoise) {
    process.stdout.write(
      `${name.padEnd(38)} ${String(count).padStart(5)} ` +
        `${String(owned.get(name) ?? 0).padStart(5)}\n`,
    )
  }
}

if (misses.length > 0) {
  process.stderr.write('\nDescriptions missing the words these symptoms use:\n')
  for (const [symptom, expected, pos, beatenBy] of misses) {
    process.stderr.write(`  ${expected} ranked #${pos}\n`)
    process.stderr.write(`    symptom: ${symptom}\n`)
    process.stderr.write(`    outranked by: ${beatenBy.join(', ')}\n`)
  }
  process.exit(1)
}
