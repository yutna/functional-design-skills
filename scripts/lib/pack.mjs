// What a skill is, and what the evals hold, in one place each.
//
// Two of this pack's own rules, applied to its own tooling.
//
// functional-splitting-and-joining-code: the same fact written down twice
// drifts. Five scripts each listed the skills directory with their own
// filter, and two scripts each counted the routing cases with their own
// regex -- one tolerating CRLF and one not, so on Windows they disagreed
// about how many cases exist and the documentation was reported wrong.
//
// functional-defining-errors-out-of-existence: every caller used to have
// to notice that it had read nothing. One did not, and reported
// "0 core rule(s) labelled across 0 skill(s)" as a pass. Reading an empty
// pack now throws here, so no caller can forget, and the check for it
// lives once instead of six times.

import { readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { readMarkdown, readSource } from './markdown.mjs'

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
export const SKILLS_DIR = join(ROOT, 'plugin', 'skills')
export const EVALS_DIR = join(ROOT, 'evals')
export const TASKS_DIR = join(EVALS_DIR, 'tasks')

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/

export function readRepoFile (relative) {
  return readMarkdown(join(ROOT, relative))
}

// Sorted, because two of the five listings were not, and a report whose
// order changes between runs is a report nobody diffs.
export function skillIds () {
  const ids = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  if (ids.length === 0) {
    throw new Error(
      `${SKILLS_DIR} holds no skills. A check that reads nothing has not ` +
        'passed; it has stopped working.',
    )
  }
  return ids
}

// A skill as the rest of the tooling wants it: the frontmatter already
// parsed, the body already separated. `frontmatter` is null when the block
// is missing or will not parse, which is a thing validate-skills.mjs
// reports rather than an accident anything else has to handle.
export function readSkill (id) {
  const dir = join(SKILLS_DIR, id)
  const raw = readMarkdown(join(dir, 'SKILL.md'))
  const match = FRONTMATTER.exec(raw)
  if (match === null) {
    return { id, dir, raw, frontmatter: null, body: raw, malformed: 'missing' }
  }
  let frontmatter = null
  let malformed = null
  try {
    frontmatter = parseYaml(match[1])
    if (frontmatter === null || typeof frontmatter !== 'object') {
      malformed = 'not a mapping'
      frontmatter = null
    }
  } catch (error) {
    malformed = error.message
  }
  return {
    id,
    dir,
    raw,
    frontmatter,
    body: raw.slice(match[0].length),
    malformed,
  }
}

export function everySkill () {
  return skillIds().map(readSkill)
}

// Since 3.0.0 every skill is named functional-something, so the name no
// longer says whether a skill is a core rule or a language pack. The index
// already lists the packs, and readers maintain that list, so it is the
// authority rather than a second list in a script.
export const INDEX_SKILL = 'functional-design'

// Read here rather than in either caller, for the reason at the top of this
// file: validate-counts.mjs owned this parse, and when validate-skills.mjs
// came to need the same list the choice was to copy it or to move it. The
// same fact written down twice drifts.
export function languagePackIds () {
  const body = readRepoFile(join('plugin', 'skills', INDEX_SKILL, 'SKILL.md'))
  const section = /^## Language packs\n([\s\S]*?)^## /m.exec(body)
  if (section === null) {
    throw new Error(
      `plugin/skills/${INDEX_SKILL}/SKILL.md: no "## Language packs" ` +
        'section, so nothing can tell a pack from a core skill',
    )
  }
  const ids = [...section[1].matchAll(/^- \[([a-z0-9-]+)\]/gm)].map((m) => m[1])
  if (ids.length === 0) {
    throw new Error(
      `plugin/skills/${INDEX_SKILL}/SKILL.md: the "## Language packs" ` +
        'section lists none, so every pack check below would read nothing ' +
        'and report a clean run.',
    )
  }
  return ids
}

// The words a core rule can open with, read from where the index defines
// them for the reader. From 3.0.0 to 3.2.0 the list lived in
// validate-rules.mjs and the definitions in the README, which does not
// ship, so every skill carried labels that nothing an agent loads
// explained. Reading the list from the index makes that unrepresentable: a
// label with no definition there is a label no rule may use.
export const LABELS_HEADING = 'How strictly a rule is meant'

export function strictnessLabels () {
  const where = `plugin/skills/${INDEX_SKILL}/SKILL.md`
  const body = readRepoFile(join('plugin', 'skills', INDEX_SKILL, 'SKILL.md'))
  const section = new RegExp(`^## ${LABELS_HEADING}\\n([\\s\\S]*?)^## `, 'm')
    .exec(body)
  if (section === null) {
    throw new Error(
      `${where}: no "## ${LABELS_HEADING}" section, so the labels on every ` +
        'core rule ship with no definition',
    )
  }
  const labels = [...section[1].matchAll(/^- \*\*([A-Za-z]+)\.\*\*/gm)]
    .map((m) => m[1])
  if (labels.length === 0) {
    throw new Error(
      `${where}: the "## ${LABELS_HEADING}" section defines no label, so ` +
        'every core rule would be reported as mislabelled, or none would.',
    )
  }
  return labels
}

export function referenceFiles (id) {
  const dir = join(SKILLS_DIR, id, 'references')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((file) => file.endsWith('.md')).sort()
}

// Every file under a directory, at any depth, in the order a person would list
// them: each directory's entries sorted by name, subdirectories walked in
// place. Two listings that disagree about order print the same errors in a
// different sequence, and a report nobody can diff is a report nobody reads.
function filesUnder (dir) {
  const found = []
  const walk = (at) => {
    const entries = readdirSync(at, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const path = join(at, entry.name)
      if (entry.isDirectory()) walk(path)
      else found.push(path)
    }
  }
  walk(dir)
  return found
}

// Every Markdown file the skills ship, SKILL.md and references alike, at any
// depth. The parse check and the type check both read the examples in these,
// and a file one of them walked past is an example nobody checked. Reading
// nothing throws, for the reason at the top of this file.
export function skillMarkdownFiles () {
  const found = filesUnder(SKILLS_DIR).filter((path) => path.endsWith('.md'))
  if (found.length === 0) {
    throw new Error(
      `${SKILLS_DIR} holds no Markdown. A check that reads nothing has not ` +
        'passed; it has stopped working.',
    )
  }
  return found
}

// What the examples assume lives outside the plugin, so that none of it ships
// and none of it is a second copy of a skill's prose. A directory that is not
// there is a pack with no preludes yet, which the type check reports file by
// file; it is not an error in listing.
export const EXAMPLE_TYPES_DIR = join(ROOT, 'example-types')

export function exampleTypeFiles () {
  return existsSync(EXAMPLE_TYPES_DIR) ? filesUnder(EXAMPLE_TYPES_DIR) : []
}

// The routing cases, counted once. Both readers of this file used to have
// their own copy of this parse, and they did not agree.
export function routingCases () {
  const text = readRepoFile(join('evals', 'routing-cases.md'))
  const blocks = [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1])
  if (blocks.length === 0) {
    throw new Error(
      'evals/routing-cases.md: no fenced case block, so there are no cases ' +
        'to score. A zero here would read as a clean run.',
    )
  }
  if (blocks.length > 1) {
    throw new Error(
      `evals/routing-cases.md has ${blocks.length} \`\`\`text blocks and only ` +
        'the first was ever read. Keep every case in one block.',
    )
  }
  const cases = []
  for (const line of blocks[0].split('\n').map((l) => l.trim())) {
    if (!line || line.startsWith('#')) continue
    const at = line.lastIndexOf(' -> ')
    if (at === -1) {
      throw new Error(`evals/routing-cases.md: case line missing ' -> ': ${line}`)
    }
    cases.push({ symptom: line.slice(0, at).trim(), expected: line.slice(at + 4).trim() })
  }
  if (cases.length === 0) {
    throw new Error('evals/routing-cases.md: the case block is empty')
  }
  return cases
}

