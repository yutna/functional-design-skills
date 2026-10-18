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
// The task cases are the other half. A scenario is a question; most real work
// is not, and an agent that is only ever asked about design problems is never
// shown one it has to notice. Each file in evals/tasks asks the agent to
// change a small project, evals/fixture-tasks, and grades the files it leaves
// behind. Their families are task (the pack should change what is built),
// restraint (it should change nothing) and precedence (the project's own
// written convention disagrees with the pack, and the convention wins). They
// are written the way `claude plugin eval` reads a case and are copied as they
// are; the runner adds only the system file's text, if there is one.
//
// A task case passes in a run when every grader passes, leaving out the
// indicators: a `tool_used` grader whose name begins `loaded-` says what the
// agent did on the way, and does not decide whether the work was right. Each
// family is summed apart, and the graders that failed are named per case, so
// that a failure can be traced to the one point it tests.
//
// A variant degrades the copied plugin before the cases are written, to
// measure how the pack behaves when the skill listing is poorer. A system
// file adds its text to the system prompt of every case.
//
// Usage:
//   node scripts/eval-plugin.mjs --dry-run            build the cases, call nothing
//   node scripts/eval-plugin.mjs --tag smoke          a few cases, both arms
//   node scripts/eval-plugin.mjs --tag restraint      one family of task cases
//   node scripts/eval-plugin.mjs                      every scenario, both arms
//   node scripts/eval-plugin.mjs --only 1,34 --runs 1 two scenarios, once each
//   node scripts/eval-plugin.mjs --ablation none      with the pack only
//   node scripts/eval-plugin.mjs --variant index-only the core skills hidden
//   node scripts/eval-plugin.mjs --selftest           prove the logic, call nothing
//                                                     (npm run test:guards runs it)
//
// Flags, each with a value unless noted:
//   --only 1,t04-...   scenario numbers and task case names (default: all)
//   --tag NAME         only the cases carrying this tag: question, task,
//                      restraint, precedence or smoke
//   --runs N           runs per case and arm (default: the tool's, which is 3)
//   --ablation MODE    none | with-without (default: the tool's)
//   --model ID         the agent under test
//   --judge-model ID   the judge
//   --max-cost-usd N   ceiling for the whole run, always passed (default 30);
//                      a second invocation gets what the first left of it
//   --jobs N           agent runs in flight at once (default 4)
//   --variant NAME     no-leaf-descriptions | index-only
//   --system-file PATH text appended to the system prompt of every case
//   --dry-run          generate the cases, print where, spawn nothing
//   --keep             keep the generated directory and the tool's workspaces
//                      (each run's trace is kept under traces/ either way)
//   --selftest         no value; run in memory and exit

