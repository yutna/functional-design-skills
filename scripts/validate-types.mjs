#!/usr/bin/env node
// Type-checks every TypeScript, TSX and JavaScript example in the pack
// against the libraries it names, at the versions package.json pins.
//
// validate-examples.mjs parses the examples and says of itself that it is a
// parser, not a type checker. A parser cannot tell a real API from an invented
// one, or a value from a value of the wrong type. A review that compiled the
// examples by hand found a dozen that did not type-check and several library
// names that do not exist; nothing stopped the next one. This is the gate.
//
// An example is a fragment. It uses names it never defines: a Booking type, a
// catalogue, the Result helpers another file shows. For the checker those
// names come from a prelude, one small file per Markdown file under
// example-types/, outside the plugin so that none of it ships:
//
//   plugin/skills/<skill>/<path>.md  ->  example-types/<skill>/<path>.ts
//
// A prelude holds only what the file's examples assume and do not define:
// imports for library names the fences use without importing, types, and
// `declare const` / `declare function` for values. It is checked itself --
// no any, no cast, no @ts-ignore, no value defined where a value should only
// be declared -- because a prelude that accepts anything hides the defect
// this check exists to find. A file whose fences are JavaScript has an
// ambient `<path>.d.ts` instead, global to that one file's check, and an
// optional `<path>.claims.ts` (`.claims.js` for JavaScript) is appended after
// the examples to prove what the prose says about them: an assignment that
// only compiles if an inferred type is the one the text names, or a line
// under @ts-expect-error that is an error only if the text is right to call
// it one. Names several packs share -- Result and its helpers -- are declared
// once, in example-types/_shared/, which preludes import.
//
// How a Markdown file becomes a module: the prelude; every import found in
// any fence, hoisted and de-duplicated; then each fence in order, unchanged
// except that its imports are gone (hoisted), its `export` modifiers and
// export lists are gone (many fences each show a module, and together they
// would export a name twice), and a fence that declares a name already
// declared is wrapped in a block, so a before and an after can share a name
// and a later fence still sees the first declaration, as a reader does. A
// relative import is dropped, since every fence of a file is one module and
// the names it brings are defined by a fence or declared by the prelude.
//
// One further change, and it is the only one that touches a fence's code: a
// function whose body is nothing but a comment gets a `throw` in front of the
// comment. House style elides with `/* ... */`, and a body that returns
// nothing is an error in any function declared to return something, so
// without this every elided body would fail for being elided. The count is
// printed, so it cannot grow unseen.
//
// What this proves: each example compiles against the pinned libraries, under
// the options the TypeScript pack tells readers to use, given what its
// prelude declares; and every `Name.member` in prose names a member that
// exists. What it does not: that an example is right. A prelude is an
// assumption, and an example can type-check and still be wrong. The neutral
// notation has no checker, and Elixir is parsed by validate-examples.mjs, not
// compiled.
//
// A check that measured nothing has failed, not passed: no example checked,
// no prose name resolved, a prelude beside no Markdown file, or a library on
// the list that nothing imports is an error.
//
// Usage:
//   node scripts/validate-types.mjs                    check every example
//   node scripts/validate-types.mjs --only <skill-id>  one skill, for yourself
//   node scripts/validate-types.mjs --selftest         prove the checks fire

import {
  existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import ts from 'typescript'
import {
  fencesIn, inlineCodeSpans, readMarkdown, readSource,
} from './lib/markdown.mjs'
import {
  exampleTypeFiles, ROOT, skillIds, skillMarkdownFiles,
} from './lib/pack.mjs'

// The libraries the examples are checked against, pinned in package.json.
// Two rules keep this list honest: an example or a prelude that imports a
// package not named here is an error, and a package named here that nothing
// imports is an error. A @types/ package counts as imported when the package
// it types is. To add one, `npm install --save-dev --save-exact` it and name
// it here in the same change.
const LIBRARIES = [
  'effect',
  'zod',
  'valibot',
  'ts-pattern',
  'xstate',
  'immer',
  'react',
  '@types/react',
  '@standard-schema/spec',
  'next',
]

// Markdown files whose examples are not yet checked, as repository paths.
// The check prints each as a warning and skips it. The list exists so that
// work on a new skill can land in steps and say where it stopped; it is
// meant to be empty, and a comment beside each entry says why it is not.
const NOT_YET_COVERED = [
]

// The options the TypeScript pack tells readers to use, plus what a checker
// needs. `types` is empty because otherwise every package under
// node_modules/@types joins the program, and which ones are there depends on
// what the lint tooling happens to pull in.
const COMPILER_OPTIONS = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  erasableSyntaxOnly: true,
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
  skipLibCheck: true,
  noEmit: true,
  types: [],
}
// JavaScript has no annotations, so an implicit any is the norm there and
// only a contradiction is worth reporting.
const JS_OPTIONS = {
  ...COMPILER_OPTIONS,
  allowJs: true,
  checkJs: true,
  noImplicitAny: false,
}

// The diagnostics that mean "no such member", and so the only ones that say a
// prose name does not exist. Any other error on a probe is about the probe.
const NO_SUCH_MEMBER = new Set([2339, 2551, 2694, 2305, 2724])

// Generated modules go here: ignored by git and by the linter, and under the
// root node_modules so that an import resolves as it would in a project. The
// directory is rebuilt on every run and left in place afterwards, so a
// failure can be read in the file the compiler saw.
const CACHE = join(ROOT, 'node_modules', '.cache', 'validate-types')

// A parsed library file is the same in every program, so it is parsed once
// for the whole run: the per-file JavaScript programs, and each case of
// --selftest, would otherwise parse the same few hundred declaration files
// again.
const LIBRARY_FILES = new Map()

const SKILLS_PREFIX = 'plugin/skills/'
const TYPES_PREFIX = 'example-types/'
const SHARED_DIR = '_shared'
const THROW_ELIDED = ' throw new Error("elided");'

const posixPath = (path) => path.split(sep).join('/')
const repoPath = (absolute) => posixPath(relative(ROOT, absolute))
// TypeScript hands the host forward-slash paths on every platform, so the
// table of generated files is keyed the same way.
const hostKey = (path) => path.replace(/\\/g, '/')

// ---------------------------------------------------------------------------
// Where things live

const SUFFIX = {
  'prelude-ts': '.ts',
  'prelude-js': '.d.ts',
  'claims-ts': '.claims.ts',
  'claims-js': '.claims.js',
}

