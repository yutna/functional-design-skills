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
import { anchorsIn, readMarkdown, slugOf, stripFences } from './lib/markdown.mjs'
import { readSkill, skillIds as everyId } from './lib/pack.mjs'

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

// The installer copies skills flat into ~/.claude/skills, where two packs
// can claim the same directory name. Every skill carries the pack it came
// from so install.sh can say "conflict" instead of skipping in silence.
// metadata is documented as a free-form map read by your own tooling, which
// is exactly this.
const PACK_NAME = 'functional-design-skills'

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
  try {
    return everyId()
  } catch (error) {
    errors.push(error.message)
    return []
  }
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
// Added in 3.0.0. Without it the two packs this author publishes cannot be
// installed side by side: the second install silently skips every skill whose
// name the first already took.
function validatePack (id, frontmatter) {
  const pack = frontmatter.metadata?.pack
  if (pack === undefined) {
    fail(id, 'frontmatter "metadata.pack" is missing')
    return
  }
  if (pack !== PACK_NAME) {
    fail(id, `"metadata.pack" is "${pack}" but this pack is "${PACK_NAME}"`)
  }
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

// A reference long enough to scroll needs a way in. Without one the reader
// either reads all of it or gives up, and a skill that points at a section
// of it has made a promise the file does not keep. Two sections do not make
// a list worth reading, so the rule wants length and breadth together.
const CONTENTS_THRESHOLD = 100
const CONTENTS_MIN_SECTIONS = 3

function validateContentsList (id, dir) {
  let files
  try {
    files = readdirSync(join(dir, 'references'))
  } catch {
    return
  }
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const text = readMarkdown(join(dir, 'references', file))
    const lines = text.split(/\r?\n/).length
    if (lines <= CONTENTS_THRESHOLD) continue
    if (/^## Contents$/m.test(text)) continue
    const sections = (stripFences(text).match(/^## .+$/gm) ?? []).length
    if (sections < CONTENTS_MIN_SECTIONS) continue
    fail(id, `references/${file} is ${lines} lines and has no contents list`)
  }
}

// A reference linked only from the index is unreachable from the skill that
// owns it: a reader inside that skill never learns it exists. Both
// worked-read-model.md and worked-refactor.md were in that state.
function validateReferences (id, dir, body) {
  const linked = new Set()
  // Only this skill's own references. A cross-skill link reads
  // `../other-skill/references/x.md`, so anything preceded by a path
  // separator belongs to somebody else.
  for (const match of body.matchAll(/(?<![\w/.-])references\/([\w-]+\.md)/g)) {
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

// Every relative link in every Markdown file must resolve, and so must
// every anchor. Skills are copied into other people's projects, where a
// broken link is a dead end with no repository around it to search, and the
// contents list at the top of each long reference is written by hand
// against slugs a renderer computes, so one wrong rule there produces dozens
// of dead links at once.
//
// The walk covers the repository, not only plugin/skills. Until 3.0.1 it
// stopped at the skills directory, so a broken link in README.md,
// CONTRIBUTING.md or the evals was nobody's job to catch -- and the README
// is the first file anyone reads.
const LINK_SKIP_DIRS = new Set(['node_modules', '.git', '.claude'])
const LINK_SKIP_FILES = new Set(['SOURCES.md', 'PRIVATE-NOTES.md'])

function validateLinks () {
  const link = /\[[^\]]*\]\(([^)\s#]*)(?:#([^)\s]*))?\)/g
  const anchors = new Map()
  const anchorsFor = (path) => {
    if (!anchors.has(path)) anchors.set(path, anchorsIn(readMarkdown(path)))
    return anchors.get(path)
  }
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (LINK_SKIP_DIRS.has(entry)) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.endsWith('.md') || LINK_SKIP_FILES.has(entry)) continue
      const where = path.slice(ROOT.length + 1)
      const text = readMarkdown(path)
      for (const [, href, anchor] of text.matchAll(link)) {
        if (/^(https?:|mailto:)/.test(href)) continue
        const target = href === '' ? path : join(dirname(path), href)
        if (!existsSync(target)) {
          errors.push(`${where}: broken link -> ${href}`)
          continue
        }
        if (anchor === undefined || anchor === '') continue
        if (!target.endsWith('.md')) continue
        if (!anchorsFor(target).has(anchor)) {
          errors.push(`${where}: no heading matches the anchor #${anchor}`)
        }
      }
    }
  }
  walk(ROOT)
}

function validateSkill (id) {
  let skill
  try {
    skill = readSkill(id)
  } catch {
    fail(id, 'SKILL.md not found')
    return
  }
  const { dir, body, frontmatter, malformed } = skill
  if (malformed === 'missing') {
    fail(id, 'SKILL.md has no YAML frontmatter block')
    return
  }
  if (malformed === 'not a mapping') {
    fail(id, 'frontmatter must be a YAML mapping')
    return
  }
  if (malformed !== null) {
    fail(id, `frontmatter is not valid YAML: ${malformed}`)
    return
  }

  validateName(id, frontmatter)
  validateDescription(id, frontmatter)
  validateKeys(id, frontmatter)
  validateVersion(id, frontmatter)
  validatePack(id, frontmatter)
  validateBody(id, body)
  validateReferences(id, dir, body)
  validateContentsList(id, dir)
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

// A version bump touches package.json, the two manifests, and every skill,
// which invites a find-and-replace across the repository. Doing that caught
// twenty-one dependencies in package-lock.json whose version happened to
// match the one being replaced, and npm ci did not notice: it installs from
// the resolved URL and the integrity hash, so a wrong version field is a
// lock file that lies rather than one that fails. The URL carries the real
// version, so the two can be compared.
const TARBALL = /\/(?:@[^/]+\/)?([^/]+)\/-\/[^/]+-(\d[^/]*)\.tgz$/

function validateLockVersions () {
  let lock
  try {
    lock = readJson('package-lock.json')
  } catch {
    errors.push('package-lock.json: not found or not valid JSON')
    return
  }
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    if (path === '' || typeof entry.resolved !== 'string') continue
    const match = TARBALL.exec(entry.resolved)
    if (match === null) continue
    if (entry.version !== match[2]) {
      errors.push(
        `package-lock.json: "${path}" says version "${entry.version}" but ` +
          `resolves to "${match[2]}"`,
      )
    }
  }
}

// Two skills that could each claim a task means neither is chosen reliably.
// Identical text is the only case a script can settle; the rest is what
// eval-routing.mjs measures.
function validateDistinctDescriptions (ids) {
  const seen = new Map()
  for (const id of ids) {
    const raw = readMarkdown(join(SKILLS_DIR, id, 'SKILL.md'))
    const match = FRONTMATTER.exec(raw)
    if (!match) continue
    const text = parseYaml(match[1])?.description ?? ''
    if (seen.has(text)) {
      fail(id, `description is identical to ${seen.get(text)}`)
    }
    seen.set(text, id)
  }
}

// evals/scenarios.md names skills in backticks and nothing read it, so a
// rename could leave it pointing at skills that no longer exist and every
// check would still pass. eval-routing.mjs reads routing-cases.md; this
// covers the rest of the directory.
function validateEvalNames (ids) {
  const known = new Set(ids)
  const evalsDir = join(ROOT, 'evals')
  let files
  try {
    files = readdirSync(evalsDir).filter((file) => file.endsWith('.md'))
  } catch {
    errors.push('evals/: directory not found')
    return
  }
  for (const file of files) {
    const text = readMarkdown(join(evalsDir, file))
    const pattern = /`((?:[a-z]+-){1,4}[a-z]+)`/g
    for (const [, name] of text.matchAll(pattern)) {
      if (known.has(name)) continue
      // A hyphenated word in backticks is not automatically a skill name.
      // Since 3.0.0 every skill carries the pack's prefix, so anything
      // without it -- `use-server`, `ts-pattern` -- is prose, not a name.
      if (!name.startsWith('functional-')) continue
      errors.push(`evals/${file}: names "${name}", which is not a skill`)
    }
  }
}

// A pack whose name extends another pack's name is a delta: it says only what
// its framework or library changes and the base says the rest. A reader who
// lands on the delta first has to be able to find the base, so the link is
// required rather than conventional.
function validateParentPack (ids) {
  const known = new Set(ids)
  for (const id of ids) {
    const parts = id.split('-')
    let parent
    for (let i = parts.length - 1; i > 1; i--) {
      const candidate = parts.slice(0, i).join('-')
      if (known.has(candidate)) {
        parent = candidate
        break
      }
    }
    if (parent === undefined) continue
    const body = readMarkdown(join(SKILLS_DIR, id, 'SKILL.md'))
    if (!body.includes(`../${parent}/SKILL.md`)) {
      fail(id, `extends "${parent}" but does not link to it`)
    }
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
validateLockVersions()
validateEvalNames(skillIds)
validateParentPack(skillIds)
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
// A check that found nothing to check has not passed; it has stopped
// working. On a CRLF checkout one of these readers silently matched no
// lines, reported zero, and exited clean. Every count below is a floor.
if (skillIds.length === 0) {
  process.stderr.write(
    'error no skills found under plugin/skills, so nothing was validated\n',
  )
  process.exit(1)
}
process.stdout.write(
  `ok    ${skillIds.length} skill(s) valid at ${EXPECTED_VERSION}\n`,
)