import {
  chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readdirSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs'
import { constants, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { parse as parseYaml, stringify } from 'yaml'
import { readMarkdown, slugOf } from './lib/markdown.mjs'
import {
  EVALS_DIR, INDEX_SKILL, ROOT, TASK_FAMILIES, languagePackIds,
  parseScenarios, parseTaskCase, readSkill, scenarios, skillIds, taskCases,
} from './lib/pack.mjs'

const PLUGIN = join(ROOT, 'plugin')
const FIXTURE = join(EVALS_DIR, 'fixture')
const FIXTURE_TASKS = join(EVALS_DIR, 'fixture-tasks')
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

// The fixture is copied into the case's directory under its own name, and the
// script copies it from there into the working directory of the run.
const fixtureScript = (fixtureName) => [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
  `cp -R "$here/${fixtureName}/." .`,
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
// The same measure by the other road: the index links skills by path, and an
// agent that follows a link opens the SKILL.md with Read instead of calling
// the Skill tool. A run reached the expected skill when either one passed.
const REACHED_FILE = 'reached-expected-skill-file'
const LOADED = 'loaded-any-skill'
const QUESTION = 'question'

// ---------------------------------------------------------------- the cases

const skillPattern = (ids) =>
  String.raw`"skill"\s*:\s*"(?:[\w-]+:)?(?:${ids.join('|')})"`

const skillFilePattern = (ids) =>
  String.raw`"file_path"\s*:\s*"[^"]*/(?:${ids.join('|')})/SKILL\.md"`

// The prompts describe code the fixture does not contain: a cart service, a
// board of two hundred aggregates. An agent that searches for it finds nothing
// and ends on "I can't find the code", which is all the judge reads. The 3.2.2
// baseline did that in 45 of 126 pack-arm runs and 59 of 126 block-arm runs,
// so those numbers measured the fixture as well as the pack. Every question
// case says so up front.
const NOT_IN_WORKSPACE =
  'The code the user describes is not in this workspace; answer from the description.'

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
    // The tool makes a Skill grader an indicator on its own, but not a Read
    // grader, so this one says it. Scored, it fails every no-pack run, which
    // has no SKILL.md to read, and it lowered the tool's own scores and delta
    // in both arms; the runner's counts never read those.
    graders.push({
      name: REACHED_FILE,
      type: 'tool_used',
      tool: 'Read',
      input_match: skillFilePattern(scenario.expected),
      arm: 'with-only',
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
      append_system_prompt: systemPrompt === null
        ? NOT_IN_WORKSPACE
        : [NOT_IN_WORKSPACE, systemPrompt].join('\n\n'),
    },
    graders,
  }
}

// What a task case is, as the runner holds it: the file's document, with the
// system file's text added to its own, if it has one. Nothing else is changed.
function taskCaseOf (task, systemPrompt) {
  const { document } = task
  const own = document.execution.append_system_prompt
  const appended = [own, systemPrompt].filter((text) =>
    typeof text === 'string' && text !== '')
  return {
    ...document,
    context: { ...document.context, scaffold_script: 'fixture.sh' },
    execution: {
      ...document.execution,
      ...(appended.length === 0
        ? {}
        : { append_system_prompt: appended.join('\n\n') }),
    },
  }
}

// An indicator says what the agent did on the way. It is reported beside the
// grades and decides none of them.
const isIndicator = (grader) =>
  grader.type === 'tool_used' && String(grader.name).startsWith('loaded-')

// Each entry is a case and the fixture its scaffold script copies.
function buildCases (scenarioList, taskList, { tag, systemPrompt }) {
  const entries = [
    ...scenarioList.map((scenario) => ({
      item: caseOf(scenario, systemPrompt),
      family: QUESTION,
      fixture: FIXTURE,
    })),
    ...taskList.map((task) => ({
      item: taskCaseOf(task, systemPrompt),
      family: task.family,
      fixture: FIXTURE_TASKS,
    })),
  ]
  if (entries.length === 0) {
    throw new Error('no case to build, so nothing would be measured')
  }
  for (const { item } of entries.slice(scenarioList.length)) {
    if (item.graders.every(isIndicator)) {
      throw new Error(`${item.name}: every grader is an indicator, so no run could fail`)
    }
  }
  if (tag === null) return entries
  const chosen = entries.filter(({ item }) => item.tags.includes(tag))
  if (chosen.length === 0) {
    throw new Error(`no case carries the tag "${tag}", so nothing would be measured`)
  }
  return chosen
}

// Scenario numbers and task case names share one list. A name in it that
// neither one answers to is an error: a run that dropped it would measure
// something other than what was asked.
function choose (scenarioList, taskList, only) {
  if (only === null) return { scenarioList, taskList }
  const known = new Set([
    ...scenarioList.map((scenario) => scenario.id),
    ...taskList.map((task) => task.name),
  ])
  const missing = [...only].filter((id) => !known.has(id))
  if (missing.length > 0) {
    throw new Error(
      `--only names no scenario numbered or task case named ${missing.join(', ')}`,
    )
  }
  return {
    scenarioList: scenarioList.filter((scenario) => only.has(scenario.id)),
    taskList: taskList.filter((task) => only.has(task.name)),
  }
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

// `claude plugin eval` keeps the tools that reach outside a run behind an
// operator's grant: a case may list Write in its allowed_tools and still be
// refused it. The first run of the task cases showed it, when no agent in
// either arm could change a file and every case graded the fixture as it was
// copied. The runner grants the two tools that write files, and only to a run
// whose cases ask for them. A case that asks for anything wider is refused
// here: a shell or the network is a grant this runner does not make.
const GATED = /^(?:Bash|Write|Edit|WebFetch|mcp__)/
const GRANTED = ['Write', 'Edit']

function grantsFor (entries) {
  const asked = new Map()
  for (const { item } of entries) {
    for (const tool of item.execution.allowed_tools ?? []) {
      if (GATED.test(tool)) asked.set(tool, item.name)
    }
  }
  for (const [tool, name] of asked) {
    if (!GRANTED.includes(tool)) {
      throw new Error(
        `${name}: asks for ${tool}, which needs a grant this runner does not ` +
          `make; it grants ${GRANTED.join(' and ')} only`,
      )
    }
  }
  return GRANTED.filter((tool) => asked.has(tool))
}

// The grant is run-wide: `--allow-tools` reaches every case in the invocation.
// A question case asks for Read, Glob, Grep and Skill only, and in a run that
// also held a task case it was given Write, Edit and NotebookEdit as well. Its
// behaviour changed with them: q04 loaded its skill in 3 of 3 runs without the
// grant and in 0 of 6 with it. So a case is measured with the tools it asks
// for and no others, and a selection that needs different grants is made as
// one invocation per grant set. The cases that need no grant come first, then
// the narrower grants, so the order does not depend on how they were selected.
function groupByGrant (entries) {
  const groups = new Map()
  for (const entry of entries) {
    const grants = grantsFor([entry])
    const key = grants.join(',')
    if (!groups.has(key)) groups.set(key, { grants, entries: [] })
    groups.get(key).entries.push(entry)
  }
  return [...groups.values()].sort((a, b) => a.grants.length - b.grants.length)
}

// What is left of the ceiling for the next invocation. The ceiling is for the
// whole run, so each invocation gets the remainder and not a fresh one.
const remainderOf = (ceiling, spent) =>
  Math.max(0, Math.round((ceiling - spent) * 1e6) / 1e6)

// Why the invocation after this one must not start, or null when it may. A
// partial run stopped on a ceiling or a failed credential, and a second
// invocation would meet the same wall; and with nothing left it has no budget.
function stopAfter (document, status, left) {
  if (status !== 0) return `the invocation before it exited ${status}`
  if (document.partial) {
    return `the invocation before it was partial (${document.partialReason ?? 'no reason given'})`
  }
  if (left <= 0) return 'the cost ceiling is spent'
  return null
}

// One result document from those of the invocations. `order` is the names of
// the cases as buildCases produced them; a case in a document that is not in
// it goes last, where summariseRun names it and throws. `notStarted` is why a
// later invocation did not run, which makes the whole partial. Everything the
// summary reads from the document is carried: cases, costUsd, durationSeconds,
// partial and partialReason, and the schema version, which must agree.
function mergeDocuments (documents, order, notStarted = null) {
  const versions = [...new Set(documents.map((document) => document.schemaVersion))]
  if (versions.length !== 1) {
    throw new Error(
      `the result documents disagree on schemaVersion (${versions.join(', ')})`,
    )
  }
  const rows = documents.flatMap((document) => document.cases ?? [])
  const rank = (row) => {
    const at = order.indexOf(row.name)
    return at === -1 ? order.length : at
  }
  const partial = documents.find((document) => document.partial)
  return {
    ...documents[0],
    cases: [...rows].sort((a, b) => rank(a) - rank(b)),
    costUsd: documents.reduce((sum, document) => sum + document.costUsd, 0),
    durationSeconds:
      documents.reduce((sum, document) => sum + document.durationSeconds, 0),
    partial: partial !== undefined || notStarted !== null,
    partialReason: partial !== undefined
      ? partial.partialReason ?? null
      : notStarted,
  }
}

function childArgs (options, { root, resultFile, outDir, grants = [] }) {
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
  // Always: the tool deletes a run's trace with its scaffold unless told to
  // keep it, and the trace is the only record of which skills the run loaded.
  // The runner copies each trace out and removes the scaffold itself.
  args.push('--keep-temp')
  if (grants.length > 0) args.push('--allow-tools', ...grants)
  // Last, because the tool takes several values for it and would read
  // anything after it as another tag.
  if (options.tag !== null) args.push('--tag', options.tag)
  return args
}

// ----------------------------------------------------------- the traces

// The tool writes each run's trace into a scaffold directory of its own and
// deletes it at the end unless it is kept. A grader says how many times Skill
// was called and never which skill, so the trace is the only place that
// remembers what an agent loaded instead of the expected one.

const PACK_PREFIX = 'functional-design-skills:'
const SCAFFOLD = /^e-[A-Za-z0-9]+$/

// The skills a trace loaded, in order: the `skill` input of each Skill tool
// use, without the pack's prefix. A line that is not JSON is skipped.
const skillsInTrace = (text) => skillUseInTrace(text).skills

// What a trace did with skills: those it loaded with the Skill tool, and the
// directories whose SKILL.md it opened with Read, each in order.
function skillUseInTrace (text) {
  const skills = []
  const files = []
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const content = event?.type === 'assistant' ? event.message?.content : null
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (part?.type !== 'tool_use') continue
      if (part.name === 'Read') {
        const opened = /([^/\\]+)[/\\]SKILL\.md$/.exec(part.input?.file_path ?? '')
        if (opened !== null) files.push(opened[1])
        continue
      }
      if (part.name !== 'Skill') continue
      const skill = part.input?.skill
      if (typeof skill !== 'string') continue
      skills.push(skill.startsWith(PACK_PREFIX)
        ? skill.slice(PACK_PREFIX.length)
        : skill)
    }
  }
  return { skills, files }
}

// Whether a scaffold directory, as a real path, is one the tool made: named
// like its scaffolds and sitting directly in one of the temporary
// directories. Both sides are real paths, so a link cannot stand in for one.
function isScaffold (realDir, tempRoots) {
  return SCAFFOLD.test(basename(realDir)) && tempRoots.includes(dirname(realDir))
}

function realOrNull (path) {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

function temporaryDirectories () {
  return [realOrNull(tmpdir()), realOrNull('/private/tmp')]
    .filter((dir) => dir !== null)
}

// The tool leaves a kept scaffold read-only, with `sealed` at mode 000, and
// rmSync fails on both. Links are not followed.
function makeWritable (dir) {
  chmodSync(dir, 0o700)
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (lstatSync(path).isDirectory()) makeWritable(path)
  }
}

// What the file name of a case may hold; the name is the tool's, not ours.
const safeName = (name) => name.replace(/[^\w.-]/g, '_')

// After the tool exits: copy every run's trace under outDir/traces, read the
// skills it loaded, and unless the scaffolds are kept, remove them. Never
// throws; a run whose trace cannot be had gets null. Returns the skills loaded
// and the skill files read per case and arm, one entry per run in the order
// the runs appear.
function keepTraces (document, outDir, { keep, tempRoots = temporaryDirectories() }) {
  const skillsLoaded = {}
  const skillFilesRead = {}
  let kept = 0
  let total = 0
  for (const row of document.cases ?? []) {
    skillsLoaded[row.name] = {}
    skillFilesRead[row.name] = {}
    for (const [arm, runs] of Object.entries(row.arms ?? {})) {
      const used = (runs ?? []).map((run, index) => {
        total += 1
        const source = run?.tracePath
        if (typeof source !== 'string') return null
        const use = copyTrace(
          source,
          join(outDir, 'traces', safeName(row.name), `${arm}-${index + 1}.jsonl`),
        )
        if (use !== null) kept += 1
        // A run that left no trace may still have left its scaffold.
        if (!keep) removeScaffold(source, tempRoots)
        return use
      })
      skillsLoaded[row.name][arm] = used.map((use) => use?.skills ?? null)
      skillFilesRead[row.name][arm] = used.map((use) => use?.files ?? null)
    }
  }
  return { skillsLoaded, skillFilesRead, kept, total }
}

// The skills the trace at source used, after copying it to target, or null
// when there is no trace to copy.
function copyTrace (source, target) {
  if (!existsSync(source)) return null
  try {
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    return skillUseInTrace(readFileSync(target, 'utf8'))
  } catch (error) {
    complain(`warning trace ${source} was not kept: ${error.message}`)
    return null
  }
}

function removeScaffold (tracePath, tempRoots) {
  const out = dirname(tracePath)
  if (!existsSync(dirname(out))) return
  const scaffold = basename(out) === 'out' ? realOrNull(dirname(out)) : null
  if (scaffold === null || !isScaffold(scaffold, tempRoots)) {
    complain(`warning ${dirname(out)} is not a scaffold of the tool; left alone`)
    return
  }
  try {
    makeWritable(scaffold)
    rmSync(scaffold, { recursive: true, force: true })
  } catch (error) {
    complain(`warning ${scaffold} was not removed: ${error.message}`)
  }
}

function describeTraces ({ kept, total }, outDir) {
  const line = `traces ${kept} of ${total} kept in ${join(outDir, 'traces')}`
  return total > 0 && kept === 0
    ? `${line}; no trace was found, so skillsLoaded holds nothing`
    : line
}

// ------------------------------------------------------------ the directory

function writeRoot (root, entries, variant) {
  cpSync(PLUGIN, root, { recursive: true })
  if (variant !== null) applyVariant(variant, root)
  for (const { item, fixture } of entries) {
    const dir = join(root, 'evals', item.name)
    const fixtureName = fixture === FIXTURE_TASKS ? 'fixture-tasks' : 'fixture'
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'case.yaml'), stringify(item, { lineWidth: 0 }))
    writeFileSync(join(dir, 'fixture.sh'), fixtureScript(fixtureName))
    chmodSync(join(dir, 'fixture.sh'), 0o755)
    cpSync(fixture, join(dir, fixtureName), { recursive: true })
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
    const found = (graderName) =>
      run.graders.find((candidate) => candidate.name === graderName)
    const grader = found(name)
    if (grader === undefined) return []
    if (name === SUBSTANCE && !judged(grader)) return []
    // One verdict for the measure, whichever road reached the skill.
    if (name === REACHED) {
      return [grader.passed === true || found(REACHED_FILE)?.passed === true]
    }
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

function describeBody (summary) {
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
        : points(substance.difference)),
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
  return lines
}

