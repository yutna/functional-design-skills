#!/usr/bin/env node
// Prose checks that markdownlint cannot make, over every tracked Markdown file.
//
// All four exist because a defect of that exact shape shipped here. The pack
// renamed its example domain with a word-level substitution, which coined a
// word that does not exist, broke twenty sentences where the replaced word
// meant something else, and left five articles disagreeing with the noun that
// followed. A linter caught none of it, and an audit that read every
// occurrence of the word reported the skills clean.
//
// A file that must quote one of those defects — a changelog, this comment —
// puts it in backticks, which asEnglish strips. No file is exempt.
//
// Usage:
//   node scripts/validate-prose.mjs            check every file
//   node scripts/validate-prose.mjs --selftest break each check, watch it fire

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude'])
const SKIP_FILES = new Set(['SOURCES.md', 'PRIVATE-NOTES.md'])

// The nouns this pack's examples are built from. Used by two checks below.
const DOMAIN_NOUNS = [
  'booking', 'bookings',
  'treatment', 'treatments',
  'appointment', 'appointments',
  'patient', 'patients',
  'clinician', 'clinicians',
  'quote', 'quotes',
  'shipment', 'shipments',
]

// Idiom slots that want a structural word — order, service, sequence — and can
// never want the name of a domain entity. A rename that fills one of these
// with a domain noun produces a sentence that parses and means nothing.
//
// Caught here on the day this check was written: "follow the booking things
// happen", "Booking of calls", "Booking matters:", "Forgetting pattern
// booking", "Booking the steps", "an implicit booking", "in original booking",
// "the booking is the only thing", "not one record per treatment",
// "one shared test layer per treatment", and the table header "| Booking |".
const IDIOMS = [
  [String.raw`the (NOUN) things happen`, 'the order things happen'],
  [String.raw`(NOUN) of calls`, 'Ordering of calls'],
  [String.raw`(NOUN) matters\b`, 'Order matters'],
  [String.raw`pattern (NOUN)\b`, 'pattern order'],
  [String.raw`(NOUN) the steps\b`, 'Order the steps'],
  [String.raw`implicit (NOUN)\b`, 'implicit order'],
  [String.raw`original (NOUN)\b`, 'original order'],
  [String.raw`knows the (NOUN):`, 'knows the order'],
  [String.raw`in the (NOUN) a person`, 'in the order a person'],
  [String.raw`the (NOUN) is the only thing`, 'the order is the only thing'],
  [String.raw`(?:record|layer|copy|instance) per (NOUN)\b`, 'per service'],
  [String.raw`call (NOUN)\b`, 'call order'],
  [String.raw`\|\s*(NOUN)\s*\|\s*Move`, 'a numbered "Order" column'],
  [String.raw`nothing about (NOUN)\b`, 'nothing about order'],
  [String.raw`(NOUN)-independent`, 'order-independent'],
  [String.raw`(NOUN) (?:is|was) (?:not )?(?:preserved|guaranteed)`, 'order is preserved'],
]

// Whether a word opens with a vowel *sound*, which is what chooses the
// article. Three groups need more than the first letter:
//
//   - An initialism is read letter by letter, so "an HTTP call" and "an SQL
//     query" are right: F, H, L, M, N, R, S and X all open with a vowel
//     sound when named. U does not — it is "you" — so "a UUID" is right.
//   - A handful of ordinary words open with a silent H.
//   - A handful open with a "you" or "wun" sound despite a vowel letter.
const INITIALISM = /^[A-Z][A-Z0-9]+$/
const LETTER_NAME_VOWEL_SOUND = /^[AEIOFHLMNRSX]/
const SILENT_H = /^(hour|honest|honour|honourable|heir)/i
const CONSONANT_SOUND_VOWEL_LETTER = /^(one|once|uni|use|usu|user|util|uuid|ubiquit|europe|url|ui)/i

function opensWithVowelSound (word) {
  // A lone capital is a type variable read as its letter name: "an X", "a Y".
  if (/^[A-Z]$/.test(word)) return LETTER_NAME_VOWEL_SOUND.test(word)
  if (INITIALISM.test(word)) return LETTER_NAME_VOWEL_SOUND.test(word)
  if (SILENT_H.test(word)) return true
  if (CONSONANT_SOUND_VOWEL_LETTER.test(word)) return false
  return /^[aeiou]/i.test(word)
}

