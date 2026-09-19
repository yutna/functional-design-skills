#!/usr/bin/env node
// Parses every fenced code example in the pack and fails on one that is not
// the language its fence claims.
//
// This exists because fourteen examples used `...` as an ellipsis. In
// TypeScript and JavaScript `...` is spread syntax, so `{ ...status: at }`
// is not an elision to a reader or to a compiler, it is a parse error; in
// Elixir it is not a token at all. Every one of them was marked `ts`, `js`
// or `elixir`, which claims the reader can run it. They could not. The same
// pass found two identifiers a word-level rename had missed, because a name
// inside a code span is invisible to a prose check.
//
// The house rule the guard enforces: elide with a comment the language
// understands. `/* ... */` in a block, argument or object position; a real
// short body where an expression is required.
//
// What this proves is narrow, and worth stating: it is a parser, not a type
// checker and not a test. An example can parse and still be wrong. It cannot
// be wrong in the one way that makes it useless to paste.
//
// Elixir needs the Elixir toolchain, which continuous integration does not
// install, so it is opt-in with --with-elixir and JavaScript, TypeScript and
// JSON are what gate.
//
// Usage:
//   node scripts/validate-examples.mjs                 js, ts, tsx, json
//   node scripts/validate-examples.mjs --with-elixir   also elixir
//   node scripts/validate-examples.mjs --list          every fence and its language

import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILLS = join(ROOT, 'plugin', 'skills')

const KIND = {
  ts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
}

const FENCE = /^```(\w+)[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm

function markdownFiles (dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path))
    else if (entry.endsWith('.md')) out.push(path)
  }
  return out
}

function fences () {
  const found = []
  for (const path of markdownFiles(SKILLS)) {
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(FENCE)) {
      found.push({
        file: path.slice(ROOT.length + 1),
        line: text.slice(0, match.index).split('\n').length,
        lang: match[1],
        code: match[2],
      })
    }
  }
  return found
}

// A fence's first diagnostic, or null when it parses.
function syntaxError (fence) {
  if (fence.lang === 'json') {
    try {
      JSON.parse(fence.code)
      return null
    } catch (error) {
      return { line: 1, message: error.message }
    }
  }
  const kind = KIND[fence.lang]
  if (kind === undefined) return null
  const source = ts.createSourceFile(
    `fence.${fence.lang}`, fence.code,
    { languageVersion: ts.ScriptTarget.ESNext }, false, kind,
  )
  const [first] = source.parseDiagnostics ?? []
  if (first === undefined) return null
  const { line } = source.getLineAndCharacterOfPosition(first.start)
  return {
    line: line + 1,
    message: ts.flattenDiagnosticMessageText(first.messageText, ' '),
    source: (fence.code.split('\n')[line] ?? '').trim(),
  }
}

// Elixir parses its own examples: Code.string_to_quoted reads without
// running anything.
function elixirErrors (list) {
  if (list.length === 0) return []
  if (spawnSync('elixir', ['--version']).status !== 0) {
    process.stdout.write('skip  elixir fences: no elixir on PATH\n')
    return []
  }
  const work = mkdtempSync(join(tmpdir(), 'fds-examples-'))
  try {
    list.forEach((fence, index) => {
      writeFileSync(join(work, `${index}.exs`), fence.code)
    })
    writeFileSync(join(work, 'parse.exs'), `
      dir = System.argv() |> List.first()
      dir
      |> File.ls!()
      |> Enum.filter(&(&1 != "parse.exs"))
      |> Enum.sort_by(&String.to_integer(String.trim_trailing(&1, ".exs")))
      |> Enum.each(fn name ->
        index = String.trim_trailing(name, ".exs")
        case Code.string_to_quoted(File.read!(Path.join(dir, name))) do
          {:ok, _} -> :ok
          {:error, {meta, message, token}} ->
            line = if is_list(meta), do: Keyword.get(meta, :line, 1), else: meta
            IO.puts("\#{index}\\t\#{line}\\t\#{message}\#{inspect(token)}")
        end
      end)
    `)
    const result = spawnSync('elixir', [join(work, 'parse.exs'), work], { encoding: 'utf8' })
    return result.stdout.trim().split('\n').filter(Boolean).map((row) => {
      const [index, line, message] = row.split('\t')
      return { fence: list[Number(index)], line: Number(line), message }
    })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

const argv = process.argv.slice(2)
const withElixir = argv.includes('--with-elixir')
const all = fences()

if (argv.includes('--list')) {
  const counts = new Map()
  for (const fence of all) counts.set(fence.lang, (counts.get(fence.lang) ?? 0) + 1)
  for (const [lang, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`${String(n).padStart(4)}  ${lang}\n`)
  }
  process.exit(0)
}

const problems = []
let checked = 0
for (const fence of all) {
  if (fence.lang === 'json' || KIND[fence.lang] !== undefined) {
    checked++
    const error = syntaxError(fence)
    if (error) problems.push({ fence, ...error })
  }
}

if (withElixir) {
  const list = all.filter((fence) => fence.lang === 'elixir')
  checked += list.length
  for (const { fence, line, message } of elixirErrors(list)) {
    problems.push({ fence, line, message, source: (fence.code.split('\n')[line - 1] ?? '').trim() })
  }
}

for (const problem of problems) {
  process.stderr.write(
    `${problem.fence.file}:${problem.fence.line} ` +
    `(${problem.fence.lang}, fence line ${problem.line}): ${problem.message}\n`,
  )
  if (problem.source) process.stderr.write(`  > ${problem.source}\n`)
}

if (problems.length > 0) {
  process.stderr.write(
    `\n${problems.length} example(s) are not the language the fence claims. ` +
    'Elide with a comment the language understands, not "...".\n',
  )
  process.exit(1)
}
process.stdout.write(`ok    ${checked} code example(s) parse\n`)