// A scenario summary read on its own, with the line that closes a run.
function describe (summary) {
  return describeRun({ scenarios: summary, families: {}, ...summary })
}

// ---------------------------------------------- the summary of the task cases

// What the summary needs to know of a case it did not write: its family, and
// its graders by name and type, because a result row says which graders ran
// but not what kind they were, and a judge is told apart from the rest by it.
function planOf (entries) {
  return new Map(entries.map(({ item, family }) => [
    item.name,
    { family, graders: item.graders.map(({ name, type }) => ({ name, type })) },
  ]))
}

function familyOf (plan, name) {
  const planned = plan.get(name)
  if (planned !== undefined) return planned.family
  if (/^q\d+-/.test(name)) return QUESTION
  throw new Error(
    `the result holds a case called ${name}, which this runner did not generate`,
  )
}

// One run of a task case, by what it measured. A run that ended in an error is
// not a sample of the agent's work. Nor is one in which a grader that should
// have given a verdict gave none: a judge that threw is recorded as a failed
// grader, and counting it as a failed answer would score a harness fault
// against the arm it landed in. Only a run in which every grader gave one is
// graded, and it passes when every grader other than the indicators passed.
function gradeRun (run, planned) {
  if (run.error) return { state: 'errored', reason: firstLine(run.error) }
  const failed = []
  for (const wanted of planned.graders) {
    if (isIndicator(wanted)) continue
    const got = run.graders.find((candidate) => candidate.name === wanted.name)
    if (got === undefined) {
      return { state: 'ungraded', reason: `${wanted.name}: no verdict in the run` }
    }
    if (wanted.type === 'llm' && !judged(got)) {
      return {
        state: 'ungraded',
        reason: `${wanted.name}: ${firstLine(got.explanation ?? 'not judged')}`,
      }
    }
    if (got.passed !== true) failed.push(wanted.name)
  }
  return { state: 'graded', pass: failed.length === 0, failed }
}

const ARMS = ['with', 'without']

function summariseFamily (rows, plan) {
  const armOf = (row, arm) => (arm === 'with' ? row.arms.with : row.arms.without ?? [])
  const outcomes = rows.map((row) => {
    const planned = plan.get(row.name)
    return {
      row,
      planned,
      by: Object.fromEntries(ARMS.map((arm) => [
        arm,
        armOf(row, arm).map((run) => ({ run, ...gradeRun(run, planned) })),
      ])),
    }
  })
  const every = (arm) => outcomes.flatMap((entry) => entry.by[arm])
  const gradedIn = (list) => list.filter((outcome) => outcome.state === 'graded')
  const pass = (arm) => tally(gradedIn(every(arm)).map((outcome) => outcome.pass))
  const count = (arm, state) => every(arm).filter((o) => o.state === state).length
  const messages = (state) => reasons(
    ARMS.flatMap((arm) => every(arm).filter((o) => o.state === state))
      .map((outcome) => outcome.reason),
  )

  const indicators = {}
  const failedGraders = []
  const worseWithPlugin = []
  for (const { row, planned, by } of outcomes) {
    for (const wanted of planned.graders.filter(isIndicator)) {
      indicators[wanted.name] ??= { with: [], without: [] }
      for (const arm of ARMS) {
        for (const outcome of by[arm].filter((o) => o.state !== 'errored')) {
          const got = outcome.run.graders.find((c) => c.name === wanted.name)
          if (got !== undefined) indicators[wanted.name][arm].push(got.passed === true)
        }
      }
    }
    for (const wanted of planned.graders.filter((g) => !isIndicator(g))) {
      const failures = Object.fromEntries(ARMS.map((arm) => {
        const graded = gradedIn(by[arm])
        return [arm, {
          failed: graded.filter((o) => o.failed.includes(wanted.name)).length,
          total: graded.length,
        }]
      }))
      if (failures.with.failed + failures.without.failed > 0) {
        failedGraders.push({ case: row.name, grader: wanted.name, ...failures })
      }
    }
    const w = tally(gradedIn(by.with).map((o) => o.pass))
    const o = tally(gradedIn(by.without).map((x) => x.pass))
    if (w.rate !== null && o.rate !== null && w.rate < o.rate) {
      worseWithPlugin.push({ case: row.name, with: w, without: o })
    }
  }
  const withPass = pass('with')
  const withoutPass = pass('without')
  return {
    cases: rows.length,
    runs: {
      with: withPass.total,
      without: withoutPass.total,
    },
    measured: withPass.total > 0,
    pass: {
      with: withPass,
      without: withoutPass,
      difference: withPass.rate === null || withoutPass.rate === null
        ? null
        : withPass.rate - withoutPass.rate,
    },
    indicators: Object.fromEntries(Object.entries(indicators).map(([name, arms]) =>
      [name, { with: tally(arms.with), without: tally(arms.without) }])),
    failedGraders,
    worseWithPlugin,
    errored: { with: count('with', 'errored'), without: count('without', 'errored') },
    errors: messages('errored'),
    ungraded: { with: count('with', 'ungraded'), without: count('without', 'ungraded') },
    notGraded: messages('ungraded'),
  }
}

