#!/usr/bin/env node
// Grades the answers to evals/scenarios.md, with the pack loaded and with no
// plugin at all, and reports the difference.
//
// eval-scenarios.mjs records which skill a session loaded first. It never
// reads the answer, so it cannot say whether the pack made the answer better
// than no pack at all. This hands the scenarios to `claude plugin eval`,
// which runs a prompt with the plugin loaded and again with none, grades both
// with graders defined here, and reports the two side by side.
//
// Each scenario becomes one case. The block quote is the prompt; the prose
// under it, less the "Should reach" sentence, is the rubric a judge model
// grades the final answer against; the skill it should reach becomes an
// indicator beside the grade. The cases are written into a throwaway copy of
// plugin/ and never committed, so scenarios.md stays the only place a
// scenario is written down and nothing is added to what the plugin ships.
//
// It is deliberately not part of `npm test`:
//
// - it costs money, roughly six cents an agent run with the judge included;
// - it needs the `claude` CLI and a signed-in account;
// - the result moves with the model and the judge, so it is a measurement,
//   not a gate.
//
// Two details make the number mean anything. The summary is computed from
// each grader's own verdict, by name, and never from the tool's `score`:
// in a two-arm run the skill graders are indicators and unscored, in a
// one-arm run they count, so the score means a different thing in each.
//
// And a run is scored only on what it measured. A run that ended in an
// error, and a judge that threw, are recorded by the tool as failures and
// reported here apart, against neither arm; when the arm with the plugin
// has no judged verdict at all the run measured nothing, and fails. The
// first paid run hit the account's session limit and the tool exited 0
// with every answer marked wrong.
//
// A variant degrades the copied plugin before the cases are written, to
// measure how the pack behaves when the skill listing is poorer. A system
// file adds its text to the system prompt of every case.
//
// Usage:
//   node scripts/eval-plugin.mjs --dry-run            build the cases, call nothing
//   node scripts/eval-plugin.mjs --tag smoke          a few scenarios, both arms
//   node scripts/eval-plugin.mjs                      every scenario, both arms
//   node scripts/eval-plugin.mjs --only 1,34 --runs 1 two scenarios, once each
//   node scripts/eval-plugin.mjs --ablation none      with the pack only
//   node scripts/eval-plugin.mjs --variant index-only the core skills hidden
//   node scripts/eval-plugin.mjs --selftest           prove the logic, call nothing
//                                                     (npm run test:guards runs it)
//
// Flags, each with a value unless noted:
//   --only 1,4,30      scenario numbers to generate (default: all)
//   --tag NAME         run only the cases carrying this tag
//   --runs N           runs per case and arm (default: the tool's, which is 3)
//   --ablation MODE    none | with-without (default: the tool's)
//   --model ID         the agent under test
//   --judge-model ID   the judge
//   --max-cost-usd N   ceiling for the whole run, always passed (default 30)
//   --jobs N           agent runs in flight at once (default 4)
//   --variant NAME     no-leaf-descriptions | index-only
//   --system-file PATH text appended to the system prompt of every case
//   --dry-run          generate the cases, print where, spawn nothing
//   --keep             keep the generated directory and the tool's workspaces
//   --selftest         no value; run in memory and exit

import {
  chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync,
  writeFileSync,
} from 'node:fs'
import { constants, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { parse as parseYaml, stringify } from 'yaml'
import { readMarkdown, slugOf } from './lib/markdown.mjs'
import {
  EVALS_DIR, INDEX_SKILL, ROOT, languagePackIds, parseScenarios, readSkill,
  scenarios, skillIds,
} from './lib/pack.mjs'

const PLUGIN = join(ROOT, 'plugin')
const FIXTURE = join(EVALS_DIR, 'fixture')
const RESULTS = join(EVALS_DIR, 'results')

// Both models are pinned by id, never by alias. An alias moves when a model
// rolls out, and a rollout must not be mistaken for a change in the pack.
const AGENT_MODEL = 'claude-sonnet-5-5'
// A pilot showed the smaller judge failing a correct answer three votes to
// none; the larger one graded the same answer correctly.
const JUDGE_MODEL = 'claude-sonnet-5-5'

// The scenarios that also carry the `smoke` tag.
const SMOKE = new Set([
  '1', '4', '5', '20', '24', '30', '31', '34', '35', '36', '37', '42',
])

const DEFAULT_MAX_COST_USD = 30
const DEFAULT_JOBS = 4

const FIXTURE_SCRIPT = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
  'cp -R "$here/fixture/." .',
  '',
].join('\n')

// What `claude plugin eval` exits with. Exit 1 stands for two things; with
// --threshold 0 it can only be a load error.
const EXIT_MEANING = {
  1: 'a case file failed to load',
  2: 'the run is partial: the cost ceiling was hit, or the credentials failed',
  130: 'it was interrupted',
  143: 'it was terminated',
}

const SUBSTANCE = 'substance'
const REACHED = 'reached-expected-skill'
const LOADED = 'loaded-any-skill'

// ---------------------------------------------------------------- the cases