// A scenario is a numbered heading, a block quote holding the prompt as
// someone would say it, and prose that usually ends "Should reach
// `skill-name`". The prose wraps at eighty characters, so the sentence is
// matched against whitespace-flattened text: reading the raw block missed
// six of them, whose "Should" and "reach" had landed on different lines.
//
// The rest of that prose is what a correct answer has to meet, and it is
// kept as `criteria`. Only the "Should reach" sentence is left out of it:
// it is about the route, not the answer, and a judge handed it would grade
// which skill loaded instead of what was said.
function criteriaOf (block) {
  return block
    .split('\n')
    .slice(1)
    .filter((line) => !line.startsWith('>'))
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph
      .replace(/\s+/g, ' ')
      .replace(/Should reach [^.]*\./g, '')
      .trim())
    .filter((paragraph) => paragraph !== '')
    .join('\n\n')
}

// Takes the text rather than reading the file so that the throw below can be
// shown firing on a scenario made to trigger it.
export function parseScenarios (text) {
  const found = []
  for (const block of text.split('\n## ').slice(1)) {
    const flat = block.replace(/\s+/g, ' ')
    const number = /^(\d+)\./.exec(flat)
    if (number === null) continue
    const reach = /Should reach ([^.]*)/.exec(flat)
    const criteria = criteriaOf(block)
    if (criteria === '') {
      throw new Error(
        `evals/scenarios.md: scenario ${number[1]} has no prose after its ` +
          'block quote, so a case made from it would grade nothing',
      )
    }
    found.push({
      id: number[1],
      title: /^\d+\.\s+(.*?)\s+>/.exec(flat)?.[1] ?? '',
      prompt: block
        .split('\n')
        .filter((line) => line.startsWith('>'))
        .map((line) => line.replace(/^>\s?/, ''))
        .join('\n')
        .trim(),
      expected: reach
        ? [...reach[1].matchAll(/`([\w-]+)`/g)].map((m) => m[1])
        : [],
      criteria,
    })
  }
  if (found.length === 0) {
    throw new Error('evals/scenarios.md: no numbered scenarios found')
  }
  return found
}

