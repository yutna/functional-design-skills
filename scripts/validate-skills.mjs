#!/usr/bin/env node
// Validates every plugin/skills/<name>/SKILL.md against the frontmatter Claude
// Code accepts, and checks that the version recorded in each skill matches the
// one in package.json.
//
// There is no application to test here, so this script and validate-prose.mjs
// are the whole safety net. Every check below exists because a specific defect
// got through without it; the comment beside each one says which.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
// The plugin lives in its own directory so that package.json and the lock file
// stay outside it. A lock file at a plugin's root makes the installer run npm
// on every user's machine; see CLAUDE.md.
const PLUGIN_DIR = join(ROOT, 'plugin')
const SKILLS_DIR = join(PLUGIN_DIR, 'skills')

// Every frontmatter key Claude Code documents. A key outside this set is
// either a typo or a feature this runtime does not have, and both are worth
// failing on rather than silently ignoring.
const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'when_to_use',
  'argument-hint',
  'arguments',
  'disable-model-invocation',
  'user-invocable',
  'allowed-tools',
  'disallowed-tools',
  'model',
  'effort',
  'context',
  'agent',
  'background',
  'hooks',
  'paths',
  'shell',
  'metadata',
  'license',
  'compatibility',
])

// Claude Code truncates description and when_to_use together at this length.
const DESCRIPTION_LIMIT = 1536
const COMPATIBILITY_LIMIT = 500
// Not a documented platform limit. This pack's own ceiling: a description is a
// routing table entry, and one that does not fit on two terminal lines has
// stopped being one.
const DESCRIPTION_HOUSE_LIMIT = 180
// Also this pack's own limit, not the platform's. A name longer than this is a
// sentence, and a sentence does not route.
const NAME_LIMIT = 64

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Claude Code reserves this exact directory name for claude.ai synced skills
// and skips anything using it.
const RESERVED_NAME = 'synced'
// Not a Claude Code rule, but the Agent Skills registry rejects these, so a
// name containing one could never be published there.
const RESERVED_SUBSTRINGS = ['anthropic', 'claude']
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

const errors = []
const warnings = []

function fail (skill, message) {
  errors.push(`${skill}: ${message}`)
}

function readJson (relative) {
  return JSON.parse(readFileSync(join(ROOT, relative), 'utf8'))
}

const EXPECTED_VERSION = readJson('package.json').version

function readSkillDirs () {
  let entries
  try {
    entries = readdirSync(SKILLS_DIR)
  } catch {
    errors.push('plugin/skills/: directory not found')
    return []
  }
  return entries
    .filter((entry) => !entry.startsWith('.'))
    .filter((entry) => statSync(join(SKILLS_DIR, entry)).isDirectory())
    .sort()
}

function validateName (id, frontmatter) {
  const { name } = frontmatter
  if (typeof name !== 'string' || name.length === 0) {
    fail(id, 'frontmatter "name" is missing or empty')
    return
  }
  if (name !== id) {
    fail(id, `frontmatter "name" is "${name}" but the directory is "${id}"`)
  }
  if (name.length > NAME_LIMIT) {
    fail(id, `"name" is ${name.length} characters, this pack's limit is ${NAME_LIMIT}`)
  }
  if (!NAME_PATTERN.test(name)) {
    fail(id, `"name" must be lowercase kebab-case, got "${name}"`)
  }
  if (name.toLowerCase() === RESERVED_NAME) {
    fail(id, `"name" must not be "${RESERVED_NAME}", which Claude Code reserves`)
  }
  for (const word of RESERVED_SUBSTRINGS) {
    if (name.includes(word)) {
      fail(id, `"name" must not contain the reserved word "${word}"`)
    }
  }
}

function validateDescription (id, frontmatter) {
  const { description, when_to_use: whenToUse } = frontmatter
  if (typeof description !== 'string' || description.trim().length === 0) {
    fail(id, 'frontmatter "description" is missing or empty')
    return
  }
  if (whenToUse !== undefined && typeof whenToUse !== 'string') {
    fail(id, 'frontmatter "when_to_use" must be a string')
    return
  }
  // The two are concatenated before Claude Code truncates them, so the pair is
  // what has to fit, not either one alone.
  const combined = description.length + (whenToUse?.length ?? 0)
  if (combined > DESCRIPTION_LIMIT) {
    fail(
      id,
      `"description" and "when_to_use" total ${combined} characters, ` +
        `the platform limit is ${DESCRIPTION_LIMIT}`,
    )
  }
  if (description.length > DESCRIPTION_HOUSE_LIMIT) {
    fail(
      id,
      `"description" is ${description.length} characters, this pack's ` +
        `limit is ${DESCRIPTION_HOUSE_LIMIT}`,
    )
  }
  if (/[<>]/.test(description)) {
    fail(id, '"description" must not contain angle brackets')
  }
  // A description states the situations that should trigger the skill, never
  // a summary of what it covers. Opening with the trigger is how that stays
  // true under editing.
  if (!description.startsWith('Use when ')) {
    fail(id, '"description" must open with "Use when " and state triggers only')
  }
  if (description.length < 80) {
    warnings.push(`${id}: "description" is short, triggers may be too vague`)
  }
}