const skillPattern = (ids) =>
  String.raw`"skill"\s*:\s*"(?:[\w-]+:)?(?:${ids.join('|')})"`

const rubricFor = (criteria) => [
  'You are grading one response to a software design question. The criteria',
  'below were written for a human grader. Judge substance, not wording: an',
  'answer that reaches the same place by another route passes.',
  '',
  criteria,
  '',
  'PASS only if every "Must contain" element is present in substance and no',
  '"Must not contain" or "Fails if" condition is met. Otherwise FAIL.',
].join('\n')

const caseName = (scenario) =>
  `q${scenario.id.padStart(2, '0')}-${slugOf(scenario.title)}`

function caseOf (scenario, systemPrompt) {
  const graders = []
  if (scenario.expected.length > 0) {
    graders.push({
      name: REACHED,
      type: 'tool_used',
      tool: 'Skill',
      input_match: skillPattern(scenario.expected),
    })
  }
  graders.push({ name: LOADED, type: 'tool_used', tool: 'Skill' })
  graders.push({
    name: SUBSTANCE,
    type: 'llm',
    criteria: rubricFor(scenario.criteria),
  })
  return {
    schema_version: '1.1',
    name: caseName(scenario),
    tags: SMOKE.has(scenario.id) ? ['question', 'smoke'] : ['question'],
    context: { scaffold_script: 'fixture.sh' },
    execution: {
      prompt: scenario.prompt,
      allowed_tools: ['Read', 'Glob', 'Grep', 'Skill'],
      max_turns: 15,
      timeout_seconds: 300,
      ...(systemPrompt === null ? {} : { append_system_prompt: systemPrompt }),
    },
    graders,
  }
}

function buildCases (list, { tag, systemPrompt }) {
  if (list.length === 0) {
    throw new Error('no scenario to build a case from, so nothing would be measured')
  }
  const cases = list.map((scenario) => caseOf(scenario, systemPrompt))
  if (tag !== null && !cases.some((item) => item.tags.includes(tag))) {
    throw new Error(`no case carries the tag "${tag}", so nothing would be measured`)
  }
  return cases
}

function chooseScenarios (list, only) {
  if (only === null) return list
  const known = new Set(list.map((scenario) => scenario.id))
  const missing = [...only].filter((id) => !known.has(id))
  if (missing.length > 0) {
    throw new Error(`--only names no scenario numbered ${missing.join(', ')}`)
  }
  return list.filter((scenario) => only.has(scenario.id))
}

// -------------------------------------------------------------- the variants

// Each edits a skill's frontmatter block, the `---` lines included.
// The description line goes with any continuation lines it has.
const VARIANTS = {
  'no-leaf-descriptions': (head) =>
    head.replace(/^description:.*\n(?:[ \t]+.*\n)*/m, ''),
  'index-only': (head) =>
    head.replace(/\n---\n$/, '\ndisable-model-invocation: true\n---\n'),
}

function variantFor (name) {
  if (!Object.hasOwn(VARIANTS, name)) {
    throw new Error(
      `unknown variant "${name}"; the variants are ${Object.keys(VARIANTS).join(', ')}`,
    )
  }
  return VARIANTS[name]
}

// Every skill that is neither the index nor a language pack.
function coreSkillIds () {
  const others = new Set([INDEX_SKILL, ...languagePackIds()])
  const core = skillIds().filter((id) => !others.has(id))
  if (core.length === 0) {
    throw new Error('the pack has no core skill, so a variant would change nothing')
  }
  return core
}

// The text of one SKILL.md under a variant. A variant that changed nothing
// has measured nothing, and a skill whose frontmatter no longer parses is
// not loaded, so the arm that should have it would silently run without it.
function degrade (name, skill) {
  const head = skill.raw.slice(0, skill.raw.length - skill.body.length)
  const edited = variantFor(name)(head)
  if (edited === head) throw new Error(`${skill.id}: ${name} changed nothing`)
  parseYaml(edited.replace(/^---\n/, '').replace(/\n---\n$/, ''))
  return edited + skill.body
}

function applyVariant (name, root) {
  for (const id of coreSkillIds()) {
    writeFileSync(join(root, 'skills', id, 'SKILL.md'), degrade(name, readSkill(id)))
  }
}

// ---------------------------------------------------------------- the flags

const VALUE_FLAGS = new Set([
  '--only', '--tag', '--runs', '--ablation', '--model', '--judge-model',
  '--max-cost-usd', '--jobs', '--variant', '--system-file',
])
const SWITCHES = new Set(['--dry-run', '--keep', '--selftest'])