// An article always introduces a noun phrase. When the next word cannot head
// one, the "a" was not an article at all — most often a type variable, as in
// "a choice of A or B".
const NOT_A_NOUN_PHRASE_HEAD = new Set([
  'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'the', 'a', 'an',
  'with', 'for', 'from', 'by', 'on', 'at', 'as', 'not', 'but', 'so', 'then',
  'than', 'that', 'which', 'when', 'where', 'if',
])

const problems = []

function report (file, line, message) {
  problems.push(`${file}:${line}  ${message}`)
}

function walk (dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (entry.endsWith('.md') && !SKIP_FILES.has(entry)) out.push(path)
  }
  return out
}

// Splits a file into prose lines and fenced-block lines, keeping line numbers.
function partition (text) {
  const prose = []
  const fenced = []
  let fence = null
  let info = ''
  text.split(/\r?\n/).forEach((line, index) => {
    const marker = /^\s*(`{3,}|~{3,})\s*(\S*)/.exec(line)
    if (fence === null && marker) {
      fence = marker[1]
      info = marker[2]
      return
    }
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        fence = null
        return
      }
      fenced.push({ n: index + 1, line, info })
      return
    }
    prose.push({ n: index + 1, line })
  })
  return { prose, fenced }
}

// Inline code and link targets hold identifiers, which legitimately look like
// anything. Strip them before reading a line as English.
function asEnglish (line) {
  return line
    .replace(/`[^`]*`/g, ' CODE ')
    .replace(/\]\([^)]*\)/g, '] ')
}

// 1. A domain noun standing in an idiom slot that wants a structural word.
function checkIdioms (file, prose) {
  const nouns = DOMAIN_NOUNS.join('|')
  for (const [template, wanted] of IDIOMS) {
    const re = new RegExp(template.replaceAll('NOUN', nouns), 'i')
    for (const { n, line } of prose) {
      const english = asEnglish(line)
      const hit = re.exec(english)
      if (hit) {
        report(file, n, `"${hit[0].trim()}" names a domain entity where the idiom wants a structural word (expected something like "${wanted}")`)
      }
    }
  }
}

// 2. "a" or "an" disagreeing with the word that follows, including when the
// pair is split across a line wrap, and including a backticked identifier.
function checkArticles (file, prose) {
  for (let i = 0; i < prose.length; i++) {
    const here = prose[i]
    // Join with the next prose line so a wrapped pair is still one string.
    const next = prose[i + 1]
    const joined = next && next.n === here.n + 1
      ? `${here.line} ${next.line}`
      : here.line
    const text = joined
      .replace(/\]\([^)]*\)/g, '] ')
      // A one-token code span is an identifier a sentence reads aloud, so
      // "a `bookingId`" is still checkable. A span with a space in it is an
      // expression, and its words are not English.
      .replace(/`[^`]*\s[^`]*`/g, ' CODE ')
    // A quote or a bracket may sit between the sentence and the article, so
    // the boundary is "not a word character", not whitespace.
    for (const m of text.matchAll(/(?<![A-Za-z0-9'’-])(an?)[ \t]+`?([A-Za-z][\w-]*)/gi)) {
      const [, article, word] = m
      // Only report the pair when the article itself is on this line;
      // otherwise the next iteration would report it a second time.
      if (m.index > here.line.length) continue
      if (NOT_A_NOUN_PHRASE_HEAD.has(word.toLowerCase())) continue
      const vowel = opensWithVowelSound(word)
      if (article.toLowerCase() === 'an' && !vowel) {
        report(file, here.n, `"${article} ${word}" — "an" before a consonant sound`)
      }
      if (article.toLowerCase() === 'a' && vowel) {
        report(file, here.n, `"${article} ${word}" — "a" before a vowel sound`)
      }
    }
  }
}

// 3. A box drawn with + and | must have every line the same width, or it is
// not a box on anyone's screen. Caught here: the core-and-shell diagram, whose
// lines ran 45, 46 and 47 characters.
function checkBoxes (file, fenced) {
  let run = []
  const flush = () => {
    if (run.length >= 3) {
      const widths = new Set(run.map(({ line }) => line.length))
      if (widths.size > 1) {
        const sizes = [...widths].sort((a, b) => a - b).join(', ')
        report(file, run[0].n, `box drawing has lines of ${sizes} characters; every line of a box must be the same width`)
      }
    }
    run = []
  }
  let previous = null
  for (const entry of fenced) {
    const isBox = /^[+|]/.test(entry.line.trimStart()) && /[+|]\s*$/.test(entry.line)
    if (isBox && (previous === null || entry.n === previous + 1)) {
      run.push(entry)
      previous = entry.n
      continue
    }
    flush()
    if (isBox) {
      run = [entry]
      previous = entry.n
    } else {
      previous = null
    }
  }
  flush()
}

// 4. A domain noun swallowed inside a longer word. A word-level rename cannot
// tell "production" from "product", so it coined "treatmention" here and no
// linter noticed. Identifiers legitimately compound these nouns, so this runs
// on prose only, and only on lower-case runs.
// This pack names no book, author, or publisher in any tracked file. The
// rule was enforced by hand until 3.0.0, after an audit had to strip a
// chapter-by-chapter coverage map that had already shipped. These are the
// marks that framing leaves behind: not the ideas, which stay, but the
// apparatus of citing them.
const CITATION_MARKS = [
  [/\bISBN\b/, 'an ISBN'],
  [/\bet al\./, '"et al."'],
  [/\bop\. cit\./i, '"op. cit."'],
  [/\bibid\./i, '"ibid."'],
  [/\bChapter \d/, 'a chapter reference'],
  [/\b\d+(?:st|nd|rd|th) edition\b/i, 'an edition number'],
  [/\bpp?\. \d/, 'a page reference'],
  [/\([12]\d{3}\)/, 'a year in parentheses'],
]

function checkCitations (file, prose) {
  for (const here of prose) {
    // A code span is how this repository quotes a defect it is describing,
    // including in the documentation for this very check. Without stripping
    // them the check fires on the sentence that explains it.
    const line = here.line.replace(/`[^`]*`/g, '``')
    for (const [pattern, what] of CITATION_MARKS) {
      if (pattern.test(line)) {
        report(file, here.n, `${what} — this pack cites no sources`)
      }
    }
  }
}

const SINGULAR_NOUNS = ['booking', 'treatment', 'appointment', 'patient', 'clinician', 'shipment']

function checkCoinedWords (file, prose) {
  const re = new RegExp(`\\b[a-z]*(?:${SINGULAR_NOUNS.join('|')})[a-z]+\\b`, 'g')
  const legitimate = new Set([...SINGULAR_NOUNS.map((n) => `${n}s`), 'patiently', 'patients'])
  for (const { n, line } of prose) {
    for (const [word] of asEnglish(line).matchAll(re)) {
      if (legitimate.has(word)) continue
      report(file, n, `"${word}" buries a domain noun inside a longer word; a rename probably coined it`)
    }
  }
}

function checkFile (path) {
  const file = relative(ROOT, path)
  const { prose, fenced } = partition(readFileSync(path, 'utf8'))
  checkIdioms(file, prose)
  checkArticles(file, prose)
  checkCoinedWords(file, prose)
  checkCitations(file, prose)
  checkBoxes(file, fenced)
}

// A guard that has never failed has never been tested. --selftest feeds each
// check the defect it was written for and confirms it fires.
function selftest () {
  const cases = [
    ['idiom', 'Modules named parse, enrich, send follow the booking things happen.', checkIdioms, 'prose'],
    ['idiom', '- Booking of calls that the types do not enforce', checkIdioms, 'prose'],
    ['idiom', '| Booking | Move |', checkIdioms, 'prose'],
    ['idiom', 'At-least-once says nothing about booking.', checkIdioms, 'prose'],
    ['idiom', 'Or make handlers booking-independent, which is cheaper.', checkIdioms, 'prose'],
    ['article', 'A draft with an `bookingId` is representable.', checkArticles, 'prose'],
    ['article-wrapped', 'Write each rule as a sentence. "An\nbooking\'s total equals the sum."', checkArticles, 'prose'],
    ['coined', 'A limit the developer invented becomes a treatmention incident.', checkCoinedWords, 'prose'],
    ['box', '+-----+\n|  a  |\n|  ab  |\n+-----+', checkBoxes, 'fenced'],
    ['citation', 'The idea comes from Chapter 4 of the second book.', checkCitations, 'prose'],
    ['citation', 'Stated plainly by Wadler and others (1998).', checkCitations, 'prose'],
    ['citation', 'The second edition, ISBN 978-0-13-235088-4, says otherwise.', checkCitations, 'prose'],
  ]
  let failures = 0
  for (const [label, sample, check, kind] of cases) {
    problems.length = 0
    const lines = sample.split('\n').map((line, index) => ({ n: index + 1, line, info: 'text' }))
    check('selftest.md', lines)
    if (problems.length === 0) {
      process.stderr.write(`selftest FAILED: ${label} (${kind}) did not fire on its own defect\n`)
      failures++
    } else {
      process.stdout.write(`selftest ok: ${label} -> ${problems[0].split('  ').slice(1).join('  ')}\n`)
    }
  }
  problems.length = 0
  // And the clean forms must not fire.
  const clean = [
    ['idiom', 'Modules named parse, enrich, send follow the order things happen.', checkIdioms],
    ['article', 'A draft with a `bookingId` is representable.', checkArticles],
    ['article', 'An hour later the booking expires, and an HTTP call is made.', checkArticles],
    ['article', 'Read "an X and a Y" as a record, and a choice of A or B as a union.', checkArticles],
    ['coined', 'Every booking has treatments, and the patients wait patiently.', checkCoinedWords],
    ['citation', 'The rule stays, in this pack\'s own words, with 1 example.', checkCitations],
    ['citation', 'The check looks for an `ISBN` and for `Chapter 4` in prose.', checkCitations],
  ]
  for (const [label, sample, check] of clean) {
    problems.length = 0
    check('selftest.md', sample.split('\n').map((line, index) => ({ n: index + 1, line })))
    if (problems.length > 0) {
      process.stderr.write(`selftest FAILED: ${label} fired on clean prose: ${problems[0]}\n`)
      failures++
    } else {
      process.stdout.write(`selftest ok: ${label} stays quiet on clean prose\n`)
    }
  }
  process.exit(failures > 0 ? 1 : 0)
}

// A pack whose name extends another pack's name says only what its
// framework or library changes; the base says the rest. Nothing enforced
// that until 3.0.0, and the cost of losing it is the one this repository
// warns about most: the same sentence in two places, corrected in one.
//
// Only substantial paragraphs are compared. A short line can legitimately
// repeat — a heading, a one-clause reminder — and flagging those would make
// the check noise rather than signal.
const SKILLS_DIR = join(ROOT, 'plugin', 'skills')
const SHARED_PARAGRAPH_CHARS = 120

function paragraphsOf (dir) {
  const found = new Map()
  const files = [join(dir, 'SKILL.md')]
  try {
    for (const name of readdirSync(join(dir, 'references'))) {
      if (name.endsWith('.md')) files.push(join(dir, 'references', name))
    }
  } catch { /* a skill without references is normal */ }
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch { continue }
    // Fenced code is excluded: two packs showing the same neutral-notation
    // snippet is the point of a shared notation, not a duplication.
    const prose = text.split(/^```[\s\S]*?^```$/gm).join('\n\n')
    for (const block of prose.split(/\n\s*\n/)) {
      const normalised = block.trim().replace(/\s+/g, ' ')
      if (normalised.length < SHARED_PARAGRAPH_CHARS) continue
      if (normalised.startsWith('#') || normalised.startsWith('|')) continue
      if (!found.has(normalised)) found.set(normalised, relative(ROOT, file))
    }
  }
  return found
}

// Every pack the name nests inside, nearest first. The chain matters:
// functional-typescript-react-nextjs extends the React pack, which extends
// the TypeScript pack, and a paragraph repeated from either is repeated.
function ancestorsOf (id, known) {
  const parts = id.split('-')
  const found = []
  for (let i = parts.length - 1; i > 1; i--) {
    const candidate = parts.slice(0, i).join('-')
    if (known.has(candidate)) found.push(candidate)
  }
  return found
}

function checkDeltaPacks () {
  let ids
  try {
    ids = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch { return }
  const known = new Set(ids)
  for (const id of ids) {
    const ancestors = ancestorsOf(id, known)
    if (ancestors.length === 0) continue
    const base = new Map()
    for (const ancestor of ancestors) {
      for (const [text, file] of paragraphsOf(join(SKILLS_DIR, ancestor))) {
        if (!base.has(text)) base.set(text, file)
      }
    }
    for (const [text, file] of paragraphsOf(join(SKILLS_DIR, id))) {
      if (!base.has(text)) continue
      report(
        file,
        0,
        `repeats a paragraph from ${base.get(text)}; a pack that extends ` +
          `another says only what it changes`,
      )
    }
  }
}

if (process.argv.includes('--selftest')) selftest()

for (const path of walk(ROOT)) checkFile(path)
checkDeltaPacks()

for (const problem of problems) {
  process.stderr.write(`error ${problem}\n`)
}
if (problems.length > 0) {
  process.stderr.write(`\n${problems.length} prose problem(s)\n`)
  process.exit(1)
}
process.stdout.write('ok    prose checks clean\n')