// The part a file under example-types/ plays, and the Markdown file it
// stands beside. `_shared` holds declarations preludes import and belongs to
// no Markdown file.
function roleOf (path) {
  if (path.endsWith('.md')) return { role: 'ignore' }
  const rest = path.slice(TYPES_PREFIX.length)
  const parts = rest.split('/')
  if (parts[0] === SHARED_DIR && parts.length === 2 && rest.endsWith('.ts')) {
    return { role: 'shared' }
  }
  // Longest suffix first: `x.claims.ts` and `x.d.ts` both end in `.ts`.
  const order = ['claims-ts', 'claims-js', 'prelude-js', 'prelude-ts']
  for (const role of order) {
    if (rest.endsWith(SUFFIX[role]) && parts.length > 1) {
      return {
        role,
        md: `${SKILLS_PREFIX}${rest.slice(0, -SUFFIX[role].length)}.md`,
      }
    }
  }
  return { role: 'unknown' }
}

const stemOf = (md) => md.slice(SKILLS_PREFIX.length, -'.md'.length)
const preludePath = (md, role) => `${TYPES_PREFIX}${stemOf(md)}${SUFFIX[role]}`
const skillOf = (md) => md.slice(SKILLS_PREFIX.length).split('/')[0]

// Generated files mirror example-types/, so that a prelude's relative import
// of ../_shared/result resolves from where its module sits.
const cacheFile = (stem, suffix) => hostKey(join(CACHE, `${stem}${suffix}`))

// ---------------------------------------------------------------------------
// Reading a TypeScript file

function parse (name, text, kind = ts.ScriptKind.TS) {
  return ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, kind)
}

const lineOf = (sf, position) => sf.getLineAndCharacterOfPosition(position).line

// What an import statement binds. An alias keeps its imported name, so two
// statements can be compared for saying the same thing.
function bindingsOf (node) {
  const clause = node.importClause
  const found = []
  if (clause === undefined) return found
  if (clause.name !== undefined) {
    found.push({
      local: clause.name.text,
      imported: 'default',
      kind: 'default',
      typeOnly: clause.isTypeOnly,
    })
  }
  const named = clause.namedBindings
  if (named !== undefined && ts.isNamespaceImport(named)) {
    found.push({
      local: named.name.text,
      imported: '*',
      kind: 'namespace',
      typeOnly: clause.isTypeOnly,
    })
  } else if (named !== undefined) {
    for (const element of named.elements) {
      found.push({
        local: element.name.text,
        imported: (element.propertyName ?? element.name).text,
        kind: 'named',
        typeOnly: clause.isTypeOnly || element.isTypeOnly,
      })
    }
  }
  return found
}

function printImport (source, bindings, typeOnly) {
  const pieces = []
  const standalone = bindings.find((b) => b.kind === 'default')
  const namespace = bindings.find((b) => b.kind === 'namespace')
  const named = bindings.filter((b) => b.kind === 'named')
  if (standalone) pieces.push(standalone.local)
  if (namespace) pieces.push(`* as ${namespace.local}`)
  if (named.length > 0) {
    const inner = named.map((b) => {
      const spelled = b.imported === b.local ? b.local : `${b.imported} as ${b.local}`
      return b.typeOnly && !typeOnly ? `type ${spelled}` : spelled
    })
    pieces.push(`{ ${inner.join(', ')} }`)
  }
  return `import ${typeOnly ? 'type ' : ''}${pieces.join(', ')} ` +
    `from ${JSON.stringify(source)}`
}

// Every module specifier a file reaches for, wherever it writes it.
function specifiersOf (sf) {
  const found = []
  const add = (node, literal) => {
    if (literal !== undefined && ts.isStringLiteralLike(literal)) {
      found.push({
        specifier: literal.text,
        line: lineOf(sf, node.getStart(sf)) + 1,
      })
    }
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node, node.moduleSpecifier)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, node.argument.literal)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      add(node, node.arguments[0])
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression)
    } else if (
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      add(node, node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  // `/// <reference types="..." />` pulls a package in without an import.
  for (const directive of sf.typeReferenceDirectives) {
    found.push({
      specifier: directive.fileName,
      line: lineOf(sf, directive.pos) + 1,
    })
  }
  return found
}

// 'next/cache' is the package 'next'; '@standard-schema/spec' is its own.
function packageOf (specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

// Top-level names a file declares, in the value and the type namespace
// separately: `const T` beside `type T` is an idiom, not a clash. Imports are
// not counted here; they are counted once all of a file's imports are known.
function declaredNames (sf) {
  const values = new Set()
  const types = new Set()
  const bind = (name) => {
    if (ts.isIdentifier(name)) {
      values.add(name.text)
      return
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) bind(element.name)
    }
  }
  for (const node of sf.statements) {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        bind(declaration.name)
      }
    } else if (ts.isFunctionDeclaration(node)) {
      if (node.name) values.add(node.name.text)
    } else if (
      ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) ||
      (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name))
    ) {
      if (node.name) {
        values.add(node.name.text)
        types.add(node.name.text)
      }
    } else if (
      ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)
    ) {
      types.add(node.name.text)
    }
  }
  return { values, types }
}

// ---------------------------------------------------------------------------
// The rules a prelude, a shared file and a claims file keep

const DIRECTIVE = /(?:\/\/|\/\*|\*)\s*@ts-(ignore|nocheck|expect-error)\b/

function isConstAssertion (node) {
  return ts.isTypeReferenceNode(node.type) &&
    ts.isIdentifier(node.type.typeName) &&
    node.type.typeName.text === 'const'
}

// An `unknown` that stands as the whole type of a parameter accepts anything,
// which is how a prelude hides a wrong argument. As a property, a return
// type, a type argument or a value it is the honest type of something that
// came from outside, and as the parameter of a type guard it is what a guard
// needs.
function dodgesWithUnknown (node) {
  const parent = node.parent
  if (ts.isParameter(parent) && parent.type === node) {
    const fn = parent.parent
    return !(fn.type !== undefined && ts.isTypePredicateNode(fn.type))
  }
  return false
}