// A flag that is misspelt would otherwise be ignored, and a run that ignored
// `--runs` or `--max-cost-usd` is a run that spent more than was meant.
function parseArgs (argv) {
  const stray = argv.find((arg, at) =>
    !VALUE_FLAGS.has(arg) && !SWITCHES.has(arg) && !VALUE_FLAGS.has(argv[at - 1]))
  if (stray !== undefined) throw new Error(`unknown argument ${stray}`)

  const flag = (name, fallback = null) => {
    const at = argv.indexOf(`--${name}`)
    if (at === -1) return fallback
    const value = argv[at + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`--${name} needs a value`)
    }
    return value
  }
  const whole = (name, fallback) => {
    const raw = flag(name)
    if (raw === null) return fallback
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`--${name} must be a whole number, 1 or more, not "${raw}"`)
    }
    return n
  }

  const ablation = flag('ablation')
  if (ablation !== null && ablation !== 'none' && ablation !== 'with-without') {
    throw new Error(`--ablation must be none or with-without, not "${ablation}"`)
  }
  const variant = flag('variant')
  if (variant !== null) variantFor(variant)
  const cost = flag('max-cost-usd')
  const maxCostUsd = cost === null ? DEFAULT_MAX_COST_USD : Number(cost)
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    throw new Error(`--max-cost-usd must be a number above 0, not "${cost}"`)
  }
  const only = flag('only')
  return {
    only: only === null
      ? null
      : new Set(only.split(',').map((id) => id.trim()).filter(Boolean)),
    tag: flag('tag'),
    runs: whole('runs', null),
    ablation,
    model: flag('model', AGENT_MODEL),
    judgeModel: flag('judge-model', JUDGE_MODEL),
    maxCostUsd,
    jobs: whole('jobs', DEFAULT_JOBS),
    variant,
    systemFile: flag('system-file'),
    dryRun: argv.includes('--dry-run'),
    keep: argv.includes('--keep'),
  }
}

function childArgs (options, { root, resultFile, outDir }) {
  const args = [
    'plugin', 'eval', root,
    '--trust-plugin', '--no-publish', '--scaffold',
    '--threshold', '0',
    '--json', resultFile,
    '--output-dir', outDir,
    '--model', options.model,
    '--judge-model', options.judgeModel,
    '--max-cost-usd', String(options.maxCostUsd),
    '--concurrency', String(options.jobs),
  ]
  if (options.runs !== null) args.push('--runs', String(options.runs))
  if (options.ablation !== null) args.push('--ablation', options.ablation)
  if (options.keep) args.push('--keep-temp')
  // Last, because the tool takes several values for it and would read
  // anything after it as another tag.
  if (options.tag !== null) args.push('--tag', options.tag)
  return args
}

// ------------------------------------------------------------ the directory

function writeRoot (root, cases, variant) {
  cpSync(PLUGIN, root, { recursive: true })
  if (variant !== null) applyVariant(variant, root)
  for (const item of cases) {
    const dir = join(root, 'evals', item.name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'case.yaml'), stringify(item, { lineWidth: 0 }))
    writeFileSync(join(dir, 'fixture.sh'), FIXTURE_SCRIPT)
    chmodSync(join(dir, 'fixture.sh'), 0o755)
    cpSync(FIXTURE, join(dir, 'fixture'), { recursive: true })
  }
}

// -------------------------------------------------------------- the summary

const tally = (flags) => {
  const passed = flags.filter(Boolean).length
  return {
    passed,
    total: flags.length,
    rate: flags.length === 0 ? null : passed / flags.length,
  }
}

// A judge that gave a verdict leaves its votes behind. One that threw, or was
// skipped at the cost ceiling, is recorded as a failed grader with no votes,
// and counting that as a failed answer would score a harness fault against
// the arm it landed in. The first paid run showed it: every judge call hit
// the account's session limit and the substance rate read 0%.
const judged = (grader) =>
  Array.isArray(grader.judgeVotes) && grader.judgeVotes.length > 0

const substanceOf = (run) =>
  run.graders.find((candidate) => candidate.name === SUBSTANCE)

// One verdict per run that gives one. A run that ended in an error is not a
// sample of the agent's answer either, so it gives none. summarise() counts
// both apart, where they can be read.
function verdicts (runs, name) {
  return runs.flatMap((run) => {
    if (run.error) return []
    const grader = run.graders.find((candidate) => candidate.name === name)
    if (grader === undefined) return []
    if (name === SUBSTANCE && !judged(grader)) return []
    return [grader.passed === true]
  })
}

const firstLine = (text) => String(text).split('\n')[0].trim().slice(0, 200)

// The distinct messages behind the runs that gave no verdict, commonest first.
function reasons (messages) {
  const counts = new Map()
  for (const message of messages) {
    counts.set(message, (counts.get(message) ?? 0) + 1)
  }
  return [...counts]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
}