// The whole result: the scenarios as summarise() reads them, and each family of
// task cases apart. `scenarios` is null when no scenario ran. The run is
// measured when every part that ran is.
function summariseRun (document, plan) {
  if (document.schemaVersion !== 1) {
    throw new Error(
      `the result document is schemaVersion ${document.schemaVersion}; ` +
        'this runner reads 1',
    )
  }
  if (!Array.isArray(document.cases) || document.cases.length === 0) {
    throw new Error('the result document holds no cases, so nothing was measured')
  }
  const byFamily = new Map()
  for (const row of document.cases) {
    const family = familyOf(plan, row.name)
    byFamily.set(family, [...(byFamily.get(family) ?? []), row])
  }
  const asked = byFamily.get(QUESTION)
  const scenarioSummary = asked === undefined
    ? null
    : summarise({ ...document, cases: asked })
  const families = {}
  for (const family of TASK_FAMILIES) {
    if (byFamily.has(family)) {
      families[family] = summariseFamily(byFamily.get(family), plan)
    }
  }
  return {
    scenarios: scenarioSummary,
    families,
    measured: (scenarioSummary === null || scenarioSummary.measured) &&
      Object.values(families).every((family) => family.measured),
    costUsd: document.costUsd,
    durationSeconds: document.durationSeconds,
    partial: document.partial,
    partialReason: document.partialReason ?? null,
  }
}

const points = (difference) => (difference === null
  ? 'n/a'
  : `${difference > 0 ? '+' : ''}${Math.round(difference * 100)} points`)

function describeFamily (name, family) {
  const lines = [
    `${name}: cases ${family.cases}, runs ${family.runs.with} with the plugin ` +
      `and ${family.runs.without} without`,
    '',
    `pass with the plugin          ${show(family.pass.with)}`,
    `pass without it               ${show(family.pass.without)}`,
    `difference                    ${points(family.pass.difference)}`,
  ]
  const names = Object.keys(family.indicators)
  if (names.length > 0) {
    lines.push('', 'indicators, how often each fired:')
    for (const indicator of names) {
      const { with: w, without: o } = family.indicators[indicator]
      lines.push(`  ${indicator}  with ${show(w)}, without ${show(o)}`)
    }
  }
  if (family.failedGraders.length > 0) {
    lines.push('', 'graders that failed in at least one run:')
    for (const item of family.failedGraders) {
      lines.push(
        `  ${item.case}  ${item.grader}  ` +
          `with ${item.with.failed}/${item.with.total}, ` +
          `without ${item.without.failed}/${item.without.total}`,
      )
    }
  }
  if (family.worseWithPlugin.length > 0) {
    lines.push('', 'pass without the plugin and fail with it, in part or whole:')
    for (const item of family.worseWithPlugin) {
      lines.push(`  ${item.case}  ${show(item.with)} against ${show(item.without)}`)
    }
  }
  lines.push(...gaps(
    family.errored, family.errors,
    'ended in an error and are left out of every rate',
  ))
  lines.push(...gaps(
    family.ungraded, family.notGraded,
    'have a grader with no verdict and are left out of every rate',
  ))
  return lines
}

