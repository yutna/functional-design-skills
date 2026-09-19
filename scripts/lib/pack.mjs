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
import { readMarkdown } from './markdown.mjs'

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
export const SKILLS_DIR = join(ROOT, 'plugin', 'skills')
export const EVALS_DIR = join(ROOT, 'evals')

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

export function referenceFiles (id) {
  const dir = join(SKILLS_DIR, id, 'references')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((file) => file.endsWith('.md')).sort()
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
export function scenarios () {
  const text = readRepoFile(join('evals', 'scenarios.md'))
  const found = []
  for (const block of text.split('\n## ').slice(1)) {
    const flat = block.replace(/\s+/g, ' ')
    const number = /^(\d+)\./.exec(flat)
    if (number === null) continue
    const reach = /Should reach ([^.]*)/.exec(flat)
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
    })
  }
  if (found.length === 0) {
    throw new Error('evals/scenarios.md: no numbered scenarios found')
  }
  return found
}