function summarise (document) {
  if (document.schemaVersion !== 1) {
    throw new Error(
      `the result document is schemaVersion ${document.schemaVersion}; ` +
        'this runner reads 1',
    )
  }
  const cases = document.cases
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('the result document holds no cases, so nothing was measured')
  }
  const withRuns = (item) => item.arms.with
  const withoutRuns = (item) => item.arms.without ?? []
  const pooled = (pick, name) =>
    tally(cases.flatMap((item) => verdicts(pick(item), name)))
  const failed = (pick) => cases.flatMap(pick).filter((run) => run.error)
  const unjudged = (pick) => cases.flatMap(pick).filter((run) => {
    const grader = substanceOf(run)
    return !run.error && (grader === undefined || !judged(grader))
  })

  const withSubstance = pooled(withRuns, SUBSTANCE)
  const withoutSubstance = pooled(withoutRuns, SUBSTANCE)
  const worseWithPlugin = []
  const expectedSkillNeverReached = []
  for (const item of cases) {
    const w = tally(verdicts(withRuns(item), SUBSTANCE))
    const o = tally(verdicts(withoutRuns(item), SUBSTANCE))
    if (w.rate !== null && o.rate !== null && w.rate < o.rate) {
      worseWithPlugin.push({ case: item.name, with: w, without: o })
    }
    const reached = tally(verdicts(withRuns(item), REACHED))
    if (reached.total > 0 && reached.passed === 0) {
      expectedSkillNeverReached.push({ case: item.name, ...reached })
    }
  }
  return {
    cases: cases.length,
    // From the runs themselves: the document's runsPerCase is the case file's
    // own default, which --runs does not change.
    runsPerCase: [...new Set(cases.map((item) => withRuns(item).length))]
      .sort((a, b) => a - b),
    runs: {
      with: cases.flatMap(withRuns).length,
      without: cases.flatMap(withoutRuns).length,
    },
    // Whether the arm under test gave a single substance verdict. Without
    // one there is nothing to report, and a table of zeros would read as a
    // result.
    measured: withSubstance.total > 0,
    substance: {
      with: withSubstance,
      without: withoutSubstance,
      difference: withSubstance.rate === null || withoutSubstance.rate === null
        ? null
        : withSubstance.rate - withoutSubstance.rate,
      unjudged: {
        with: unjudged(withRuns).length,
        without: unjudged(withoutRuns).length,
      },
    },
    reachedExpectedSkill: pooled(withRuns, REACHED),
    loadedAnySkill: pooled(withRuns, LOADED),
    worseWithPlugin,
    expectedSkillNeverReached,
    errored: { with: failed(withRuns).length, without: failed(withoutRuns).length },
    errors: reasons(
      [...failed(withRuns), ...failed(withoutRuns)].map((run) => firstLine(run.error)),
    ),
    notJudged: reasons(
      [...unjudged(withRuns), ...unjudged(withoutRuns)].map((run) =>
        firstLine(substanceOf(run)?.explanation ?? 'no substance grader in the run')),
    ),
    costUsd: document.costUsd,
    durationSeconds: document.durationSeconds,
    partial: document.partial,
    partialReason: document.partialReason ?? null,
  }
}

const show = ({ passed, total, rate }) =>
  rate === null ? 'n/a' : `${passed}/${total} (${Math.round(rate * 100)}%)`

function gaps (counts, messages, what) {
  if (messages.length === 0) return []
  return [
    '',
    `${counts.with} run(s) with the plugin and ${counts.without} without ${what}:`,
    ...messages.map(({ message, count }) => `  ${count} x ${message}`),
  ]
}

function describe (summary) {
  const { substance } = summary
  const lines = [
    `cases ${summary.cases}, runs per case ${summary.runsPerCase.join(', ')}, ` +
      `runs ${summary.runs.with} with the plugin and ${summary.runs.without} without`,
    '',
    `substance with the plugin     ${show(substance.with)}`,
    `substance without it          ${show(substance.without)}`,
    'difference                    ' +
      (substance.difference === null
        ? 'n/a'
        : `${substance.difference > 0 ? '+' : ''}` +
          `${Math.round(substance.difference * 100)} points`),
    `reached expected skill        ${show(summary.reachedExpectedSkill)}` +
      '  (with the plugin, cases that name one)',
    `loaded any skill              ${show(summary.loadedAnySkill)}` +
      '  (with the plugin)',
  ]
  lines.push(...gaps(
    summary.errored, summary.errors,
    'ended in an error and are left out of every rate',
  ))
  lines.push(...gaps(
    substance.unjudged, summary.notJudged,
    'have no substance verdict and are left out of that rate',
  ))
  if (summary.worseWithPlugin.length > 0) {
    lines.push('', 'substance lower with the plugin than without it:')
    for (const item of summary.worseWithPlugin) {
      lines.push(`  ${item.case}  ${show(item.with)} against ${show(item.without)}`)
    }
  }
  if (summary.expectedSkillNeverReached.length > 0) {
    lines.push('', 'expected skill never reached:')
    for (const item of summary.expectedSkillNeverReached) {
      lines.push(`  ${item.case}  ${show(item)}`)
    }
  }
  lines.push(
    '',
    `cost $${summary.costUsd.toFixed(2)}, ${summary.durationSeconds} s` +
      (summary.partial ? `, PARTIAL (${summary.partialReason})` : ''),
  )
  return lines
}

// ------------------------------------------------------------------ the run

const say = (line = '') => process.stdout.write(`${line}\n`)
const complain = (line) => process.stderr.write(`${line}\n`)

