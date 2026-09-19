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
