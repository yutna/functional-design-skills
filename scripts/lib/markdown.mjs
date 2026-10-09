// Reading Markdown, in one place.
//
// This pack's own rule, from functional-crossing-io-boundaries: parse at
// the boundary, once, and let everything inward work with the parsed value.
// The tooling did not follow it. Eight scripts each read files and split
// lines themselves -- twenty-one separate splits -- so each was an
// independent chance to get line endings wrong, and three of them did.
// .gitattributes checks Markdown out with the platform's own endings, so on
// Windows one validator matched no headings at all, found no rules, and
// exited clean.
//
// Normalising here makes that class of bug unrepresentable rather than
// caught: nothing downstream ever sees a \r, so no pattern downstream has
// to remember to allow for one.

import { readFileSync } from 'node:fs'

// The one place a Markdown file enters this tooling.
export function readMarkdown (path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

// The same boundary for the TypeScript that sits beside the Markdown. The
// preludes under example-types/ are checked out with the platform's endings
// like everything else, and a \r left in one would reach a pattern that does
// not expect it.
export function readSource (path) {
  return readMarkdown(path)
}

export function linesOf (text) {
  return text.split('\n')
}

// Headings and list items must be counted outside fenced code, or a
// `# comment` in a shell example reads as a level-one heading.
export function stripFences (text) {
  const kept = []
  let fence = null
  for (const line of linesOf(text)) {
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

// Every block fenced with this language tag, in order. Returning all of
// them rather than the first is deliberate: the routing scorer read only
// the first ```text block, so a second one would have been skipped in
// silence with every case in it unscored.
export function fencedBlocks (text, language) {
  const pattern = new RegExp('```' + language + '\\n([\\s\\S]*?)```', 'g')
  return [...text.matchAll(pattern)].map((match) => match[1])
}

// House style indents a fence inside a numbered list to the item's content
// column, so the indent is captured, required again on the closing fence, and
// stripped from every line before the code is read.
const FENCE = /^([ \t]*)```(\w+)[ \t]*\r?\n([\s\S]*?)^\1```[ \t]*$/gm

function outdent (code, indent) {
  if (indent === '') return code
  return code
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n')
}

// Every fence of every language, in order: where it opens, what it claims to
// be, and its code with the list indent taken off. `line` is the line of the
// opening marker, so the first line of `code` is Markdown line `line + 1`.
// The parse check and the type check both read examples through this, and
// they would disagree about which lines belong to which fence if each kept
// its own copy of the pattern.
export function fencesIn (text, file) {
  const found = []
  for (const match of text.matchAll(FENCE)) {
    found.push({
      file,
      line: text.slice(0, match.index).split('\n').length,
      lang: match[2],
      code: outdent(match[3], match[1]),
    })
  }
  return found
}

// Inline code outside fenced blocks, with the line each span opens on. A span
// is a run of backticks closed by a run of the same length, and a wrapped
// sentence can break one across lines, so the scan is over the whole text
// rather than line by line. A paragraph break ends the search: an unmatched
// run is literal text, not a span that swallows the rest of the file.
export function inlineCodeSpans (text) {
  let fence = null
  const prose = linesOf(text).map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence === null && marker) {
      fence = marker[1]
      return ''
    }
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) {
        fence = null
      }
      return ''
    }
    return line
  }).join('\n')
  const spans = []
  let at = 0
  while (at < prose.length) {
    if (prose[at] !== '`') {
      at++
      continue
    }
    let end = at
    while (prose[end] === '`') end++
    const width = end - at
    let close = -1
    for (let probe = end; probe < prose.length;) {
      if (prose[probe] !== '`') {
        probe++
        continue
      }
      let after = probe
      while (prose[after] === '`') after++
      if (after - probe === width) {
        close = probe
        break
      }
      probe = after
    }
    const inside = close === -1 ? '' : prose.slice(end, close)
    if (close === -1 || /\n[ \t]*\n/.test(inside)) {
      at = end
      continue
    }
    spans.push({
      line: prose.slice(0, at).split('\n').length,
      code: inside.replace(/\s+/g, ' ').trim(),
    })
    at = close + width
  }
  return spans
}

// The slug a heading gets in rendered Markdown: lower-cased, with anything
// that is not a letter, digit, space or hyphen removed, and spaces
// hyphenated.
export function slugOf (heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-')
}

export function anchorsIn (text) {
  const slugs = new Set()
  for (const line of linesOf(stripFences(text))) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line)
    if (heading) slugs.add(slugOf(heading[1]))
  }
  return slugs
}