function runChild (args, cwd) {
  return new Promise((done) => {
    const child = spawn('claude', args, { cwd, stdio: 'inherit' })
    // The terminal sends Ctrl-C to the child as well. Staying alive until it
    // has exited is what lets the generated directory be removed.
    const ignore = () => {}
    const forward = () => child.kill('SIGTERM')
    process.on('SIGINT', ignore)
    process.on('SIGTERM', forward)
    const finish = (outcome) => {
      process.off('SIGINT', ignore)
      process.off('SIGTERM', forward)
      done(outcome)
    }
    child.on('error', (error) => finish({ error }))
    child.on('close', (code, signal) => finish({ code, signal }))
  })
}

function readSystemFile (path) {
  const text = readMarkdown(resolve(path))
  if (text.trim() === '') {
    throw new Error(`${path} is empty, so it would add nothing to the system prompt`)
  }
  return text
}

async function main (argv) {
  const options = parseArgs(argv)
  const systemPrompt =
    options.systemFile === null ? null : readSystemFile(options.systemFile)
  const cases = buildCases(chooseScenarios(scenarios(), options.only), {
    tag: options.tag,
    systemPrompt,
  })

  // Resolved, so the tool is handed the path it will see itself on.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'fds-eval-plugin-')))
  try {
    writeRoot(root, cases, options.variant)
  } catch (error) {
    rmSync(root, { recursive: true, force: true })
    throw error
  }
  if (options.dryRun) {
    say(`dry run: ${cases.length} case(s) written to ${root}`)
    say('nothing was run; the directory stays so the cases can be read')
    return 0
  }
  try {
    return await grade(options, cases, root)
  } finally {
    if (options.keep) say(`kept ${root}`)
    else rmSync(root, { recursive: true, force: true })
  }
}

