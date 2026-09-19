#!/usr/bin/env node
// Prose checks that markdownlint cannot make, over every tracked Markdown file.
//
// All three exist because a defect of that exact shape shipped here. The pack
// renamed its example domain with a word-level substitution, which coined a
// word that does not exist, broke a dozen sentences where the replaced word
// meant something else, and left five articles disagreeing with the noun that
// followed. A linter caught none of it, and an audit that read every
// occurrence of the word reported the skills clean.
//
// Usage:
//   node scripts/validate-prose.mjs            check every file
//   node scripts/validate-prose.mjs --selftest break each check, watch it fire

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKIP_DIRS = new Set(['node_modules', '.git', '.claude'])
const SKIP_FILES = new Set(['SOURCES.md', 'PRIVATE-NOTES.md', 'CHANGELOG.md'])

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
    const text = joined.replace(/\]\([^)]*\)/g, '] ')
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
  checkBoxes(file, fenced)
}

// A guard that has never failed has never been tested. --selftest feeds each
// check the defect it was written for and confirms it fires.
function selftest () {
  const cases = [
    ['idiom', 'Modules named parse, enrich, send follow the booking things happen.', checkIdioms, 'prose'],
    ['idiom', '- Booking of calls that the types do not enforce', checkIdioms, 'prose'],
    ['idiom', '| Booking | Move |', checkIdioms, 'prose'],
    ['article', 'A draft with an `bookingId` is representable.', checkArticles, 'prose'],
    ['article-wrapped', 'Write each rule as a sentence. "An\nbooking\'s total equals the sum."', checkArticles, 'prose'],
    ['coined', 'A limit the developer invented becomes a treatmention incident.', checkCoinedWords, 'prose'],
    ['box', '+-----+\n|  a  |\n|  ab  |\n+-----+', checkBoxes, 'fenced'],
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

if (process.argv.includes('--selftest')) selftest()

for (const path of walk(ROOT)) checkFile(path)

for (const problem of problems) {
  process.stderr.write(`error ${problem}\n`)
}
if (problems.length > 0) {
  process.stderr.write(`\n${problems.length} prose problem(s)\n`)
  process.exit(1)
}
process.stdout.write('ok    prose checks clean\n')