// What a prelude or a claims file may not contain, however it is spelled. A
// claim may cast: xstate is told a type with `{} as T`, and a claim that
// builds a machine the way the fence does has to say so the same way.
function guardProblems (file, text, sf, claims) {
  const problems = []
  const note = (node, message) => problems.push({
    file, line: lineOf(sf, node.getStart(sf)) + 1, message,
  })
  const believes = 'tells the check what to believe instead of what to prove'
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      note(node, 'any turns the check off for everything that touches it. ' +
        'Declare the shape the example needs.')
    } else if (
      !claims && node.kind === ts.SyntaxKind.UnknownKeyword &&
      dodgesWithUnknown(node)
    ) {
      note(node, 'unknown as the whole type of a parameter accepts anything, ' +
        'which hides a wrong argument. Declare the shape the example passes.')
    } else if (
      ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) &&
      node.typeName.text === 'Function'
    ) {
      note(node, 'Function is callable with anything and answers with any. ' +
        'Declare the signature the example calls.')
    } else if (
      !claims && node.kind === ts.SyntaxKind.NeverKeyword &&
      ts.isVariableDeclaration(node.parent) && node.parent.type === node
    ) {
      note(node, 'a value of type never is assignable to anything, which ' +
        'hides a wrong value. Declare the type the example uses.')
    } else if (!claims && ts.isAsExpression(node) && !isConstAssertion(node)) {
      note(node, `a cast ${believes}`)
    } else if (!claims && ts.isTypeAssertionExpression(node)) {
      note(node, `a cast ${believes}`)
    } else if (!claims && ts.isNonNullExpression(node)) {
      note(node, `a non-null assertion ${believes}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  text.split('\n').forEach((line, index) => {
    const found = DIRECTIVE.exec(line)
    if (found === null || (claims && found[1] === 'expect-error')) return
    problems.push({
      file,
      line: index + 1,
      message: `@ts-${found[1]} would silence the check it is there for`,
    })
  })
  return problems
}

// A prelude declares; it does not define. A body or a value is code that
// could have been in the example, and code in a prelude is code nobody reads
// as part of it.
function shapeProblems (file, sf, role) {
  const problems = []
  const note = (node, message) => problems.push({
    file, line: lineOf(sf, node.getStart(sf)) + 1, message,
  })
  const ambient = (node) => (ts.getModifiers(node) ?? [])
    .some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
  for (const node of sf.statements) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (role === 'prelude-js') {
        note(node, 'an ambient prelude is global to the check, and an import ' +
          'would make it a module that nothing sees. Write import("pkg").Name ' +
          'in the type instead.')
      }
    } else if (
      ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ||
      ts.isEmptyStatement(node)
    ) {
      continue
    } else if (ts.isVariableStatement(node)) {
      if (!ambient(node)) {
        note(node, 'declare the value with `declare const name: Type`; a ' +
          'prelude does not define one')
      } else if (node.declarationList.declarations.some((d) => d.initializer)) {
        note(node, 'a declared value has a type and no initialiser')
      }
    } else if (ts.isFunctionDeclaration(node)) {
      if (!ambient(node) || node.body !== undefined) {
        note(node, 'declare the function with `declare function name(...): ' +
          'Type;` and no body')
      }
    } else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
      note(node, 'a prelude does not stand in for a package. Pin the package ' +
        'and import it, or declare the names the example uses.')
    } else if (
      ts.isClassDeclaration(node) || ts.isModuleDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      if (!ambient(node)) note(node, 'declare it with `declare`')
    } else {
      note(node, 'a prelude holds imports, types and declarations, and ' +
        'nothing else')
    }
  }
  return problems
}

// A prelude, a shared file or a claims file, read: what it declares, what it
// imports, and what is wrong with it.
function readSupport (file, text, role) {
  const sf = parse(file, text)
  const bindings = new Map()
  for (const node of sf.statements) {
    if (!ts.isImportDeclaration(node)) continue
    for (const binding of bindingsOf(node)) {
      bindings.set(binding.local, {
        ...binding, source: node.moduleSpecifier.text,
      })
    }
  }
  const claims = role.startsWith('claims')
  return {
    file,
    text,
    role,
    bindings,
    ...declaredNames(sf),
    specifiers: specifiersOf(sf).map((s) => ({ ...s, file })),
    problems: [
      ...guardProblems(file, text, sf, claims),
      ...(claims ? [] : shapeProblems(file, sf, role)),
    ],
  }
}

// ---------------------------------------------------------------------------
// One fence

// A function body with no statement in it and a comment where the statements
// would be: the comment says the code is not shown.
function isElision (code, block, sf) {
  const inner = code.slice(block.getStart(sf) + 1, block.end - 1)
  const bare = inner.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
  return bare.trim() === '' && bare !== inner
}