async function grade (options, cases, root) {
  const outDir = join(RESULTS, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(outDir, { recursive: true })
  const resultFile = join(outDir, 'result.json')

  const tagged = options.tag === null
    ? cases.length
    : cases.filter((item) => item.tags.includes(options.tag)).length
  say(
    `${tagged} case(s) will run` +
      `${options.tag === null ? '' : ` (tag ${options.tag})`}` +
      `${options.variant === null ? '' : `, variant ${options.variant}`}`,
  )
  say(`agent ${options.model}, judge ${options.judgeModel}, ceiling $${options.maxCostUsd}`)
  say(`results ${outDir}`)
  say()

  const outcome = await runChild(
    childArgs(options, { root, resultFile, outDir }),
    root,
  )
  say()
  if (outcome.error !== undefined) {
    rmSync(outDir, { recursive: true, force: true })
    complain(
      outcome.error.code === 'ENOENT'
        ? 'error claude is not on PATH, so nothing was run'
        : `error claude could not be started: ${outcome.error.message}`,
    )
    return 1
  }
  // A child stopped by a signal has no exit code; the shell's convention is
  // 128 and the signal number, which is what the tool itself exits with.
  const status = outcome.code ?? 128 + (constants.signals[outcome.signal] ?? 0)
  if (status !== 0) {
    complain(
      'error claude plugin eval ' +
        (outcome.signal === null
          ? `exited ${status}${EXIT_MEANING[status] ? `: ${EXIT_MEANING[status]}` : ''}`
          : `was stopped by ${outcome.signal}`),
    )
  }

  // Read even after a failure: a partial run still holds what finished.
  let summary
  let document
  try {
    document = JSON.parse(readFileSync(resultFile, 'utf8'))
    summary = summarise(document)
  } catch (error) {
    complain(
      'error no summary: ' +
        (error.code === 'ENOENT' ? `${resultFile} was not written` : error.message),
    )
    return status === 0 ? 1 : status
  }
  for (const line of describe(summary)) say(line)
  writeFileSync(
    join(outDir, 'summary.json'),
    `${JSON.stringify({
      run: {
        variant: options.variant,
        model: options.model,
        judgeModel: options.judgeModel,
        ablation: document.suite?.ablation ?? options.ablation,
        runsFlag: options.runs,
        tag: options.tag,
        only: options.only === null ? null : [...options.only],
        systemFile: options.systemFile,
        claudeVersion: document.claudeVersion,
        startedAt: document.startedAt,
        resultFile,
      },
      ...summary,
    }, null, 2)}\n`,
  )
  say()
  say(`summary ${join(outDir, 'summary.json')}`)
  if (summary.measured) {
    say('A difference smaller than the spread between repeated runs is not a')
    say('difference. Read the answers behind a number before acting on it: the')
    say('result file keeps each one, in the evidence of the substance grader.')
  } else {
    complain('error nothing was measured: no run with the plugin gave a substance verdict')
  }
  if (summary.partial) {
    complain(`error the run is partial (${summary.partialReason}); the numbers cover only what finished`)
    return 2
  }
  if (status !== 0) return status
  return summary.measured ? 0 : 1
}

// ----------------------------------------------------------------- selftest

// Each check is shown the defect it was written for, in memory: nothing is
// written and nothing is spawned.
function selftest () {
  const check = (label, ok, detail = '') => {
    if (!ok) {
      complain(`selftest FAILED: ${label}${detail === '' ? '' : `\n${detail}`}`)
      process.exit(1)
    }
    say(`selftest ok: ${label}`)
  }
  const throws = (action, pattern) => {
    try {
      action()
    } catch (error) {
      return pattern.test(error.message)
    }
    return false
  }
  const fake = (extra = {}) => ({
    id: '7',
    title: 'A fake one',
    prompt: 'A prompt.',
    expected: [],
    criteria: 'Must contain: a thing.',
    ...extra,
  })
  const NO_OPTIONS = { tag: null, systemPrompt: null }
  const graderNames = (item) => item.graders.map((grader) => grader.name)

  const two = caseOf(fake({ expected: ['functional-a', 'functional-b'] }), null)
  const indicators = two.graders.filter((grader) => grader.name === REACHED)
  check('a scenario with two expected skills gets one indicator', indicators.length === 1)
  const pattern = new RegExp(indicators[0].input_match)
  check(
    'that indicator is an alternation of both ids',
    indicators[0].input_match.includes('(?:functional-a|functional-b)'),
    indicators[0].input_match,
  )
  check(
    'the alternation matches either id, with or without a plugin prefix',
    pattern.test('{"skill":"functional-a"}') &&
      pattern.test('{"skill": "pack:functional-b"}') &&
      !pattern.test('{"skill":"functional-c"}') &&
      !pattern.test('{"skill":"functional-a-and-more"}'),
  )
  check(
    'a scenario with no expected skill gets no indicator for one',
    graderNames(caseOf(fake(), null)).join() === `${LOADED},${SUBSTANCE}`,
  )
  check('every case also carries the any-skill indicator and the judge',
    graderNames(two).join() === `${REACHED},${LOADED},${SUBSTANCE}`)

  const real = scenarios()
  check(
    'the Should reach sentence is in no rubric',
    real.every((scenario) => !/Should reach/.test(rubricFor(scenario.criteria))),
  )
  check(
    'a Should reach sentence wrapped across lines is dropped from criteria',
    parseScenarios(
      '# S\n\n## 1. One\n\n> A prompt.\n\nMust contain: a thing. Should\n' +
        'reach `functional-x`.\n',
    )[0].criteria === 'Must contain: a thing.',
  )
  check(
    'a scenario with no prose after its quote throws, naming its number',
    throws(
      () => parseScenarios('# S\n\n## 1. One\n\n> A.\n\nMust contain: x.\n\n## 2. Two\n\n> B.\n'),
      /scenario 2 /,
    ),
  )
  check(
    'the rubric holds the criteria between its opening and its verdict',
    rubricFor('CRITERIA').split('\n\n').length === 3 &&
      rubricFor('CRITERIA').split('\n\n')[1] === 'CRITERIA',
  )
  check(
    'every id in the smoke set is a scenario',
    [...SMOKE].every((id) => real.some((scenario) => scenario.id === id)),
  )
  check(
    'a case is tagged smoke exactly when its scenario is in the smoke set',
    real.every((scenario) =>
      caseOf(scenario, null).tags.includes('smoke') === SMOKE.has(scenario.id)),
  )
  check(
    'every real scenario survives a round trip through YAML',
    real.every((scenario) => {
      const item = caseOf(scenario, null)
      return JSON.stringify(parseYaml(stringify(item, { lineWidth: 0 }))) ===
        JSON.stringify(item)
    }),
  )
  check(
    'every case name is unique and starts with its scenario number',
    new Set(real.map((s) => caseName(s))).size === real.length &&
      real.every((s) => caseName(s).startsWith(`q${s.id.padStart(2, '0')}-`)),
  )
  check(
    'a system file becomes append_system_prompt on the case',
    caseOf(fake(), 'Be brief.').execution.append_system_prompt === 'Be brief.' &&
      !('append_system_prompt' in caseOf(fake(), null).execution),
  )
  check('generating from an empty scenario list throws',
    throws(() => buildCases([], NO_OPTIONS), /nothing would be measured/))
  check('a tag no case carries throws',
    throws(() => buildCases([fake()], { ...NO_OPTIONS, tag: 'smoke' }), /no case carries/))
  check('naming a scenario that does not exist throws',
    throws(() => chooseScenarios([fake()], new Set(['99'])), /no scenario numbered 99/))

  const sample = [
    '---',
    'name: functional-sample',
    'description: Use when a sample is needed.',
    'license: MIT',
    'metadata:',
    '  pack: functional-design-skills',
    '  version: 1.0.0',
    '---',
    '',
  ].join('\n')
  const inner = (head) => {
    try {
      return parseYaml(head.replace(/^---\n/, '').replace(/\n---\n$/, ''))
    } catch {
      return {}
    }
  }
  const noDescription = VARIANTS['no-leaf-descriptions'](sample)
  check(
    'no-leaf-descriptions removes the description line and nothing else',
    noDescription === sample.replace('description: Use when a sample is needed.\n', '') &&
      !('description' in inner(noDescription)),
    noDescription,
  )
  const indexOnly = VARIANTS['index-only'](sample)
  check(
    'index-only adds disable-model-invocation inside the frontmatter and nothing else',
    inner(indexOnly)['disable-model-invocation'] === true &&
      indexOnly.replace('disable-model-invocation: true\n', '') === sample,
    indexOnly,
  )
  const skillOf = (head) => ({ id: 'functional-sample', raw: `${head}# Body\n`, body: '# Body\n' })
  check(
    'a variant applied to a whole skill leaves its body alone',
    degrade('no-leaf-descriptions', skillOf(sample)) === `${noDescription}# Body\n`,
  )
  check(
    'a variant that changes nothing throws',
    throws(() => degrade('no-leaf-descriptions', skillOf(noDescription)), /changed nothing/),
  )
  check(
    'a variant that leaves the frontmatter unparseable throws',
    throws(() => degrade('index-only', skillOf(indexOnly)), /unique/),
  )
  check('an unknown variant throws', throws(() => variantFor('everything'), /unknown variant/))
  check('a name that only exists on Object.prototype is not a variant',
    throws(() => variantFor('toString'), /unknown variant/))

  const defaults = childArgs(parseArgs([]), {
    root: '/r', resultFile: '/o/result.json', outDir: '/o',
  })
  const after = (flag) => defaults[defaults.indexOf(flag) + 1]
  check(
    'a run with no flags is capped, pinned to both models, and scores nothing',
    after('--max-cost-usd') === '30' && after('--model') === AGENT_MODEL &&
      after('--judge-model') === JUDGE_MODEL && after('--concurrency') === '4' &&
      after('--threshold') === '0' && defaults.includes('--scaffold') &&
      defaults.includes('--no-publish') && defaults.includes('--trust-plugin') &&
      !defaults.includes('--runs') && !defaults.includes('--tag') &&
      !defaults.includes('--ablation') && !defaults.includes('--keep-temp'),
    defaults.join(' '),
  )
  const given = childArgs(
    parseArgs([
      '--runs', '1', '--tag', 'smoke', '--ablation', 'none', '--jobs', '2',
      '--max-cost-usd', '1.5', '--keep',
    ]),
    { root: '/r', resultFile: '/o/result.json', outDir: '/o' },
  )
  const sent = (flag) => given[given.indexOf(flag) + 1]
  check(
    'every flag that is given is passed through, the tag last',
    sent('--runs') === '1' && sent('--tag') === 'smoke' &&
      sent('--ablation') === 'none' && sent('--concurrency') === '2' &&
      sent('--max-cost-usd') === '1.5' && given.includes('--keep-temp') &&
      given.lastIndexOf('--tag') > given.indexOf('--concurrency') &&
      given.indexOf('--tag') === given.length - 2,
    given.join(' '),
  )
  check('a misspelt flag throws', throws(() => parseArgs(['--run', '1']), /unknown argument --run/))
  check('a flag without its value throws', throws(() => parseArgs(['--runs']), /needs a value/))
  check('a ceiling of zero throws', throws(() => parseArgs(['--max-cost-usd', '0']), /above 0/))
  check('a run count that is not whole throws', throws(() => parseArgs(['--runs', '1.5']), /whole number/))

  // The shapes the tool writes. A judge that gave a verdict leaves its votes;
  // one that threw or was skipped is a failed grader with an explanation and
  // no votes. runsPerCase is the case file's default, which --runs does not
  // change, so it is made wrong here on purpose.
  const grader = (name, passed) => ({
    name, passed, weight: 1, explanation: '', withOnly: false, scored: false,
    ...(name === SUBSTANCE ? { judgeVotes: [passed, passed, passed], evidence: 'x' } : {}),
  })
  const run = (verdict, extra = {}) => ({
    score: 0, passed: false, turns: 1, costUsd: 0.01, judgeCostUsd: 0,
    error: null, skippedPaidGraders: false,
    graders: Object.entries(verdict).map(([name, passed]) => grader(name, passed)),
    ...extra,
  })
  const noVerdict = (explanation) => ({
    name: SUBSTANCE, passed: false, weight: 1, explanation, withOnly: false, scored: true,
  })
  const row = (name, withRuns, withoutRuns) => ({
    name, runsPerCase: 3,
    arms: { with: withRuns, ...(withoutRuns ? { without: withoutRuns } : {}) },
  })
  const document = {
    schemaVersion: 1, costUsd: 0.5, durationSeconds: 12, partial: false,
    cases: [
      row('q01-a',
        [run({ [REACHED]: true, [LOADED]: true, [SUBSTANCE]: true }),
          run({ [REACHED]: false, [LOADED]: true, [SUBSTANCE]: true })],
        [run({ [LOADED]: false, [SUBSTANCE]: true }),
          run({ [LOADED]: false, [SUBSTANCE]: false })]),
      row('q02-b',
        [run({ [REACHED]: false, [LOADED]: true, [SUBSTANCE]: false }),
          run({ [REACHED]: false, [LOADED]: false, [SUBSTANCE]: false })],
        [run({ [LOADED]: false, [SUBSTANCE]: true }),
          run({ [LOADED]: false, [SUBSTANCE]: true })]),
      row('q03-c',
        [run({ [LOADED]: true, [SUBSTANCE]: true }),
          run({ [LOADED]: true, [SUBSTANCE]: false })],
        [run({ [LOADED]: false, [SUBSTANCE]: true }),
          run({ [LOADED]: false, [SUBSTANCE]: false })]),
    ],
  }
  const summary = summarise(document)
  check(
    'substance is counted from the graders by name, whatever the scores say',
    summary.substance.with.passed === 3 && summary.substance.with.total === 6 &&
      summary.substance.without.passed === 4 && summary.substance.without.total === 6,
    JSON.stringify(summary.substance),
  )
  check(
    'the difference is the with rate less the without rate',
    Math.abs(summary.substance.difference - (3 / 6 - 4 / 6)) < 1e-9,
  )
  check(
    'only a case worse with the plugin is listed as worse',
    summary.worseWithPlugin.length === 1 && summary.worseWithPlugin[0].case === 'q02-b',
    JSON.stringify(summary.worseWithPlugin),
  )
  check(
    'the expected skill is counted only over cases that name one',
    summary.reachedExpectedSkill.passed === 1 && summary.reachedExpectedSkill.total === 4 &&
      summary.expectedSkillNeverReached.length === 1 &&
      summary.expectedSkillNeverReached[0].case === 'q02-b',
    JSON.stringify(summary.reachedExpectedSkill),
  )
  check(
    'loaded-any-skill is counted in the arm with the plugin only',
    summary.loadedAnySkill.passed === 5 && summary.loadedAnySkill.total === 6,
    JSON.stringify(summary.loadedAnySkill),
  )
  const oneArm = summarise({
    ...document,
    cases: document.cases.map((item) => row(item.name, item.arms.with, null)),
  })
  check(
    'a run with no baseline arm reports no baseline and no difference',
    oneArm.substance.without.total === 0 && oneArm.substance.difference === null &&
      oneArm.worseWithPlugin.length === 0 && oneArm.runs.without === 0,
  )
  check(
    'the runs per case come from the runs, not from the case file default',
    summary.runsPerCase.join() === '2' && document.cases[0].runsPerCase === 3,
    JSON.stringify(summary.runsPerCase),
  )
  const withGaps = summarise({
    ...document,
    cases: [
      row('q01-a',
        [run({ [SUBSTANCE]: true }),
          run({ [REACHED]: true, [LOADED]: true, [SUBSTANCE]: true }, { error: 'timed out' }),
          run({ [LOADED]: true }, { graders: [noVerdict('grader threw: judge call failed: limit')] }),
          run({ [LOADED]: true }, { graders: [noVerdict('skipped: cost ceiling')] })],
        [run({ [SUBSTANCE]: true })]),
    ],
  })
  check(
    'a run that errored, or whose judge gave no verdict, is left out and counted',
    withGaps.substance.with.total === 1 && withGaps.substance.with.passed === 1 &&
      withGaps.errored.with === 1 && withGaps.substance.unjudged.with === 2 &&
      withGaps.reachedExpectedSkill.total === 0,
    JSON.stringify(withGaps),
  )
  check(
    'the reasons behind those runs are kept, so the cause can be read',
    withGaps.errors[0].message === 'timed out' &&
      withGaps.notJudged.length === 2 &&
      withGaps.notJudged.some((reason) => reason.message.startsWith('grader threw: judge call failed')),
    JSON.stringify(withGaps.notJudged),
  )
  check(
    'the summary names those reasons',
    describe(withGaps).some((line) => line.includes('1 x timed out')) &&
      describe(withGaps).some((line) => line.includes('1 x skipped: cost ceiling')),
  )
  const broken = summarise({
    ...document,
    cases: [
      row('q01-a',
        [run({ [LOADED]: true }, { graders: [noVerdict('grader threw: judge call failed: limit')] }),
          run({ [LOADED]: true }, { error: "exit 1: You've hit your session limit" })],
        [run({ [SUBSTANCE]: true })]),
    ],
  })
  check(
    'a run in which the judge gave no verdict for the plugin arm is not measured',
    broken.measured === false && broken.substance.with.rate === null &&
      broken.substance.without.total === 1,
    JSON.stringify(broken.substance),
  )
  check('a run with a verdict for the plugin arm is measured', summary.measured === true)
  check('a result document with no cases throws',
    throws(() => summarise({ ...document, cases: [] }), /nothing was measured/))
  check('a result document from another schema version throws',
    throws(() => summarise({ ...document, schemaVersion: 2 }), /schemaVersion 2/))
  check(
    'the summary says when it is partial',
    describe(summarise({ ...document, partial: true, partialReason: 'cost_ceiling' }))
      .some((line) => line.includes('PARTIAL (cost_ceiling)')),
  )
  process.exit(0)
}

if (process.argv.includes('--selftest')) selftest()

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error) {
  complain(`error ${error.message}`)
  process.exitCode = 1
}