export function scenarios () {
  return parseScenarios(readRepoFile(join('evals', 'scenarios.md')))
}

// A task case is work for an agent to do in a small project, graded on the
// files it leaves behind. Each is one YAML file in evals/tasks, written the
// way `claude plugin eval` reads a case, and the file's base name is the
// case's name. The family says what the pack is expected to do to the work:
// change it, leave it alone, or give way to the project's own convention.
export const TASK_FAMILIES = ['task', 'restraint', 'precedence']

// Takes the text rather than reading the file, for the reason parseScenarios
// does: the throws below can be shown firing on a case made to trigger them.
export function parseTaskCase (file, text) {
  const where = `evals/tasks/${file}`
  const document = parseYaml(text)
  if (document === null || typeof document !== 'object') {
    throw new Error(`${where}: not a mapping, so it holds no case`)
  }
  const name = file.replace(/\.yaml$/, '')
  if (document.name !== name) {
    throw new Error(
      `${where}: its name is "${document.name}", but the file's name is ` +
        `"${name}". The runner and the results know a case by one name.`,
    )
  }
  const tags = Array.isArray(document.tags) ? document.tags : []
  const families = tags.filter((tag) => TASK_FAMILIES.includes(tag))
  if (families.length !== 1) {
    throw new Error(
      `${where}: carries ${families.length} family tag(s) and needs exactly ` +
        `one of ${TASK_FAMILIES.join(', ')}, or its results cannot be ` +
        'summed under any family',
    )
  }
  const prompt = document.execution?.prompt
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error(`${where}: no execution.prompt, so the agent is asked nothing`)
  }
  if (!Array.isArray(document.graders) || document.graders.length === 0) {
    throw new Error(`${where}: no grader, so a run of it would measure nothing`)
  }
  return { name, family: families[0], tags, document }
}

// The directory is a parameter so the empty case can be shown throwing.
export function taskCases (dir = TASKS_DIR) {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
  if (files.length === 0) {
    throw new Error(
      'evals/tasks: no case file. A reader that returns nothing lets the ' +
        'runner report a clean run that measured nothing.',
    )
  }
  return files.map((file) =>
    parseTaskCase(file, readSource(join(dir, file))))
}