function validateKeys (id, frontmatter) {
  for (const key of Object.keys(frontmatter)) {
    if (!ALLOWED_KEYS.has(key)) {
      fail(id, `frontmatter key "${key}" is not one Claude Code accepts`)
    }
  }
  if (frontmatter.license !== 'MIT') {
    fail(id, 'frontmatter "license" must be "MIT"')
  }
  // `argument-hint: [a, b]` is a YAML flow sequence, so an unquoted hint
  // silently becomes an array where a string is wanted.
  const hint = frontmatter['argument-hint']
  if (hint !== undefined && typeof hint !== 'string') {
    fail(id, '"argument-hint" must be a string; quote it if it uses brackets')
  }
  const { compatibility } = frontmatter
  if (compatibility !== undefined) {
    if (typeof compatibility !== 'string') {
      fail(id, 'frontmatter "compatibility" must be a string')
    } else if (compatibility.length > COMPATIBILITY_LIMIT) {
      fail(
        id,
        `"compatibility" is ${compatibility.length} characters, ` +
          `the limit is ${COMPATIBILITY_LIMIT}`,
      )
    }
  }
}

// The version is recorded in forty-three places: package.json, two manifests,
// and the metadata block of every skill. Nothing in the packaging tooling
// keeps them in step, so a release that updates forty-two of them ships a
// skill claiming to be the previous one.
function validateVersion (id, frontmatter) {
  const version = frontmatter.metadata?.version
  if (version === undefined) {
    fail(id, 'frontmatter "metadata.version" is missing')
    return
  }
  if (version !== EXPECTED_VERSION) {
    fail(
      id,
      `"metadata.version" is "${version}" but package.json is ` +
        `"${EXPECTED_VERSION}"`,
    )
  }
}

// Headings must be counted outside fenced code, or a `# comment` in an example
// reads as a second level-one heading.
function stripFences (body) {
  const kept = []
  let fence = null
  for (const line of body.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence === null && marker) {
      fence = marker[1]
      continue
    }
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    kept.push(line)
  }
  return kept.join('\n')
}

function validateBody (id, rawBody) {
  const body = stripFences(rawBody)
  const firstLine = body.split(/\r?\n/).find((line) => line.trim().length > 0)
  if (!firstLine || !firstLine.startsWith('# ')) {
    fail(id, 'body must open with a single level-one heading')
  }
  const headings = body.match(/^# .+$/gm) ?? []
  if (headings.length > 1) {
    fail(id, `body has ${headings.length} level-one headings, expected 1`)
  }
  const lineCount = body.split(/\r?\n/).length
  if (lineCount > 500) {
    warnings.push(`${id}: body is ${lineCount} lines, move detail to references`)
  }
}

// A reference linked only from the index is unreachable from the skill that
// owns it: a reader inside that skill never learns it exists. Both
// worked-read-model.md and worked-refactor.md were in that state.
function validateReferences (id, dir, body) {
  const linked = new Set()
  for (const match of body.matchAll(/references\/([\w-]+\.md)/g)) {
    linked.add(match[1])
  }
  let present
  try {
    present = readdirSync(join(dir, 'references'))
  } catch {
    present = []
  }
  for (const file of linked) {
    if (!present.includes(file)) {
      fail(id, `SKILL.md links references/${file} but the file is missing`)
    }
  }
  for (const file of present) {
    if (file.endsWith('.md') && !linked.has(file)) {
      fail(id, `references/${file} is not linked from its own SKILL.md`)
    }
  }
}

// Every relative link in every shipped file must resolve. Skills are copied
// into other people's projects, where a broken link is a dead end with no
// repository around it to search.
function validateLinks () {
  const link = /\[[^\]]*\]\(([^)\s]+?)(?:#[^)]*)?\)/g
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.endsWith('.md')) continue
      const text = readFileSync(path, 'utf8')
      for (const [, href] of text.matchAll(link)) {
        if (/^(https?:|mailto:)/.test(href)) continue
        if (!existsSync(join(dirname(path), href))) {
          errors.push(`${path.slice(ROOT.length + 1)}: broken link -> ${href}`)
        }
      }
    }
  }
  walk(SKILLS_DIR)
}