function describeRun (summary) {
  const lines = []
  const names = Object.keys(summary.families)
  if (summary.scenarios !== null) {
    if (names.length > 0) lines.push('scenarios', '')
    lines.push(...describeBody(summary.scenarios))
  }
  for (const name of names) {
    if (lines.length > 0) lines.push('')
    lines.push(...describeFamily(name, summary.families[name]))
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
  const { scenarioList, taskList } = choose(scenarios(), taskCases(), options.only)
  const cases = buildCases(scenarioList, taskList, {
    tag: options.tag,
    systemPrompt,
  })

  // One directory per grant set, each resolved, so the tool is handed the
  // path it will see itself on.
  const groups = groupByGrant(cases).map((group) =>
    ({ ...group, root: realpathSync(mkdtempSync(join(tmpdir(), 'fds-eval-plugin-'))) }))
  const removeAll = () => {
    for (const { root } of groups) rmSync(root, { recursive: true, force: true })
  }
  try {
    for (const { root, entries } of groups) writeRoot(root, entries, options.variant)
  } catch (error) {
    removeAll()
    throw error
  }
  if (options.dryRun) {
    if (groups.length === 1) {
      say(`dry run: ${cases.length} case(s) written to ${groups[0].root}`)
    } else {
      say(`dry run: ${cases.length} case(s) written to ${groups.length} directories,`)
      say('one invocation each, in this order:')
      for (const { root, entries, grants } of groups) {
        say(`  ${root}: ${entries.length} case(s), ` +
          `${grants.length === 0 ? 'no grant' : `grants ${grants.join(', ')}`}`)
      }
    }
    say('nothing was run; the directories stay so the cases can be read')
    return 0
  }
  try {
    return await grade(options, cases, groups)
  } finally {
    if (options.keep) {
      for (const { root } of groups) say(`kept ${root}`)
    } else {
      removeAll()
    }
  }
}

async function grade (options, cases, groups) {
  const outDir = join(RESULTS, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(outDir, { recursive: true })
  const resultFile = join(outDir, 'result.json')

  say(
    `${cases.length} case(s) will run` +
      `${options.tag === null ? '' : ` (tag ${options.tag})`}` +
      `${options.variant === null ? '' : `, variant ${options.variant}`}` +
      `${groups.length === 1 ? '' : `, in ${groups.length} invocations (one per grant set)`}`,
  )
  say(`agent ${options.model}, judge ${options.judgeModel}, ceiling $${options.maxCostUsd}`)
  say(`results ${outDir}`)
  say()

  // One invocation per group. A single group writes straight to result.json in
  // outDir; several each write their own and are merged into result.json.
  const documents = []
  let status = 0
  let notStarted = null
  let spent = 0
  for (const [at, group] of groups.entries()) {
    const many = groups.length > 1
    const partDir = many ? join(outDir, `part-${at + 1}`) : outDir
    const partFile = many ? join(partDir, 'result.json') : resultFile
    mkdirSync(partDir, { recursive: true })
    if (many) {
      say(
        `invocation ${at + 1} of ${groups.length}: ${group.entries.length} case(s), ` +
          `${group.grants.length === 0 ? 'no grant' : `grants ${group.grants.join(', ')}`}`,
      )
    }
    const outcome = await runChild(
      childArgs(
        { ...options, maxCostUsd: remainderOf(options.maxCostUsd, spent) },
        { root: group.root, resultFile: partFile, outDir: partDir, grants: group.grants },
      ),
      group.root,
    )
    say()
    if (outcome.error !== undefined) {
      if (documents.length === 0) rmSync(outDir, { recursive: true, force: true })
      complain(
        outcome.error.code === 'ENOENT'
          ? 'error claude is not on PATH, so nothing was run'
          : `error claude could not be started: ${outcome.error.message}`,
      )
      if (documents.length === 0) return 1
      notStarted = `invocation ${at + 1} could not be started`
      break
    }
    // A child stopped by a signal has no exit code; the shell's convention is
    // 128 and the signal number, which is what the tool itself exits with.
    const code = outcome.code ?? 128 + (constants.signals[outcome.signal] ?? 0)
    if (code !== 0) {
      complain(
        'error claude plugin eval ' +
          (outcome.signal === null
            ? `exited ${code}${EXIT_MEANING[code] ? `: ${EXIT_MEANING[code]}` : ''}`
            : `was stopped by ${outcome.signal}`),
      )
    }
    if (status === 0) status = code

    // Read even after a failure: a partial run still holds what finished.
    let part
    try {
      part = JSON.parse(readFileSync(partFile, 'utf8'))
    } catch (error) {
      complain(
        'error no summary: ' +
          (error.code === 'ENOENT' ? `${partFile} was not written` : error.message),
      )
      if (documents.length === 0) return status === 0 ? 1 : status
      notStarted = `invocation ${at + 1} left no result`
      break
    }
    documents.push(part)
    spent += part.costUsd ?? 0
    const why = at + 1 < groups.length
      ? stopAfter(part, code, remainderOf(options.maxCostUsd, spent))
      : null
    if (why !== null) {
      notStarted = `invocation ${at + 2} was not started: ${why}`
      complain(`error ${notStarted}`)
      break
    }
  }

  let summary
  let document
  let traces
  try {
    document = documents.length === 1 && notStarted === null
      ? documents[0]
      : mergeDocuments(documents, cases.map(({ item }) => item.name), notStarted)
    if (document !== documents[0]) {
      writeFileSync(resultFile, `${JSON.stringify(document, null, 2)}\n`)
    }
    traces = keepTraces(document, outDir, { keep: options.keep })
    summary = summariseRun(document, planOf(cases))
  } catch (error) {
    complain(`error no summary: ${error.message}`)
    return status === 0 ? 1 : status
  }
  for (const line of describeRun(summary)) say(line)
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
      ...(summary.scenarios ?? {}),
      families: summary.families,
      measured: summary.measured,
      costUsd: summary.costUsd,
      durationSeconds: summary.durationSeconds,
      partial: summary.partial,
      partialReason: summary.partialReason,
      skillsLoaded: traces.skillsLoaded,
      skillFilesRead: traces.skillFilesRead,
    }, null, 2)}\n`,
  )
  say()
  say(`summary ${join(outDir, 'summary.json')}`)
  say(describeTraces(traces, outDir))
  if (summary.measured) {
    say('A difference smaller than the spread between repeated runs is not a')
    say('difference. Read the answers behind a number before acting on it: the')
    say('result file keeps each one, in the evidence of the substance grader.')
  } else {
    const parts = [
      ...(summary.scenarios !== null && !summary.scenarios.measured ? ['scenarios'] : []),
      ...Object.entries(summary.families)
        .filter(([, family]) => !family.measured)
        .map(([name]) => name),
    ]
    complain(`error nothing was measured for ${parts.join(', ')}: no run with the plugin gave a verdict`)
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
  const fileGrader = two.graders.find((grader) => grader.name === REACHED_FILE)
  check(
    'a scenario with expected skills also gets the Read grader beside it',
    fileGrader?.type === 'tool_used' && fileGrader.tool === 'Read' &&
      two.graders.filter((grader) => grader.name === REACHED_FILE).length === 1,
  )
  check(
    'the Read grader is an indicator, as the tool makes a Skill grader one',
    fileGrader?.arm === 'with-only',
  )
  const filePattern = new RegExp(
    caseOf(fake({ expected: ['functional-a'] }), null).graders
      .find((grader) => grader.name === REACHED_FILE).input_match)
  const readOf = (path) => JSON.stringify({ file_path: path })
  check(
    'the file pattern matches an expected SKILL.md and nothing near it',
    filePattern.test(readOf('/x/functional-a/SKILL.md')) &&
      filePattern.test(readOf('/x/skills/functional-a/SKILL.md')) &&
      !filePattern.test(readOf('/x/functional-ab/SKILL.md')) &&
      !filePattern.test(readOf('/x/xfunctional-a/SKILL.md')) &&
      !filePattern.test(readOf('/x/functional-a/references/y.md')) &&
      !filePattern.test(JSON.stringify({ skill: 'functional-a' })),
  )
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
    graderNames(two).join() ===
      `${REACHED},${REACHED_FILE},${LOADED},${SUBSTANCE}`)

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
    'a question case carries the not-in-workspace sentence, then a system file',
    NOT_IN_WORKSPACE.startsWith('The code the user describes is not in this') &&
      caseOf(fake(), null).execution.append_system_prompt === NOT_IN_WORKSPACE &&
      caseOf(fake(), 'Be brief.').execution.append_system_prompt ===
        `${NOT_IN_WORKSPACE}\n\nBe brief.`,
  )
  check('generating from an empty list of cases throws',
    throws(() => buildCases([], [], NO_OPTIONS), /nothing would be measured/))
  check('a tag no case carries throws',
    throws(() => buildCases([fake()], [], { ...NO_OPTIONS, tag: 'smoke' }), /no case carries/))
  check('naming a scenario that does not exist throws',
    throws(() => choose([fake()], [], new Set(['99'])), /no scenario numbered or task case named 99/))

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
      !defaults.includes('--ablation'),
    defaults.join(' '),
  )
  check(
    'the traces are always kept, whether or not --keep is given',
    defaults.includes('--keep-temp'),
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
  const trace = [
    '{"type":"system","subtype":"init"}',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1",' +
      '"name":"Skill","input":{"skill":"functional-design-skills:functional-a"}}]}}',
    'not json at all',
    '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t2",' +
      '"name":"Read","input":{"skill":"functional-nope"}}]}}',
    '',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"x"},' +
      '{"type":"tool_use","id":"t3","name":"Skill","input":{"skill":"functional-b"}}]}}',
  ]
  check(
    'a trace is read for the skills it loaded, in order, prefix stripped',
    JSON.stringify(skillsInTrace(trace.join('\r\n'))) ===
      '["functional-a","functional-b"]' &&
      skillsInTrace(trace.join('\n')).length === 2 &&
      skillsInTrace('').length === 0,
    JSON.stringify(skillsInTrace(trace.join('\r\n'))),
  )
  const reads = [
    '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"r1",' +
      '"name":"Read","input":{"file_path":"/p/skills/functional-c/SKILL.md"}},' +
      '{"type":"tool_use","id":"r2","name":"Read","input":{"file_path":' +
      '"/p/skills/functional-c/references/y.md"}},{"type":"tool_use",' +
      '"id":"r3","name":"Read","input":{"file_path":"C:\\\\p\\\\functional-d\\\\SKILL.md"}}]}}',
  ]
  check(
    'a trace is read for the skill files opened with Read, in order',
    JSON.stringify(skillUseInTrace([...trace, ...reads].join('\n')).files) ===
      '["functional-c","functional-d"]' &&
      skillUseInTrace(trace.join('\n')).files.length === 0,
    JSON.stringify(skillUseInTrace([...trace, ...reads].join('\n'))),
  )
  const temp = ['/private/tmp', '/private/var/folders/x/T']
  check(
    'a scaffold in the temporary directory may be removed, nothing else',
    isScaffold('/private/tmp/e-VXo0bh', temp) &&
      isScaffold('/private/var/folders/x/T/e-a1', temp) &&
      !isScaffold(join(RESULTS, 'e-VXo0bh'), temp) &&
      !isScaffold('/private/tmp/e-', temp) &&
      !isScaffold('/private/tmp/e-ab_c', temp) &&
      !isScaffold('/private/tmp/notes', temp) &&
      !isScaffold('/private/tmp/deeper/e-VXo0bh', temp) &&
      !isScaffold('/Users/someone/e-VXo0bh', temp),
  )
  {
    // The whole step on real directories: one scaffold in the temporary
    // directory, sealed as the tool leaves it, and one named alike elsewhere.
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'fds-traces-')))
    const scaffold = (parent, name) => {
      const dir = join(parent, name)
      mkdirSync(join(dir, 'out'), { recursive: true })
      mkdirSync(join(dir, 'sealed'))
      writeFileSync(join(dir, 'sealed', 'x'), 'x')
      writeFileSync(join(dir, 'out', 'trace.jsonl'), `${trace.join('\n')}\n`)
      return dir
    }
    const seal = (dir) => {
      chmodSync(join(dir, 'sealed'), 0)
      chmodSync(dir, 0o500)
    }
    const inside = scaffold(base, 'e-Selftest1')
    const outside = scaffold(join(base, 'elsewhere'), 'e-Selftest2')
    const traceless = scaffold(base, 'e-Selftest4')
    rmSync(join(traceless, 'out', 'trace.jsonl'))
    seal(inside)
    const run = (dir) => ({ tracePath: join(dir, 'out', 'trace.jsonl') })
    const document = {
      cases: [{
        name: 'c1',
        arms: {
          with: [
            run(inside), run(outside), { tracePath: join(base, 'no') }, run(traceless),
          ],
        },
      }],
    }
    const result = keepTraces(document, join(base, 'results'), {
      keep: false, tempRoots: [base],
    })
    const copy = join(base, 'results', 'traces', 'c1', 'with-1.jsonl')
    check(
      'a trace is copied out, read, and its scaffold removed',
      existsSync(copy) && !existsSync(inside) &&
        JSON.stringify(result.skillsLoaded.c1.with[0]) ===
          '["functional-a","functional-b"]' &&
        JSON.stringify(result.skillFilesRead.c1.with[0]) === '[]' &&
        result.skillFilesRead.c1.with[2] === null,
      JSON.stringify(result),
    )
    check(
      'a scaffold outside the temporary directory is left alone, a missing trace is null',
      existsSync(outside) && result.skillsLoaded.c1.with[2] === null &&
        result.kept === 2 && result.total === 4,
      JSON.stringify(result),
    )
    check(
      'a scaffold whose run left no trace is removed all the same',
      !existsSync(traceless) && result.skillsLoaded.c1.with[3] === null,
      JSON.stringify(result),
    )
    const again = scaffold(base, 'e-Selftest3')
    keepTraces({ cases: [{ name: 'c2', arms: { with: [run(again)] } }] },
      join(base, 'results'), { keep: true, tempRoots: [base] })
    check('--keep leaves the scaffold in place', existsSync(again))
    makeWritable(base)
    rmSync(base, { recursive: true, force: true })
  }
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
  const byFile = summarise({ ...document, cases: [row('q04-d',
    [run({ [REACHED]: false, [REACHED_FILE]: true, [LOADED]: false, [SUBSTANCE]: true }),
      run({ [REACHED]: true, [REACHED_FILE]: true, [LOADED]: true, [SUBSTANCE]: true }),
      run({ [REACHED]: false, [REACHED_FILE]: false, [LOADED]: false, [SUBSTANCE]: true })])] })
  check(
    'a run reaches the skill by either grader, and is counted once',
    byFile.reachedExpectedSkill.passed === 2 &&
      byFile.reachedExpectedSkill.total === 3 &&
      byFile.expectedSkillNeverReached.length === 0,
    JSON.stringify(byFile.reachedExpectedSkill),
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
  // The task cases: one file each, read by pack.mjs, copied as they are.
  const TASK_YAML = [
    'name: t99-sample',
    'tags: [task, smoke]',
    'execution:',
    '  prompt: Do a thing.',
    'graders:',
    '  - name: loaded-any-skill',
    '    type: tool_used',
    '    tool: Skill',
    '  - name: made-the-file',
    '    type: file_exists',
    '    path: a.txt',
    '  - name: reads-well',
    '    type: llm',
    '    criteria: Is it good.',
    '',
  ].join('\n')
  const readTask = (text, file = 't99-sample.yaml') => parseTaskCase(file, text)
  const taskSample = readTask(TASK_YAML)
  check(
    'a task case is read as its name, its one family, its tags and its document',
    taskSample.name === 't99-sample' && taskSample.family === 'task' &&
      taskSample.tags.join() === 'task,smoke' && taskSample.document.graders.length === 3,
    JSON.stringify(taskSample),
  )
  check(
    'a file whose name is not the case name throws',
    throws(() => readTask(TASK_YAML, 't98-other.yaml'), /t99-sample.*t98-other/),
  )
  check(
    'a case with two family tags throws',
    throws(() => readTask(TASK_YAML.replace('[task, smoke]', '[task, restraint]')),
      /2 family tag/),
  )
  check(
    'a case with no family tag throws',
    throws(() => readTask(TASK_YAML.replace('[task, smoke]', '[smoke]')),
      /0 family tag/),
  )
  check(
    'a case with no prompt throws',
    throws(() => readTask(TASK_YAML.replace('  prompt: Do a thing.\n', '  max_turns: 3\n')),
      /no execution.prompt/),
  )
  check(
    'a case with no grader throws',
    throws(() => readTask(TASK_YAML.replace(/graders:[\s\S]*$/, 'graders: []\n')),
      /no grader/),
  )
  const emptyDir = mkdtempSync(join(tmpdir(), 'fds-eval-empty-'))
  const emptyThrows = throws(() => taskCases(emptyDir), /no case file/)
  rmSync(emptyDir, { recursive: true, force: true })
  check('an empty directory of task cases throws', emptyThrows)

  const realTasks = taskCases()
  check(
    'every real task case is read, each with one family, and all three families are used',
    realTasks.length > 0 &&
      new Set(realTasks.map((task) => task.family)).size === TASK_FAMILIES.length,
  )
  check(
    'every real task case survives a round trip through YAML as it is written',
    realTasks.every((task) => {
      const item = taskCaseOf(task, null)
      return JSON.stringify(parseYaml(stringify(item, { lineWidth: 0 }))) ===
        JSON.stringify(item)
    }),
  )
  check(
    'a task case is the source document, and a system file adds to its own prompt',
    JSON.stringify(taskCaseOf(taskSample, null)) === JSON.stringify(
      { ...taskSample.document, context: { scaffold_script: 'fixture.sh' } }) &&
      taskCaseOf(taskSample, 'Be brief.').execution.append_system_prompt === 'Be brief.' &&
      taskCaseOf(
        { document: { ...taskSample.document, execution: {
          ...taskSample.document.execution, append_system_prompt: 'Own.' } } },
        'Be brief.',
      ).execution.append_system_prompt === 'Own.\n\nBe brief.',
  )
  check(
    'a task case does not carry the not-in-workspace sentence',
    !JSON.stringify(taskCaseOf(taskSample, null)).includes(NOT_IN_WORKSPACE) &&
      !JSON.stringify(taskCaseOf(taskSample, 'Be brief.'))
        .includes(NOT_IN_WORKSPACE),
  )
  check(
    'a case whose graders are all indicators throws',
    throws(() => buildCases([], [{ ...taskSample, document: { ...taskSample.document,
      graders: [taskSample.document.graders[0]] } }], NO_OPTIONS), /no run could fail/),
  )
  const mixed = buildCases([fake({ id: '1' })], [taskSample], NO_OPTIONS)
  check(
    'each case is paired with the fixture its scaffold script copies',
    mixed[0].fixture === FIXTURE && mixed[1].fixture === FIXTURE_TASKS &&
      fixtureScript('fixture-tasks').includes('cp -R "$here/fixture-tasks/." .') &&
      fixtureScript('fixture').includes('cp -R "$here/fixture/." .'),
  )
  const writing = { ...taskSample, document: { ...taskSample.document, execution: {
    ...taskSample.document.execution, allowed_tools: ['Read', 'Skill', 'Write', 'Edit'] } } }
  const granted = childArgs(parseArgs(['--tag', 'smoke']), {
    root: '/r',
    resultFile: '/o/result.json',
    outDir: '/o',
    grants: grantsFor(buildCases([fake({ id: '1' })], [writing], NO_OPTIONS)),
  })
  check(
    'a run whose cases write files is granted Write and Edit, before the tag',
    granted.slice(granted.indexOf('--allow-tools') + 1, granted.indexOf('--tag'))
      .join() === 'Write,Edit' && granted.indexOf('--tag') === granted.length - 2,
    granted.join(' '),
  )
  check(
    'a run of cases that only read is granted nothing',
    grantsFor(buildCases([fake({ id: '1' })], [taskSample], NO_OPTIONS)).length === 0 &&
      !defaults.includes('--allow-tools'),
  )
  check(
    'a case that asks for a shell is refused',
    throws(() => grantsFor(buildCases([], [{ ...writing, document: { ...writing.document,
      execution: { ...writing.document.execution, allowed_tools: ['Bash'] } } }],
    NO_OPTIONS)), /asks for Bash/),
  )
  // One grant per invocation: the question cases must not receive what a task
  // case asks for.
  const askMix = buildCases([fake({ id: '1' })], [writing], NO_OPTIONS)
  const split = groupByGrant(askMix)
  const argsOf = (group, options = parseArgs([])) => childArgs(options, {
    root: group.root ?? '/r', resultFile: '/o/result.json', outDir: '/o',
    grants: group.grants,
  })
  check(
    'a selection of both kinds is two invocations, the question cases first',
    split.length === 2 && split[0].entries.length === 1 &&
      split[0].entries[0].item.name === askMix[0].item.name &&
      split[1].entries[0].item.name === askMix[1].item.name &&
      !argsOf(split[0]).includes('--allow-tools') &&
      argsOf(split[1]).slice(argsOf(split[1]).indexOf('--allow-tools') + 1)
        .join() === 'Write,Edit',
    JSON.stringify(split.map((group) => group.grants)),
  )
  check(
    'the order does not depend on how the cases were selected',
    groupByGrant([askMix[1], askMix[0]])[0].grants.length === 0,
  )
  check(
    'a selection of one kind is one invocation',
    groupByGrant(buildCases([fake({ id: '1' }), fake({ id: '2' })], [], NO_OPTIONS))
      .length === 1 &&
      groupByGrant(buildCases([], [writing], NO_OPTIONS)).length === 1 &&
      groupByGrant(buildCases([], [writing], NO_OPTIONS))[0].grants.join() ===
        'Write,Edit',
  )
  check(
    'a case that asks for a shell is refused before any invocation is made',
    throws(() => groupByGrant(buildCases([], [{ ...writing, document: {
      ...writing.document, execution: { ...writing.document.execution,
        allowed_tools: ['Bash'] } } }], NO_OPTIONS)), /asks for Bash/),
  )
  const ceilingOf = (spent) => argsOf(split[1], {
    ...parseArgs(['--max-cost-usd', '10']),
    maxCostUsd: remainderOf(10, spent),
  })
  const ceilingArg = (args) => args[args.indexOf('--max-cost-usd') + 1]
  check(
    'the second invocation gets the ceiling less what the first spent',
    ceilingArg(ceilingOf(3.25)) === '6.75' && ceilingArg(ceilingOf(0.1 + 0.2)) === '9.7' &&
      remainderOf(10, 12) === 0,
    ceilingArg(ceilingOf(3.25)),
  )
  check(
    'a partial first invocation stops the second, and so does a spent ceiling',
    String(stopAfter({ partial: true, partialReason: 'cost_ceiling' }, 0, 5))
      .includes('cost_ceiling') &&
      stopAfter({ partial: true, partialReason: 'x' }, 2, 5) !== null &&
      String(stopAfter({ partial: false }, 1, 5)).includes('exited 1') &&
      String(stopAfter({ partial: false }, 0, 0)).includes('ceiling') &&
      stopAfter({ partial: false }, 0, 4.5) === null,
  )
  const partOne = {
    ...document, costUsd: 1.5, durationSeconds: 10, partial: false,
    cases: [row('q02-b', [], []), row('q01-a', [], [])],
  }
  const partTwo = {
    ...document, costUsd: 2.25, durationSeconds: 7, partial: true,
    partialReason: 'cost_ceiling', cases: [row('t01-c', [], [])],
  }
  const merged = mergeDocuments([partTwo, partOne], ['q01-a', 'q02-b', 't01-c'])
  check(
    'merged results sum cost and duration and keep the order the cases were made in',
    merged.costUsd === 3.75 && merged.durationSeconds === 17 &&
      merged.cases.map((item) => item.name).join() === 'q01-a,q02-b,t01-c' &&
      merged.schemaVersion === 1,
    JSON.stringify(merged.cases.map((item) => item.name)),
  )
  check(
    'a merged result is partial when either was, with the partial one\'s reason',
    merged.partial === true && merged.partialReason === 'cost_ceiling' &&
      mergeDocuments([partOne, partTwo], []).partial === true &&
      mergeDocuments([partOne, { ...partOne, cases: [] }], []).partial === false &&
      mergeDocuments([partOne], [], 'invocation 2 was not started').partialReason ===
        'invocation 2 was not started',
  )
  check(
    'a merged result of different schema versions throws, as one document does',
    throws(() => mergeDocuments([partOne, { ...partTwo, schemaVersion: 2 }], []),
      /disagree on schemaVersion/) &&
      throws(() => summarise({ ...merged, schemaVersion: 2 }), /schemaVersion 2/),
  )
  check(
    'a tag keeps the cases that carry it, from both kinds',
    buildCases([fake({ id: '1' })], [taskSample], { ...NO_OPTIONS, tag: 'smoke' }).length === 2 &&
      buildCases([fake({ id: '1' })], [taskSample], { ...NO_OPTIONS, tag: 'question' }).length === 1 &&
      buildCases([fake({ id: '1' })], [taskSample], { ...NO_OPTIONS, tag: 'task' }).length === 1,
  )
  const picked = choose([fake({ id: '1' })], [taskSample], new Set(['1', 't99-sample']))
  check(
    '--only takes scenario numbers and task case names in one list',
    picked.scenarioList.length === 1 && picked.taskList.length === 1 &&
      choose([fake({ id: '1' })], [taskSample], new Set(['t99-sample'])).scenarioList.length === 0 &&
      throws(() => choose([fake({ id: '1' })], [taskSample], new Set(['t98-x'])), /t98-x/),
  )
  check(
    'an empty selection builds nothing and throws',
    throws(() => {
      const none = choose([fake({ id: '1' })], [taskSample], new Set())
      buildCases(none.scenarioList, none.taskList, NO_OPTIONS)
    }, /nothing would be measured/),
  )

  // The shapes of a task case's result. A case has a scoring grader of each
  // kind and one indicator; the indicator fires in some runs and decides none.
  const planned = (family, ...graders) => ({ family, graders })
  const FILE = { name: 'made-the-file', type: 'file_exists' }
  const JUDGE = { name: 'reads-well', type: 'llm' }
  const FIRED = { name: 'loaded-any-skill', type: 'tool_used' }
  const plan = new Map([
    ['t01-a', planned('task', FIRED, FILE, JUDGE)],
    ['t02-b', planned('task', FIRED, FILE, JUDGE)],
    ['r01-c', planned('restraint', FIRED, FILE)],
  ])
  const taskRun = (verdict, extra = {}) => ({
    score: 0, passed: false, turns: 1, costUsd: 0.01, judgeCostUsd: 0,
    error: null, skippedPaidGraders: false,
    graders: Object.entries(verdict).map(([name, passed]) => ({
      name, passed, weight: 1, explanation: '', withOnly: false, scored: false,
      ...(name === JUDGE.name ? { judgeVotes: [passed, passed, passed], evidence: 'x' } : {}),
    })),
    ...extra,
  })
  const taskDocument = {
    schemaVersion: 1, costUsd: 0.5, durationSeconds: 12, partial: false,
    cases: [
      row('t01-a',
        [taskRun({ [FIRED.name]: true, [FILE.name]: true, [JUDGE.name]: true }),
          taskRun({ [FIRED.name]: true, [FILE.name]: true, [JUDGE.name]: false })],
        [taskRun({ [FIRED.name]: false, [FILE.name]: true, [JUDGE.name]: false }),
          taskRun({ [FIRED.name]: false, [FILE.name]: false, [JUDGE.name]: false })]),
      row('t02-b',
        [taskRun({ [FIRED.name]: false, [FILE.name]: true, [JUDGE.name]: true })],
        [taskRun({ [FIRED.name]: false, [FILE.name]: true, [JUDGE.name]: true })]),
      row('r01-c',
        [taskRun({ [FIRED.name]: true, [FILE.name]: false })],
        [taskRun({ [FIRED.name]: false, [FILE.name]: true })]),
    ],
  }
  const result = summariseRun(taskDocument, plan)
  const task = result.families.task
  check(
    'a task case passes in a run only when every grader but the indicators passes',
    task.pass.with.passed === 2 && task.pass.with.total === 3 &&
      task.pass.without.passed === 1 && task.pass.without.total === 3,
    JSON.stringify(task.pass),
  )
  check(
    'a case that passes in one arm and fails in the other is told apart',
    task.worseWithPlugin.length === 0 &&
      Math.abs(task.pass.difference - (2 / 3 - 1 / 3)) < 1e-9 &&
      result.families.restraint.worseWithPlugin.length === 1 &&
      result.families.restraint.worseWithPlugin[0].case === 'r01-c',
    JSON.stringify(result.families.restraint.worseWithPlugin),
  )
  check(
    'an indicator is counted per arm and changes no pass',
    task.indicators[FIRED.name].with.passed === 2 &&
      task.indicators[FIRED.name].with.total === 3 &&
      task.indicators[FIRED.name].without.passed === 0 &&
      task.pass.with.passed === 2,
    JSON.stringify(task.indicators),
  )
  check(
    'a grader that failed is named per case with its count in each arm',
    task.failedGraders.length === 2 &&
      JSON.stringify(task.failedGraders[0]) === JSON.stringify({
        case: 't01-a', grader: FILE.name,
        with: { failed: 0, total: 2 }, without: { failed: 1, total: 2 },
      }) &&
      task.failedGraders[1].grader === JUDGE.name &&
      task.failedGraders[1].with.failed === 1 && task.failedGraders[1].without.failed === 2,
    JSON.stringify(task.failedGraders),
  )
  check(
    'the families are summed apart',
    result.families.restraint.cases === 1 && task.cases === 2 &&
      result.scenarios === null && result.measured === true,
  )
  const taskGaps = summariseRun({
    ...taskDocument,
    cases: [
      row('t01-a',
        [taskRun({ [FIRED.name]: true, [FILE.name]: true, [JUDGE.name]: true }),
          taskRun({ [FIRED.name]: true, [FILE.name]: false, [JUDGE.name]: false },
            { error: 'timed out' }),
          taskRun({ [FIRED.name]: true, [FILE.name]: true },
            { graders: [
              { name: FIRED.name, passed: true },
              { name: FILE.name, passed: true },
              noVerdict('grader threw: judge call failed: limit')].map((g) =>
              (g.name === SUBSTANCE ? { ...g, name: JUDGE.name } : g)) })],
        [taskRun({ [FIRED.name]: false, [FILE.name]: true, [JUDGE.name]: true })]),
    ],
  }, plan).families.task
  check(
    'an errored run, and one whose judge threw, are counted for neither arm',
    taskGaps.pass.with.total === 1 && taskGaps.pass.with.passed === 1 &&
      taskGaps.errored.with === 1 && taskGaps.ungraded.with === 1 &&
      taskGaps.pass.without.total === 1 &&
      taskGaps.failedGraders.length === 0 &&
      taskGaps.errors[0].message === 'timed out' &&
      taskGaps.notGraded[0].message.startsWith('reads-well: grader threw'),
    JSON.stringify(taskGaps),
  )
  check(
    'those runs are named in the summary',
    describeRun(summariseRun({ ...taskDocument, cases: [
      row('t01-a', [taskRun({}, { error: 'timed out' }),
        taskRun({ [FIRED.name]: true, [FILE.name]: true, [JUDGE.name]: true })], null)] }, plan))
      .some((line) => line.includes('1 x timed out')),
  )
  const unmeasured = summariseRun({
    ...taskDocument,
    cases: [row('t01-a', [taskRun({}, { error: 'limit' })], [taskRun({
      [FIRED.name]: false, [FILE.name]: true, [JUDGE.name]: true })])],
  }, plan)
  check(
    'a family in which the plugin arm gave no verdict is not measured',
    unmeasured.measured === false && unmeasured.families.task.pass.with.rate === null &&
      unmeasured.families.task.pass.without.total === 1,
  )
  const both = summariseRun({
    ...taskDocument,
    cases: [...document.cases, ...taskDocument.cases],
  }, plan)
  check(
    'scenarios and families in one result are summed apart',
    both.scenarios.cases === 3 && both.families.task.cases === 2 &&
      both.scenarios.substance.with.total === 6 && both.measured === true,
  )
  check(
    'a case in the result that was not generated throws',
    throws(() => summariseRun({ ...taskDocument, cases: [row('x-d', [], [])] }, plan),
      /x-d/),
  )
  check(
    'the summary of a family names its indicators and its failed graders',
    describeRun(result).some((line) => line.includes('loaded-any-skill  with 2/3')) &&
      describeRun(result).some((line) => line.includes('t01-a  reads-well  with 1/2, without 2/2')),
  )
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