// Reads a fence into the edits that make it part of a module, without
// changing its line count: each line of the result is the line of the fence
// it came from, which is what lets a compiler message be put back on the
// Markdown line that caused it.
function analyseFence (fence, kind, freshName) {
  const code = fence.code
  const sf = parse(`fence.${fence.lang}`, code, kind)
  const edits = []
  const imports = []
  const problems = []
  const defaults = []
  let elided = 0

  const mdLine = (node) => fence.line + 1 + lineOf(sf, node.getStart(sf))
  // A statement's text, less everything but its newlines.
  const erase = (node) => {
    const start = node.getStart(sf)
    edits.push({
      start, end: node.end, text: code.slice(start, node.end).replace(/[^\n]/g, ''),
    })
  }

  for (const node of sf.statements) {
    if (ts.isImportDeclaration(node)) {
      const source = node.moduleSpecifier.text
      const bindings = bindingsOf(node)
      if (source.startsWith('.')) {
        // Every fence of a file is one module, so the names a relative
        // import brings are already here. An alias cannot be kept by
        // dropping the statement, so it is refused rather than guessed at.
        const odd = bindings.find((b) => b.kind !== 'named' || b.imported !== b.local)
        if (odd !== undefined) {
          problems.push({
            line: mdLine(node),
            message: `import of ${odd.local} from "${source}" cannot be ` +
              'dropped as written; only a plain named import of a sibling ' +
              'module can be',
          })
        }
      } else {
        imports.push({
          source,
          bindings,
          typeOnly: node.importClause?.isTypeOnly ?? false,
          line: mdLine(node),
          text: code.slice(node.getStart(sf), node.end),
        })
      }
      erase(node)
    } else if (ts.isExportDeclaration(node)) {
      erase(node)
    } else if (ts.isExportAssignment(node)) {
      if (node.isExportEquals) continue
      const start = node.getStart(sf)
      const head = /^export\s+default\s+/.exec(code.slice(start))
      const name = freshName()
      defaults.push(name)
      edits.push({ start, end: start + head[0].length, text: `const ${name} = ` })
    } else if (ts.canHaveModifiers(node)) {
      const exported = (ts.getModifiers(node) ?? [])
        .find((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (exported === undefined) continue
      const start = exported.getStart(sf)
      const head = /^export(?:\s+default)?\s+/.exec(code.slice(start))
      edits.push({
        start, end: start + head[0].length, text: head[0].replace(/[^\n]/g, ''),
      })
      const anonymous = /default/.test(head[0]) && node.name === undefined &&
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
      if (anonymous) {
        const rest = start + head[0].length
        const keyword = /^(?:async\s+)?(?:function\s*\*?|class)/.exec(code.slice(rest))
        const name = freshName()
        defaults.push(name)
        edits.push({
          start: rest + keyword[0].length,
          end: rest + keyword[0].length,
          text: ` ${name}`,
        })
      }
    }
  }

  const visit = (node) => {
    if (
      ts.isFunctionLike(node) && node.body !== undefined &&
      ts.isBlock(node.body) && node.body.statements.length === 0 &&
      !ts.isConstructorDeclaration(node) && !ts.isSetAccessorDeclaration(node) &&
      isElision(code, node.body, sf)
    ) {
      const at = node.body.getStart(sf) + 1
      edits.push({ start: at, end: at, text: THROW_ELIDED })
      elided++
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  let text = code
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end)
  }
  const lines = text.replace(/\n$/, '').split('\n')
  lines.forEach((line, index) => {
    const found = /(?:\/\/|\/\*|\*)\s*@ts-(ignore|nocheck)\b/.exec(line)
    if (found !== null) {
      problems.push({
        line: fence.line + 1 + index,
        message: `@ts-${found[1]} in an example would silence this check`,
      })
    }
  })
  const declared = declaredNames(sf)
  for (const name of defaults) declared.values.add(name)
  return {
    lines,
    imports,
    problems,
    elided,
    specifiers: specifiersOf(sf).map((s) => ({
      specifier: s.specifier, line: fence.line + s.line, file: fence.file,
    })),
    ...declared,
  }
}

// ---------------------------------------------------------------------------
// One module

// Builds the module for one language of one Markdown file. `origin[n]` says
// which file and line the n-th line (from 0) of the text came from, so that a
// message about the module can be put where a person can act on it. For
// JavaScript the prelude is not part of the module, since a .js module cannot
// carry a declaration; the compiler is given it beside the module instead.
function buildModule ({ md, lang, ext, fences, prelude, claims }) {
  const lines = []
  const origin = []
  const problems = []
  const push = (text, file, line) => {
    lines.push(text)
    origin.push({ file, line })
  }
  const pushText = (text, file, first = 1) => {
    if (text === '') return
    text.replace(/\n$/, '').split('\n').forEach((line, index) => {
      push(line, file, first + index)
    })
  }
  const kind = ext === '.tsx'
    ? ts.ScriptKind.TSX
    : lang === 'js' ? ts.ScriptKind.JS : ts.ScriptKind.TS
  let defaults = 0
  const freshName = () => `__default${++defaults}`

  push(`// Generated by scripts/validate-types.mjs from ${md}. Do not edit.`, md, 1)
  if (lang === 'ts') pushText(prelude.text, prelude.file)

  const provided = new Map(prelude.bindings)
  const declared = {
    values: new Set(prelude.values),
    types: new Set(prelude.types),
  }

  const analysed = fences.map((fence) => ({
    fence, ...analyseFence(fence, kind, freshName),
  }))
  const sideEffects = new Set()
  for (const { imports, problems: found } of analysed) {
    problems.push(...found.map((p) => ({ file: md, ...p })))
    for (const record of imports) {
      const kept = []
      for (const binding of record.bindings) {
        const earlier = provided.get(binding.local)
        if (earlier === undefined) {
          kept.push(binding)
          provided.set(binding.local, { ...binding, source: record.source })
        } else if (
          earlier.source !== record.source || earlier.imported !== binding.imported
        ) {
          problems.push({
            file: md,
            line: record.line,
            message: `${binding.local} is imported from "${record.source}" ` +
              `here and from "${earlier.source}" elsewhere in this file`,
          })
        } else if (earlier.typeOnly && !binding.typeOnly) {
          // Dropping the fence's import as a repeat would leave a name that
          // can only be a type where the example uses it as a value.
          problems.push({
            file: md,
            line: record.line,
            message: `${binding.local} is imported here as a value and by ` +
              'the prelude with `import type`; import it without `type` in ' +
              'the prelude',
          })
        }
      }
      if (record.bindings.length === 0) {
        if (sideEffects.has(record.source)) continue
        sideEffects.add(record.source)
        pushText(record.text, md, record.line)
      } else if (kept.length === record.bindings.length) {
        pushText(record.text, md, record.line)
      } else if (kept.length > 0) {
        push(printImport(record.source, kept, record.typeOnly), md, record.line)
      }
    }
  }
  // An import binds a name for the whole module, so a fence that declares
  // the same name has to go in a block.
  for (const local of provided.keys()) {
    declared.values.add(local)
    declared.types.add(local)
  }

  let elided = 0
  analysed.forEach(({ fence, lines: code, values, types, elided: n }, index) => {
    const clash = [...values].some((name) => declared.values.has(name)) ||
      [...types].some((name) => declared.types.has(name))
    const close = fence.line + code.length + 1
    push(
      `// ---- fence ${index + 1} of ${fences.length} (${md}:${fence.line})` +
        (clash ? '; wrapped in a block' : ''),
      md, fence.line,
    )
    if (clash) {
      push('{', md, fence.line)
    } else {
      for (const name of values) declared.values.add(name)
      for (const name of types) declared.types.add(name)
    }
    code.forEach((line, offset) => push(line, md, fence.line + 1 + offset))
    if (clash) push('}', md, close)
    // A fence that ends without a semicolon must not run into the next.
    push(';', md, close)
    elided += n
  })

  if (claims !== null) {
    push('// ---- claims the prose makes, checked here', claims.file, 1)
    pushText(claims.text, claims.file)
  }
  // Makes the text a module however little it imports or exports. It sits on
  // the line before it, so a message about it lands where the text ends.
  push('export {}', origin.at(-1).file, origin.at(-1).line)

  return {
    md,
    lang,
    ext,
    text: `${lines.join('\n')}\n`,
    origin,
    problems,
    elided,
    examples: fences.length,
    bindings: [...provided.values()],
    specifiers: analysed.flatMap((a) => a.specifiers),
  }
}

// ---------------------------------------------------------------------------
// The compiler

function createHost (options, virtual) {
  const host = ts.createCompilerHost(options, true)
  const real = {
    fileExists: host.fileExists.bind(host),
    directoryExists: host.directoryExists.bind(host),
    readFile: host.readFile.bind(host),
    getSourceFile: host.getSourceFile.bind(host),
  }
  // A generated file's directory exists as far as the compiler is concerned,
  // whether or not anything has been written there yet.
  const directories = new Set()
  for (const file of virtual.keys()) {
    for (let at = hostKey(dirname(file)); !directories.has(at); at = hostKey(dirname(at))) {
      directories.add(at)
      if (hostKey(dirname(at)) === at) break
    }
  }
  host.fileExists = (file) => virtual.has(file) || real.fileExists(file)
  host.directoryExists = (dir) => directories.has(dir) || real.directoryExists(dir)
  host.readFile = (file) => virtual.get(file) ?? real.readFile(file)
  host.getSourceFile = (file, languageVersion, onError, shouldCreate) => {
    const text = virtual.get(file)
    if (text !== undefined) return ts.createSourceFile(file, text, languageVersion)
    if (LIBRARY_FILES.has(file)) return LIBRARY_FILES.get(file)
    const found = real.getSourceFile(file, languageVersion, onError, shouldCreate)
    if (found !== undefined) LIBRARY_FILES.set(file, found)
    return found
  }
  return host
}

// A message names the files it means by absolute path, and the same message
// printed on another machine should read the same.
const messageOf = (diagnostic) => ts.flattenDiagnosticMessageText(
  diagnostic.messageText, ' ',
).replaceAll(hostKey(ROOT), '.')

// Every diagnostic in the files of ours that the program holds, put back where
// a person can act on it by `where(file, line)`, with `line` counted from 0.
function diagnose (program, files, where) {
  const found = []
  for (const diagnostic of [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ]) {
    found.push({
      file: 'compiler options',
      code: `TS${diagnostic.code}`,
      message: messageOf(diagnostic),
    })
  }
  for (const file of files) {
    const sf = program.getSourceFile(file)
    if (sf === undefined) {
      found.push({ file, message: 'the compiler did not read this file' })
      continue
    }
    for (const diagnostic of [
      ...program.getSyntacticDiagnostics(sf),
      ...program.getSemanticDiagnostics(sf),
    ]) {
      const at = diagnostic.start === undefined ? 0 : lineOf(sf, diagnostic.start)
      found.push({
        ...where(file, at),
        code: `TS${diagnostic.code}`,
        message: messageOf(diagnostic),
      })
    }
  }
  return found
}

// ---------------------------------------------------------------------------
// Prose

const CHAIN = /(?<![\w$.])([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*){1,2})/g

// `Name.member` and `Name.member.member` in inline code, for each Name this
// file imports from an example library.
function proseChains (text, names) {
  const found = []
  for (const { line, code } of inlineCodeSpans(text)) {
    for (const match of code.matchAll(CHAIN)) {
      if (names.has(match[1])) {
        found.push({ line, name: match[1], chain: `${match[1]}${match[2]}` })
      }
    }
  }
  return found
}

function importFor (binding) {
  const source = JSON.stringify(binding.source)
  if (binding.kind === 'default') return `import ${binding.local} from ${source}`
  if (binding.kind === 'namespace') return `import * as ${binding.local} from ${source}`
  return binding.imported === binding.local
    ? `import { ${binding.local} } from ${source}`
    : `import { ${binding.imported} as ${binding.local} } from ${source}`
}

// ---------------------------------------------------------------------------
// The check

// `documents` is every Markdown file with examples, with what stands beside
// it. Taking them as values rather than paths is what lets --selftest run the
// whole check on text that exists nowhere on disk. `whole` turns on the rules
// that only mean something over the entire pack. `onGenerated` is handed
// every generated file before the compiler runs, so that a run which dies in
// the compiler still leaves the file it died on.
function checkDocuments ({
  documents, shared = [], notYetCovered = new Set(), whole = false,
  onGenerated = () => {},
}) {
  const problems = []
  const warnings = []
  const stats = { examples: 0, files: 0, elided: 0, chains: 0 }
  const generated = []
  // Every file the compiler is given, and where a line of it came from.
  const registry = new Map()
  const register = (file, text, where) => {
    registry.set(file, { text, where })
    generated.push({ file, text })
  }
  const reaches = []

  const sharedFiles = []
  for (const { file, text } of shared) {
    const info = readSupport(file, text, 'shared')
    problems.push(...info.problems)
    reaches.push(...info.specifiers)
    const key = cacheFile(file.slice(TYPES_PREFIX.length, -'.ts'.length), '.ts')
    register(key, text, (line) => ({ file, line: line + 1 }))
    sharedFiles.push(key)
  }

  const modules = []
  for (const doc of documents) {
    if (notYetCovered.has(doc.md)) {
      warnings.push(`${doc.md} is not yet covered by the type check`)
      continue
    }
    stats.files++
    const all = fencesIn(doc.text, doc.md)
    for (const lang of ['ts', 'js']) {
      const fences = all.filter((f) =>
        lang === 'js' ? f.lang === 'js' : f.lang === 'ts' || f.lang === 'tsx')
      if (fences.length === 0) continue
      const preludeRole = `prelude-${lang}`
      const claimsRole = `claims-${lang}`
      if (doc.files[preludeRole] === undefined) {
        problems.push({
          file: doc.md,
          message: `has no prelude. Add ${preludePath(doc.md, preludeRole)}, ` +
            'which may be empty, to declare what its ' +
            `${lang === 'ts' ? 'TypeScript' : 'JavaScript'} examples assume`,
        })
        continue
      }
      const prelude = readSupport(
        doc.files[preludeRole].file, doc.files[preludeRole].text, preludeRole,
      )
      const claims = doc.files[claimsRole] === undefined
        ? null
        : readSupport(doc.files[claimsRole].file, doc.files[claimsRole].text, claimsRole)
      problems.push(...prelude.problems, ...(claims?.problems ?? []))
      reaches.push(...prelude.specifiers, ...(claims?.specifiers ?? []))
      const ext = lang === 'js'
        ? '.js'
        : fences.some((f) => f.lang === 'tsx') ? '.tsx' : '.ts'
      const module = buildModule({ md: doc.md, lang, ext, fences, prelude, claims })
      module.file = cacheFile(stemOf(doc.md), ext)
      module.prelude = prelude
      module.proseText = doc.text
      problems.push(...module.problems)
      reaches.push(...module.specifiers)
      modules.push(module)
    }
  }

  if (whole) {
    for (const md of notYetCovered) {
      if (!documents.some((d) => d.md === md)) {
        problems.push({
          file: 'scripts/validate-types.mjs',
          message: `NOT_YET_COVERED names ${md}, which has no TypeScript or ` +
            'JavaScript examples. Remove it.',
        })
      }
    }
    for (const file of unusedShared(shared, reaches)) {
      problems.push({
        file,
        message: 'is imported by no prelude and no claims file. Remove it, or ' +
          'use it.',
      })
    }
  }

  // Imports must name an example library; a relative one is a prelude
  // reaching for a shared file.
  const imported = new Set()
  for (const { specifier, line, file } of reaches) {
    const name = packageOf(specifier)
    if (name === null) continue
    imported.add(name)
    if (!LIBRARIES.includes(name)) {
      problems.push({
        file,
        line,
        message: `imports "${specifier}", and ${name} is not one of the ` +
          'example libraries. `npm install --save-dev --save-exact` it and ' +
          'name it in LIBRARIES in scripts/validate-types.mjs.',
      })
    }
  }
  if (whole) {
    for (const name of LIBRARIES) {
      const types = name.startsWith('@types/') ? name.slice('@types/'.length) : null
      if (imported.has(name) || (types !== null && imported.has(types))) continue
      problems.push({
        file: 'scripts/validate-types.mjs',
        message: `${name} is on the list of example libraries and nothing ` +
          'imports it. Remove it from LIBRARIES and from package.json, or ' +
          'write the example that uses it.',
      })
    }
  }

  // One probe pair for each distinct prose name: the name as a value and the
  // name as a type. Both must fail for it to be reported.
  const probes = new Map()
  for (const module of modules) {
    const names = new Map()
    for (const binding of module.bindings) {
      const name = packageOf(binding.source)
      if (name !== null && LIBRARIES.includes(name)) names.set(binding.local, binding)
    }
    if (names.size === 0) continue
    for (const found of proseChains(module.proseText, names)) {
      const binding = names.get(found.name)
      const key = `${importFor(binding)} ${found.chain}`
      if (!probes.has(key)) {
        probes.set(key, {
          binding,
          chain: found.chain,
          base: cacheFile(`__prose/${probes.size}`, ''),
          sites: [],
        })
      }
      probes.get(key).sites.push({ file: module.md, line: found.line })
    }
  }
  const probeFiles = []
  for (const probe of probes.values()) {
    const header = `${importFor(probe.binding)}\n`
    for (const [form, body] of [
      ['value', `const probe = ${probe.chain}`],
      ['type', `type Probe = ${probe.chain}`],
    ]) {
      const file = `${probe.base}-${form}.ts`
      register(file, `${header}${body}\nexport {}\n`, () => ({ file }))
      probeFiles.push(file)
    }
  }

  const tsModules = modules.filter((m) => m.lang === 'ts')
  for (const module of modules) {
    register(module.file, module.text, (line) => module.origin[line] ?? module.origin.at(-1))
    if (module.lang === 'js') {
      module.preludeFile = cacheFile(stemOf(module.md), '.prelude.ts')
      register(module.preludeFile, module.prelude.text, (line) => ({
        file: module.prelude.file, line: line + 1,
      }))
    }
  }
  onGenerated(generated)

  const virtualFor = (files) => new Map(files.map((f) => [f, registry.get(f).text]))
  const whereIn = (file, line) => registry.get(file).where(line)

  // All the TypeScript is one program: the modules, the shared files, and
  // the prose probes.
  const tsRoots = [...sharedFiles, ...tsModules.map((m) => m.file), ...probeFiles]
  if (tsRoots.length > 0) {
    const program = ts.createProgram(
      tsRoots, COMPILER_OPTIONS,
      createHost(COMPILER_OPTIONS, virtualFor(tsRoots)),
    )
    problems.push(...diagnose(program, [...sharedFiles, ...tsModules.map((m) => m.file)], whereIn))
    const fails = (file) => {
      const sf = program.getSourceFile(file)
      return [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)]
        .some((d) => NO_SUCH_MEMBER.has(d.code))
    }
    for (const probe of probes.values()) {
      stats.chains += probe.sites.length
      if (!fails(`${probe.base}-value.ts`) || !fails(`${probe.base}-type.ts`)) continue
      for (const site of probe.sites) {
        problems.push({
          ...site,
          message: `prose names ${probe.chain}, and ${probe.binding.source} ` +
            'has no such member, as a value or as a type',
        })
      }
    }
  }

  // JavaScript: a program of its own for each file, because its prelude is
  // global and one file's globals must not meet another's. The library files
  // they share are parsed once.
  for (const module of modules.filter((m) => m.lang === 'js')) {
    const roots = [module.file, module.preludeFile]
    const program = ts.createProgram(
      roots, JS_OPTIONS,
      createHost(JS_OPTIONS, virtualFor(roots)),
    )
    problems.push(...diagnose(program, roots, whereIn))
  }

  for (const module of modules) {
    stats.examples += module.examples
    stats.elided += module.elided
  }
  // One report per defect, in the order a person would read the files.
  const seen = new Set()
  const unique = problems.filter((p) => {
    const key = JSON.stringify([p.file, p.line, p.code, p.message])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) =>
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.message < b.message ? -1 : a.message > b.message ? 1 : 0))
  return { problems: unique, warnings, stats, generated, imported }
}