function validateSkill (id) {
  const dir = join(SKILLS_DIR, id)
  let raw
  try {
    raw = readFileSync(join(dir, 'SKILL.md'), 'utf8')
  } catch {
    fail(id, 'SKILL.md not found')
    return
  }

  const match = FRONTMATTER.exec(raw)
  if (!match) {
    fail(id, 'SKILL.md has no YAML frontmatter block')
    return
  }

  let frontmatter
  try {
    frontmatter = parseYaml(match[1])
  } catch (error) {
    fail(id, `frontmatter is not valid YAML: ${error.message}`)
    return
  }
  if (frontmatter === null || typeof frontmatter !== 'object') {
    fail(id, 'frontmatter must be a YAML mapping')
    return
  }

  validateName(id, frontmatter)
  validateDescription(id, frontmatter)
  validateKeys(id, frontmatter)
  validateVersion(id, frontmatter)
  validateBody(id, match[2])
  validateReferences(id, dir, match[2])
}

function validateManifestVersions () {
  const plugin = readJson('plugin/.claude-plugin/plugin.json')
  if (plugin.version !== EXPECTED_VERSION) {
    errors.push(
      `plugin/.claude-plugin/plugin.json: "version" is "${plugin.version}" ` +
        `but package.json is "${EXPECTED_VERSION}"`,
    )
  }
  const marketplace = readJson('.claude-plugin/marketplace.json')
  for (const entry of marketplace.plugins ?? []) {
    if (entry.version !== undefined && entry.version !== EXPECTED_VERSION) {
      errors.push(
        `.claude-plugin/marketplace.json: "${entry.name}" is at ` +
          `"${entry.version}" but package.json is "${EXPECTED_VERSION}"`,
      )
    }
  }
}

// A package.json beside a package-lock.json at the plugin's root makes
// `claude plugin install` run npm on the machine of everyone who installs it,
// pulling this repository's dev tooling for no benefit. Keep both outside.
function validateNoPackageFilesInPlugin () {
  for (const file of ['package.json', 'package-lock.json']) {
    if (existsSync(join(PLUGIN_DIR, file))) {
      errors.push(
        `plugin/${file}: must not exist. A lock file at the plugin root ` +
          'makes the installer run npm for everyone who installs the plugin.',
      )
    }
  }
}

// A range lets a patch release change what markdownlint reports, and this
// repository forbids lint configuration, so the build can turn red with no
// content change. .npmrc sets save-exact; this catches a hand-edited range.
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

function validateExactDependencies () {
  const pkg = readJson('package.json')
  for (const field of ['dependencies', 'devDependencies', 'overrides']) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (typeof range !== 'string') continue
      if (!EXACT_VERSION.test(range)) {
        errors.push(
          `package.json: ${field}."${name}" is "${range}"; dependencies are ` +
            'pinned to an exact version, never a range',
        )
      }
    }
  }
}

// Two skills that could each claim a task means neither is chosen reliably.
// Identical text is the only case a script can settle; the rest is what
// eval-routing.mjs measures.
function validateDistinctDescriptions (ids) {
  const seen = new Map()
  for (const id of ids) {
    const raw = readFileSync(join(SKILLS_DIR, id, 'SKILL.md'), 'utf8')
    const match = FRONTMATTER.exec(raw)
    if (!match) continue
    const text = parseYaml(match[1])?.description ?? ''
    if (seen.has(text)) {
      fail(id, `description is identical to ${seen.get(text)}`)
    }
    seen.set(text, id)
  }
}

const skillIds = readSkillDirs()
if (skillIds.length === 0 && errors.length === 0) {
  errors.push('plugin/skills/: no skill directories found')
}
for (const id of skillIds) {
  validateSkill(id)
}
validateLinks()
validateManifestVersions()
validateNoPackageFilesInPlugin()
validateExactDependencies()
if (errors.length === 0) {
  validateDistinctDescriptions(skillIds)
}

for (const warning of warnings) {
  process.stdout.write(`warn  ${warning}\n`)
}
for (const error of errors) {
  process.stderr.write(`error ${error}\n`)
}

if (errors.length > 0) {
  process.stderr.write(`\n${errors.length} skill validation error(s)\n`)
  process.exit(1)
}
process.stdout.write(
  `ok    ${skillIds.length} skill(s) valid at ${EXPECTED_VERSION}\n`,
)
