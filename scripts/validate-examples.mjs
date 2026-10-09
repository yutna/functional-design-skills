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
// be wrong in the one way that makes it useless to paste. Checking the
// TypeScript and JavaScript ones against the libraries they name is
// validate-types.mjs's job.
//
// Elixir needs the Elixir toolchain, so it is opt-in with --with-elixir, and
// without the flag JavaScript, TypeScript and JSON are what gate. The Ubuntu
// job in continuous integration installs the toolchain and passes the flag,
// so there Elixir gates too; the Windows job installs none, and on your own
// machine the fences are parsed only when you ask. Asking on a machine with no
// Elixir on PATH fails: a run that parsed no Elixir has measured nothing, and
// printing "ok" for it is worse than a red build. So does an Elixir that
// starts and then dies before it has been through every fence.
//
// Usage:
//   node scripts/validate-examples.mjs                 js, ts, tsx, json
//   node scripts/validate-examples.mjs --with-elixir   also elixir
//   node scripts/validate-examples.mjs --list          every fence and its language
//   node scripts/validate-examples.mjs --selftest      prove the checks still fire

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { fencesIn, readMarkdown } from './lib/markdown.mjs'
import { skillMarkdownFiles } from './lib/pack.mjs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import ts from 'typescript'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const KIND = {
  ts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
}

function fences () {
  const found = []
  for (const path of skillMarkdownFiles()) {
    found.push(...fencesIn(readMarkdown(path), path.slice(ROOT.length + 1)))
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

function haveElixir () {
  const probe = spawnSync('elixir', ['--version'])
  return probe.error === undefined && probe.status === 0
}

// Elixir parses its own examples: Code.string_to_quoted reads without
// running anything.
function elixirErrors (list) {
  if (list.length === 0) return []
  // Reached only by a caller that asked for Elixir; selftest skips for itself
  // before it gets here. This used to print a skip and return no errors,
  // which counted every Elixir fence as parsed on a machine that parsed none.
  // A check that measured nothing has failed, not passed.
  if (!haveElixir()) {
    process.stderr.write(
      'error Elixir was asked for with --with-elixir and none is on PATH, ' +
        'so no Elixir fence was parsed\n',
    )
    process.exit(1)
  }
  const work = mkdtempSync(join(tmpdir(), 'fds-examples-'))
  try {
    list.forEach((fence, index) => {
      writeFileSync(join(work, `${index}.exs`), fence.code)
    })
    // The message of a parse error is a string for most errors and a pair of
    // strings for some -- a stray `end` gives {"unexpected reserved word: ",
    // ""} on Elixir 1.20.4 -- with the token to go between them. Printing a
    // pair raised, the script died on the first one, and every fence after it
    // went unparsed while the run reported ok. A row is one line of three
    // tab-separated fields, so whitespace in a message is collapsed. This is
    // a template literal, so the source says \\t and \\s to hand Elixir a \t
    // and a \s; a bare \s would reach it as a plain s.
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
            text =
              case message do
                {before, rest} -> "\#{before}\#{token}\#{rest}"
                _ -> "\#{message}\#{inspect(token)}"
              end
            one_line = String.replace(text, ~r/\\s+/, " ")
            IO.puts("\#{index}\\t\#{line}\\t\#{one_line}")
        end
      end)
    `)
    const result = spawnSync('elixir', [join(work, 'parse.exs'), work], { encoding: 'utf8' })
    // The script above exits 0 whatever it finds, so any other ending means
    // it did not get through the list, and an empty stdout would otherwise
    // read as a list with nothing wrong in it. process.exit skips the finally
    // below, so the directory is removed here first.
    if (result.error !== undefined || result.status !== 0) {
      rmSync(work, { recursive: true, force: true })
      let detail = (result.error?.message ?? result.stderr).trim()
      if (detail === '') {
        detail = result.signal
          ? `killed by ${result.signal}`
          : `exit status ${result.status}`
      }
      process.stderr.write(
        'error the Elixir parser did not finish, so no Elixir fence can be ' +
          `called parsed\n${detail}\n`,
      )
      process.exit(1)
    }
    return result.stdout.trim().split('\n').filter(Boolean).map((row) => {
      const [index, line, message] = row.split('\t')
      return { fence: list[Number(index)], line: Number(line), message }
    })
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

// Each case is a whole Markdown document, because the indent handling is
// part of what is being tested and a bare fence would not exercise it.
const SELFTEST = [
  ['a top-level fence that does not parse', true,
    '# T\n\n```ts\nconst f = (): number => ...;\n```\n'],
  ['a fence indented into a list item', true,
    '# T\n\n1. Step\n\n   ```ts\n   const f = (): number => ...;\n   ```\n'],
  ['an indented fence that is valid', false,
    '# T\n\n1. Step\n\n   ```ts\n   const f = (): number => 1;\n   ```\n'],
  ['an ellipsis inside an Elixir struct', true,
    '# T\n\n```elixir\n%Appointment{...status: at}\n```\n', 'elixir'],
  // Elixir reports this one as a pair of strings, not a string. Printing the
  // pair killed the parser, so a stray end hid every fence after it.
  ['a stray end, whose message Elixir returns as a pair', true,
    '# T\n\n```elixir\ndef f do\n  :ok\nend\nend\n```\n', 'elixir'],
  ['malformed JSON', true, '# T\n\n```json\n{ "a": }\n```\n'],
  ['a language nothing here can parse', false,
    '# T\n\n```text\nthis is notation, not code\n```\n'],
  ['prose with no fence at all', false, '# T\n\nJust a sentence.\n'],
]

function selftest () {
  let failures = 0
  for (const [label, shouldFail, doc, lang] of SELFTEST) {
    // A case that needs a toolchain this machine has not got is skipped, not
    // failed. The Windows job has no Elixir, and a self-test that passes
    // only where it was written is worse than none.
    if (lang === 'elixir' && !haveElixir()) {
      process.stdout.write(`selftest skip: ${label} (no elixir on PATH)\n`)
      continue
    }
    const list = fencesIn(doc, 'selftest.md')
    let caught = false
    if (lang === 'elixir') {
      caught = elixirErrors(list.filter((f) => f.lang === 'elixir')).length > 0
    } else {
      caught = list.some((fence) => syntaxError(fence) !== null)
    }
    if (caught === shouldFail) {
      process.stdout.write(`selftest ok: ${label}\n`)
    } else {
      process.stderr.write(
        `selftest FAIL: ${label} -> expected ${shouldFail ? 'a failure' : 'silence'}\n`,
      )
      failures++
    }
  }
  if (failures > 0) {
    process.stderr.write(`\n${failures} selftest case(s) wrong\n`)
    process.exit(1)
  }
}

const argv = process.argv.slice(2)
const withElixir = argv.includes('--with-elixir')
if (argv.includes('--selftest')) {
  selftest()
  process.exit(0)
}
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
// A check that found nothing to check has not passed; it has stopped
// working. On a CRLF checkout one of these readers silently matched no
// lines, reported zero, and exited clean. Every count below is a floor.
if (checked === 0) {
  process.stderr.write(
    'error no code examples were parsed, so this check measured nothing\n',
  )
  process.exit(1)
}
process.stdout.write(`ok    ${checked} code example(s) parse\n`)