// Shared files no prelude, claims file or shared file reaches by a relative
// import: a declaration nothing uses has nothing to say about an example.
function unusedShared (shared, reaches) {
  const used = new Set()
  for (const { specifier, file } of reaches) {
    if (!specifier.startsWith('.')) continue
    used.add(posix.normalize(posix.join(posix.dirname(file), specifier)))
  }
  return shared
    .map((s) => s.file)
    .filter((file) => !used.has(file.slice(0, -'.ts'.length)))
}

// ---------------------------------------------------------------------------
// Reading the repository

// Every Markdown file with TypeScript or JavaScript examples, with the files
// that stand beside it, and the files under example-types/ that stand beside
// nothing.
function loadDocuments () {
  const problems = []
  const documents = []
  const byMd = new Map()
  for (const path of skillMarkdownFiles()) {
    const md = repoPath(path)
    const text = readMarkdown(path)
    const langs = new Set(fencesIn(text, md).map((f) => f.lang))
    const hasTs = langs.has('ts') || langs.has('tsx')
    const hasJs = langs.has('js')
    if (!hasTs && !hasJs) continue
    const doc = { md, text, langs: { ts: hasTs, js: hasJs }, files: {} }
    documents.push(doc)
    byMd.set(md, doc)
  }
  const shared = []
  for (const absolute of exampleTypeFiles()) {
    const file = repoPath(absolute)
    const { role, md } = roleOf(file)
    if (role === 'ignore') continue
    if (role === 'unknown') {
      problems.push({
        file,
        message: 'is not a prelude, a claims file or a shared declaration. A ' +
          'prelude is named after the Markdown file it stands beside.',
      })
      continue
    }
    const text = readSource(absolute)
    if (role === 'shared') {
      shared.push({ file, text })
      continue
    }
    const doc = byMd.get(md)
    const lang = role.endsWith('js') ? 'js' : 'ts'
    if (doc === undefined || !doc.langs[lang]) {
      problems.push({
        file,
        message: `stands beside no Markdown file with ` +
          `${lang === 'ts' ? 'TypeScript' : 'JavaScript'} examples. It would ` +
          `be for ${md}.`,
      })
      continue
    }
    doc.files[role] = { file, text }
  }
  return { documents, shared, problems }
}

