#!/usr/bin/env node
// Runs evals/scenarios.md against real Claude Code sessions and reports
// which skill each one actually loaded.
//
// This is the only check here that exercises the pack the way a user meets
// it. Everything else reads files: eval-routing.mjs scores descriptions as a
// bag of words and says so, and the validators check shape. None of them can
// tell whether an agent picks the right skill, which is the thing the pack
// exists to do.
//
// It is deliberately not part of `npm test`:
//
// - it costs money, roughly ten cents a scenario;
// - it needs the `claude` CLI and a signed-in account;
// - the result moves with the model, so it is a measurement, not a gate.
//
// Two details make the number mean anything.
//
// `--setting-sources ''` drops the operator's own plugins and loads this one
// from disk, so the session contains this pack's skills and nothing else.
// Without it a skill from an unrelated plugin answers first and the run
// measures the machine it was run on. That happened: superpowers:brainstorming
// took a scenario before this pack saw it.
//
// Each session runs inside a copy of evals/fixture. Several scenarios open
// with "review this" or "I have three nested loops": they were written to be
// pasted into a session that has the code open. Run against an empty
// directory the agent correctly asks for the file rather than answering, and
// three scenarios scored as routing failures that were nothing of the kind.
//
// Usage:
//   node scripts/eval-scenarios.mjs                 all of them
//   node scripts/eval-scenarios.mjs --only 1,4,30   just these
//   node scripts/eval-scenarios.mjs --model opus    another model
//   node scripts/eval-scenarios.mjs --jobs 2        fewer at once

import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { scenarios } from './lib/pack.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const FIXTURE = join(ROOT, 'evals', 'fixture')
const PLUGIN = join(ROOT, 'plugin')

const flag = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}
const only = flag('only') ? new Set(flag('only').split(',')) : null
const model = flag('model', 'sonnet')
const jobs = Math.max(1, Number(flag('jobs', '4')))

function runOne (scenario, work) {
  return new Promise((resolve) => {
    const dir = join(work, `s${scenario.id}`)
    mkdirSync(dir, { recursive: true })
    cpSync(FIXTURE, dir, { recursive: true })
    const child = spawn('claude', [
      '-p', scenario.prompt,
      '--model', model,
      '--setting-sources', '',
      '--plugin-dir', PLUGIN,
      '--output-format', 'stream-json',
      '--verbose',
    ], { cwd: dir })
    let out = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', () => {})
    child.on('error', () => resolve({ ...scenario, skills: [], cost: 0, failed: true }))
    child.on('close', () => {
      const skills = []
      let cost = 0
      for (const line of out.split('\n')) {
        if (!line.trim()) continue
        let event
        try { event = JSON.parse(line) } catch { continue }
        if (event.type === 'assistant') {
          for (const part of event.message?.content ?? []) {
            if (part.type === 'tool_use' && part.name === 'Skill') {
              skills.push(String(part.input.skill).replace(/^[\w-]+:/, ''))
            }
          }
        }
        if (event.type === 'result') cost = event.total_cost_usd ?? 0
      }
      writeFileSync(join(dir, 'transcript.jsonl'), out)
      resolve({ ...scenario, skills, cost, failed: false })
    })
  })
}

// ok   the expected skill was the first one loaded
// late it was loaded, but something else went first
// MISS it was never loaded
// none no skill was loaded at all, which is the harness's problem more
//      often than the pack's
// n/a  the scenario names no skill; scenario 37 is a behaviour test
function verdict (result) {
  if (result.skills.length === 0) return 'none'
  if (result.expected.length === 0) return 'n/a '
  if (result.expected.includes(result.skills[0])) return 'ok  '
  return result.skills.some((s) => result.expected.includes(s)) ? 'late' : 'MISS'
}

const chosen = scenarios().filter((s) => !only || only.has(s.id))
if (chosen.length === 0) {
  process.stderr.write('no scenarios matched --only\n')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'fds-scenarios-'))
const results = []
const queue = [...chosen]
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length > 0) {
    const result = await runOne(queue.shift(), work)
    results.push(result)
    const first = result.skills[0] ?? '(no skill loaded)'
    const more = result.skills.length > 1 ? ` (+${result.skills.length - 1})` : ''
    process.stdout.write(
      `${verdict(result)} #${result.id.padStart(2)} ${first}${more}\n`,
    )
  }
}))

results.sort((a, b) => Number(a.id) - Number(b.id))
const report = join(work, 'results.json')
writeFileSync(report, JSON.stringify(results, null, 2))

const scored = results.filter((r) => r.expected.length > 0)
const firstRight = scored.filter((r) => r.expected.includes(r.skills[0])).length
const loaded = scored.filter((r) => r.skills.some((s) => r.expected.includes(s))).length
const silent = results.filter((r) => r.skills.length === 0).length
const spend = results.reduce((sum, r) => sum + r.cost, 0)

process.stdout.write(
  `\nexpected skill first: ${firstRight}/${scored.length}` +
    `   loaded at all: ${loaded}/${scored.length}` +
    `   no skill loaded: ${silent}/${results.length}\n`,
)
process.stdout.write(
  `model ${model}, $${spend.toFixed(2)}\n` +
    `report ${report}, and each session's transcript beside it\n`,
)
process.stdout.write(
  'This is a spot check. A mis-route here is a question to look into, not a\n' +
    'defect: half of them are a neighbouring skill giving a defensible answer.\n',
)
// The run directory stays. Each session leaves its transcript beside the
// fixture it ran against, and a mis-route is only worth anything if you can
// read what the agent actually said -- the first version of this script
// printed the path to the report and then deleted it.
if (results.some((r) => r.failed)) {
  process.stderr.write('\nsome sessions could not start; is the claude CLI on PATH?\n')
  process.exit(1)
}