// What package.json pins is what node_modules must hold, or the examples are
// checked against a library nobody asked for.
function libraryProblems () {
  const problems = []
  const pinned = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies ?? {}
  const versions = {}
  for (const name of LIBRARIES) {
    if (pinned[name] === undefined) {
      problems.push({
        file: 'package.json',
        message: `${name} is on the list of example libraries and is not in ` +
          'devDependencies',
      })
      continue
    }
    const manifest = join(ROOT, 'node_modules', name, 'package.json')
    if (!existsSync(manifest)) {
      problems.push({
        file: 'package.json',
        message: `${name} is pinned and not installed. Run npm ci.`,
      })
      continue
    }
    versions[name] = JSON.parse(readFileSync(manifest, 'utf8')).version
    if (versions[name] !== pinned[name]) {
      problems.push({
        file: 'package.json',
        message: `${name} is pinned to ${pinned[name]} and ${versions[name]} ` +
          'is installed. Run npm ci.',
      })
    }
  }
  return { problems, versions }
}

function writeCache (files) {
  rmSync(CACHE, { recursive: true, force: true })
  for (const { file, text } of files) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

function formatProblem (p) {
  const where = p.line === undefined ? p.file : `${p.file}:${p.line}`
  return `error ${where}  ${p.code ? `${p.code}: ` : ''}${p.message}`
}

function main (argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null
  if (only !== null && !skillIds().includes(only)) {
    process.stderr.write(`error --only names ${only}, which is not a skill\n`)
    process.exit(1)
  }
  const loaded = loadDocuments()
  const libraries = libraryProblems()
  const documents = only === null
    ? loaded.documents
    : loaded.documents.filter((d) => skillOf(d.md) === only)
  const result = checkDocuments({
    documents,
    shared: loaded.shared,
    notYetCovered: new Set(NOT_YET_COVERED),
    whole: only === null,
    onGenerated: writeCache,
  })
  const problems = [
    ...(only === null ? loaded.problems : []),
    ...libraries.problems,
    ...result.problems,
  ]
  if (result.stats.examples === 0) {
    problems.push({
      file: 'plugin/skills',
      message: 'no TypeScript or JavaScript example was checked, so this ' +
        'check measured nothing',
    })
  }
  if (only === null && result.stats.chains === 0) {
    problems.push({
      file: 'plugin/skills',
      message: 'no library name in prose was resolved, so nothing checked ' +
        'that prose names members that exist',
    })
  }

  for (const warning of result.warnings) process.stdout.write(`warn  ${warning}\n`)
  for (const problem of problems) process.stderr.write(`${formatProblem(problem)}\n`)
  if (problems.length > 0) {
    process.stderr.write(`\n${problems.length} type error(s) in the examples\n`)
    process.exit(1)
  }

  const used = [...result.imported].sort()
  for (const name of [...used]) {
    if (LIBRARIES.includes(`@types/${name}`)) used.push(`@types/${name}`)
  }
  const listed = used.sort().map((name) => `${name}@${libraries.versions[name]}`)
  process.stdout.write(
    `ok    ${result.stats.examples} example(s) in ${result.stats.files} ` +
      'file(s) type-check\n',
  )
  process.stdout.write(`      ${listed.join(', ')}\n`)
  if (result.stats.elided > 0) {
    process.stdout.write(
      `      ${result.stats.elided} function(s) shown with only a comment for ` +
        'a body, read as throwing\n',
    )
  }
  process.stdout.write(
    `ok    ${result.stats.chains} library name(s) in prose resolve\n`,
  )
}

// ---------------------------------------------------------------------------
// Proving the check fires

function selftest () {
  const doc = (name, text, files = {}) => {
    const md = `${SKILLS_PREFIX}selftest/${name}.md`
    const entry = {}
    for (const [role, body] of Object.entries(files)) {
      entry[role] = { file: preludePath(md, role), text: body }
    }
    return { md, text, files: entry }
  }
  const fence = (lang, code) => `\`\`\`${lang}\n${code}\n\`\`\`\n`
  const prelude = (body = '') => ({ 'prelude-ts': body })

  const cases = [
    {
      label: 'a member the library does not have',
      doc: doc('member', `# T\n\n${fence('ts', 'import { match } from "ts-pattern";\nmatch(1).nope();')}`, prelude()),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.line === 5 &&
        p.code === 'TS2339' && p.message.includes('nope')),
    },
    {
      label: 'a name that neither the fence, the prelude nor an earlier fence defines',
      doc: doc('unknown-name', `# T\n\n${fence('ts', 'const a = 1;')}\n${fence('ts', 'const b = a + missing;')}`, prelude()),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.line === 8 &&
        p.code === 'TS2304' && p.message.includes('missing')),
    },
    {
      label: 'a name the prelude declares is not an error',
      doc: doc('declared', `# T\n\n${fence('ts', 'const b: number = known + 1;')}`,
        prelude('declare const known: number;')),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0,
    },
    {
      label: 'two fences declaring one name both pass, and the second is wrapped',
      doc: doc('twice', `# T\n\n${fence('ts', 'const a = 1;')}\n${fence('ts', 'const a = "x";')}`, prelude()),
      expect: (r, d) => {
        const text = r.generated.find((g) => g.file.endsWith('/selftest/twice.ts')).text
        return r.problems.filter((p) => p.file === d.md).length === 0 &&
          /fence 2 of 2 [^\n]*; wrapped in a block\n\{/.test(text) &&
          !/fence 1 of 2 [^\n]*wrapped/.test(text)
      },
    },
    {
      label: 'an import in a fence is hoisted, and not doubled when the prelude has it',
      doc: doc('hoist',
        `# T\n\n${fence('ts', 'import { produce } from "immer";\nproduce({ a: 1 }, (d) => { d.a = 2; });')}\n` +
        `${fence('ts', 'import { produce, current } from "immer";\nconst c = current;')}`,
      prelude('import { produce } from "immer";')),
      expect: (r, d) => {
        const text = r.generated.find((g) => g.file.endsWith('/selftest/hoist.ts')).text
        return r.problems.filter((p) => p.file === d.md).length === 0 &&
          text.match(/import \{ produce \} from "immer"/g).length === 1 &&
          text.includes('import { current } from "immer"')
      },
    },
    {
      label: 'export default async function in two fences of one file',
      doc: doc('defaults',
        `# T\n\n${fence('tsx', 'export default async function Page() { return 1; }')}\n` +
        `${fence('tsx', 'export default async function Page() { return "two"; }')}`, prelude()),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0,
    },
    {
      label: 'an anonymous default export gets a name',
      doc: doc('anonymous',
        `# T\n\n${fence('ts', 'export default function () { return 1; }')}\n` +
        `${fence('ts', 'export default function () { return 2; }')}\n` +
        `${fence('ts', 'export default { a: 1 };')}\n` +
        `${fence('ts', 'export default { b: 2 };')}`, prelude()),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0,
    },
    {
      label: 'a tsx fence with JSX is read as tsx',
      doc: doc('jsx',
        `# T\n\n${fence('tsx', 'const view = <Box label="a" />;')}`,
        prelude('import type { JSX } from "react";\n' +
          'declare const Box: (props: { readonly label: string }) => JSX.Element;')),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0,
    },
    {
      label: 'a prelude that imports as a type what a fence uses as a value',
      doc: doc('type-only',
        `# T\n\n${fence('ts', 'import { produce } from "immer";\nproduce({ a: 1 }, () => {});')}`,
        prelude('import type { produce } from "immer";')),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.line === 4 &&
        p.message.includes('import type')),
    },
    {
      label: 'a diagnostic lands on the right Markdown line inside a list item',
      doc: doc('indented', '# T\n\n1. Step one.\n\n   ```ts\n   const a = 1;\n   const b: string = a;\n   ```\n', prelude()),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.line === 7 &&
        p.code === 'TS2322'),
    },
    {
      label: 'a body that is only a comment reads as throwing',
      doc: doc('elided', `# T\n\n${fence('ts', 'const f = (): number => {\n  /* ... */\n};')}`, prelude()),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0 &&
        r.stats.elided === 1,
    },
    {
      label: 'an empty body with no comment is still an error',
      doc: doc('empty-body', `# T\n\n${fence('ts', 'const f = (): number => {};')}`, prelude()),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.code === 'TS2355'),
    },
    {
      label: 'a relative import is dropped, its names defined by an earlier fence',
      doc: doc('relative',
        `# T\n\n${fence('ts', 'export const sampleFor = (tag: string) => tag;')}\n` +
        `${fence('ts', 'import { sampleFor } from "./shipment.js";\nsampleFor("a");')}`, prelude()),
      expect: (r, d) => r.problems.filter((p) => p.file === d.md).length === 0,
    },
    {
      label: 'a claim under @ts-expect-error that is not an error is reported',
      doc: doc('claims', `# T\n\n${fence('ts', 'const a = 1;')}`,
        { ...prelude(), 'claims-ts': '// @ts-expect-error\nconst n: number = "x";\n' +
          '// @ts-expect-error\nconst m: number = a;\n' }),
      expect: (r, d) => {
        const here = r.problems.filter((p) => p.file === d.files['claims-ts'].file)
        return here.length === 1 && here[0].code === 'TS2578' && here[0].line === 3
      },
    },
    {
      label: 'a prelude imports a shared declaration, and a wrong value is reported',
      shared: [{
        file: `${TYPES_PREFIX}${SHARED_DIR}/sample.ts`,
        text: 'export type Id = string;\n',
      }],
      doc: doc('shared', `# T\n\n${fence('ts', 'const fine: Id = "a";\nconst wrong: Id = 1;')}`,
        prelude('import type { Id } from "../_shared/sample";')),
      expect: (r, d) => r.problems.length === 1 && r.problems[0].file === d.md &&
        r.problems[0].line === 5 && r.problems[0].code === 'TS2322',
    },
    {
      label: 'a Markdown file with examples and no prelude',
      doc: doc('bare', `# T\n\n${fence('ts', 'const a = 1;')}`),
      expect: (r, d) => r.problems.some((p) => p.file === d.md &&
        p.message.includes('has no prelude')),
    },
    {
      label: 'a package that is not an example library',
      doc: doc('unlisted', `# T\n\n${fence('ts', 'import left from "left-pad";\nleft("a", 3);')}`, prelude()),
      expect: (r, d) => r.problems.some((p) => p.file === d.md && p.line === 4 &&
        p.message.includes('not one of the example libraries')),
    },
    {
      label: 'a prelude containing any is refused',
      doc: doc('any', `# T\n\n${fence('ts', 'const a = 1;')}`, prelude('declare const anything: any;')),
      expect: (r, d) => r.problems.some((p) => p.file === d.files['prelude-ts'].file &&
        p.line === 1 && p.message.startsWith('any ')),
    },
    {
      label: 'a prelude that defines a value instead of declaring one is refused',
      doc: doc('defines', `# T\n\n${fence('ts', 'const a = 1;')}`, prelude('const base = 1;')),
      expect: (r, d) => r.problems.some((p) => p.file === d.files['prelude-ts'].file &&
        p.message.includes('declare const')),
    },
    {
      label: 'a prelude with a directive that silences the check is refused',
      doc: doc('casts', `# T\n\n${fence('ts', 'const a = 1;')}`,
        prelude('declare const n: number;\ndeclare const t: typeof n;\n// @ts-ignore\ndeclare const u: string;')),
      expect: (r, d) => r.problems.some((p) => p.file === d.files['prelude-ts'].file &&
        p.line === 3 && p.message.includes('@ts-ignore')),
    },
    {
      label: 'unknown as a whole parameter type is refused, as a guard parameter is not',
      doc: doc('unknown', `# T\n\n${fence('ts', 'const a = 1;')}`,
        prelude('declare function takes(x: unknown): void;\ndeclare function is(x: unknown): x is string;')),
      expect: (r, d) => {
        const here = r.problems.filter((p) => p.file === d.files['prelude-ts'].file)
        return here.length === 1 && here[0].line === 1
      },
    },
    {
      label: 'a prelude that declares a value as never, or as Function, is refused',
      doc: doc('hollow', `# T\n\n${fence('ts', 'const a = 1;')}`,
        prelude('declare const nothing: never;\ndeclare const anything: Function;')),
      expect: (r, d) => {
        const here = r.problems.filter((p) => p.file === d.files['prelude-ts'].file)
        return here.length === 2 && here[0].line === 1 && here[1].line === 2
      },
    },
    {
      label: 'a prelude that stands in for a package is refused',
      doc: doc('stand-in', `# T\n\n${fence('ts', 'const a = 1;')}`,
        prelude('declare module "left-pad" {\n  export const pad: (s: string) => string;\n}')),
      expect: (r, d) => r.problems.some((p) => p.file === d.files['prelude-ts'].file &&
        p.line === 1 && p.message.includes('stand in for a package')),
    },
    {
      label: 'prose Schema.Schema.Type is not reported and prose Schema.Arbitrary is',
      doc: doc('prose',
        '# T\n\nThe decoded type is `Schema.Schema.Type`, not `Schema.Arbitrary`.\n\n' +
        `${fence('ts', 'const a = 1;')}`,
      prelude('import { Schema } from "effect";')),
      expect: (r, d) => {
        const here = r.problems.filter((p) => p.file === d.md)
        return here.length === 1 && here[0].line === 3 &&
          here[0].message.includes('Schema.Arbitrary') && r.stats.chains === 2
      },
    },
    {
      label: 'JavaScript is checked against its ambient prelude',
      doc: doc('script',
        `# T\n\n${fence('js', 'const r = ok(1);\nr.value.toFixed();\nr.nope;')}`,
        { 'prelude-js': 'declare function ok<T>(value: T): { readonly ok: true; readonly value: T };' }),
      expect: (r, d) => {
        const here = r.problems.filter((p) => p.file === d.md)
        return here.length === 1 && here[0].line === 6 && here[0].code === 'TS2339'
      },
    },
    {
      label: 'a JavaScript prelude that imports is refused',
      doc: doc('script-import', `# T\n\n${fence('js', 'const a = 1;')}`,
        { 'prelude-js': 'import { produce } from "immer";' }),
      expect: (r, d) => r.problems.some((p) => p.file === d.files['prelude-js'].file &&
        p.message.includes('ambient prelude')),
    },
  ]

  // Each case runs the whole check on its own document, so a case sees only
  // its own problems and its own counts.
  for (const { label, doc: d, shared, expect } of cases) {
    const result = checkDocuments({ documents: [d], shared, whole: false })
    const ok = expect(result, d)
    process.stdout.write(`${ok ? 'selftest ok:' : 'selftest FAIL:'} ${label}\n`)
    if (!ok) {
      for (const p of result.problems) process.stderr.write(`  ${formatProblem(p)}\n`)
      process.exit(1)
    }
  }
  process.exit(0)
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) selftest()
else main(argv)
