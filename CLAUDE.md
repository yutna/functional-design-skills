# Agent instructions

This repository contains Agent Skills. Read this before changing
anything in it.

## What is here

`plugin/skills/<name>/SKILL.md` is the single source of truth for each
skill. Every other file — the manifests, the install scripts, this one —
points at those directories. Nothing duplicates skill prose, and a
change that would require editing the same sentence in two places is a
sign the structure is wrong.

Everything the plugin ships lives under `plugin/`. The repository's own
tooling stays outside it, for the reason given under "Files you should
not create".

There are forty-three skills, and every one is named `functional-something`.
The prefix is not decoration: skills install flat into
`~/.claude/skills`, where a name like `hiding-information` is one any
pack might claim, and the second pack to claim it loses. Nine are
language packs, named for the stack; `functional-design` is the index
that routes between everything else; the remaining thirty-three carry
one design rule each. Their `SKILL.md` frontmatter describes when each
applies.

Because the prefix is now on everything, the name no longer says which
group a skill is in. The index's `## Language packs` section is the
list that does, and `scripts/validate-counts.mjs` reads it rather than
keeping a second copy.

## Before you finish any change

```bash
npm test
npm run test:guards
```

`npm test` runs Markdown linting, skill validation, the prose checks, a
parse of every code example, the strictness labels, the documented counts,
and routing coverage. `npm run test:guards`
breaks every guard on a throwaway copy and confirms it still fires. All
of it must pass. Run them as you write, not once at the end; the
line-length rule in particular is easier to satisfy while drafting than
to retrofit.

`npm test` does not check the lock file, but continuous integration
installs with `npm ci`, which fails when `package.json` and
`package-lock.json` disagree. Change a dependency by running
`npm install`, never by editing `package.json` alone.

## Hard constraints

These are not preferences, and a change that breaks one will be
rejected.

- **Markdown must pass `markdownlint` default rules.** There is no
  configuration file, and inline suppression comments are forbidden.
  Adding either to make a file pass is not an acceptable fix; rewrite
  the content instead.
- **Frontmatter stays inside the set Claude Code documents.** The
  validator lists them; the ones used here are `name`, `description`,
  `license`, and `metadata`. A key outside the set is a hard error,
  because it is either a typo or a feature this runtime does not have.
- **Skill content is English only.**
- **Every skill name starts with `functional-`.** See "What is here".
- **`CHANGELOG.md` is a record, not a description.** Its entries say
  what was true when a version shipped, so a rename does not rewrite
  them. A skill that was called `hiding-information` in 2.0.0 is still
  called that in the 2.0.0 entry.
- **A version bump is `npm version`, never a find-and-replace.** The
  number appears in `package.json`, both manifests, and every skill's
  frontmatter, which makes a repository-wide replace tempting. Doing
  that once rewrote twenty-one dependency versions in
  `package-lock.json` that happened to match, and `npm ci` did not
  notice, because it installs from the resolved URL and the integrity
  hash. `validate-skills.mjs` now compares each locked version against
  the URL it resolves to.
- **Dependencies are pinned to an exact version, never a range.** A
  caret range lets a patch release change what `markdownlint` reports,
  and this repository forbids lint configuration, so the build can turn
  red with no content change. `.npmrc` sets `save-exact`; `npm test`
  fails on a range that was added by hand.
- **No citations.** Do not add book titles, author names, publisher
  names, or bibliographic references to any tracked file. The rules
  stay, in this pack's own words with its own examples.
  `validate-prose.mjs` catches the marks that citing leaves behind -- an
  `ISBN`, a chapter number, an edition, a year in parentheses -- but it
  cannot catch a name, so the rule is still yours to keep.
- **Every core rule declares how strictly it is meant.** A numbered item
  under `## Core rules` opens with `Rule.`, `Default.`, or `Judgement.`
  before its bold statement. `Rule` means breaking it is a defect;
  `Default` means do this unless a stated condition holds, and the
  condition belongs in its own sentence rather than appended to the rule;
  `Judgement` means two answers are defensible and the skill says what
  tips it. Without the label every rule reads with the same weight, and
  an agent cannot tell a contract from a preference.
- **Every skill says which pack it came from.** `metadata.pack` must be
  `functional-design-skills`. The installer reads it to tell "already
  installed" from "another pack owns this name", which is the difference
  between a skip and silently missing skills.
- **A pack that extends another says only what it changes.** A skill
  whose name extends another skill's name -- `functional-typescript-effect`
  over `functional-typescript` -- must link to it, and must not repeat a
  paragraph from it. Both are checked.
- **Numbers in prose are checked against reality.** If you write a count
  of skills, scenarios, or cases anywhere in the documentation, add it to
  `scripts/validate-counts.mjs` in the same commit. Counts written by
  hand are counts that drift; three already had.
- **Scripts are JavaScript, shell, or PowerShell, and nothing else.**
  One language for the tooling; the two script pairs exist for Windows.

## Writing rules that follow from the linter

The default rules bite in specific ways. The ones that catch people out:

- Lines are capped at 80 characters, and the cap covers code blocks and
  tables as well as prose.
- Heading text must be unique within a file, across all levels. Do not
  repeat "Example", "Good", or "Why" as headings; use list items with
  bold labels instead.
- Table pipes must align with the header row. A wide comparison table is
  therefore not viable at 80 characters; use headings and lists.
- No inline HTML at all. HTML comments are permitted.
- A line consisting only of emphasis is treated as a heading unless it
  ends in punctuation, so write `**Note:** ...` rather than `**Note**`.
- Every fence needs a language tag. Use `text` for the pack's neutral
  notation.
- A code block inside a numbered list must be indented to the item's
  content column, or the numbering restarts.
- Command examples must not use a `$` prompt prefix.
- Link text may not be `here`, `link`, `click here`, or `more`.

## House style for skills

- `SKILL.md` opens with a single level-one heading and stays under about
  500 lines. Overflow goes to `references/`, one level deep.
- A reference file over 100 lines with three or more sections starts
  with a contents list. `npm test` enforces this.
- `description` opens with `Use when`, states the situations that
  should trigger the skill rather than what it covers, stays under 180
  characters, and is clearly distinct from the other thirty-nine so
  routing works.
- Cross-references between skills are sibling-relative
  (`../other-skill/SKILL.md`), and every reference file is linked from
  its own `SKILL.md`, not only from the index.
- Examples are written fresh. The running domain is clinic bookings:
  bookings, treatments, appointments, patients, clinicians. Rotate
  secondary domains — library lending, bike share, parking, subscription
  billing — rather than building one example everywhere.
- Name the tools. Guidance that says "use a persistent collection
  library" cannot be acted on. Name the library, and verify the name
  against its current documentation rather than from memory.

## Changing a rule, or adding a check

Give the pack the defect the change is meant to catch, and confirm it
fires, before trusting it. A rule written from reasoning alone has an
even chance of being the wrong shape. `scripts/negative-test.mjs` is
where that lives for `validate-skills.mjs` and `validate-examples.mjs`,
and `--selftest` on `validate-prose.mjs` or `validate-examples.mjs` for
the checks each makes in memory; a new guard adds a case to one of them
in the same commit.

The same applies to guidance. Over-application is not a discipline
failure, so a prohibition does not fix it. State the rule as a positive
conditional keyed to something observable, and put the exception in its
own conditional rather than appending a clause to the rule.

## The example domain and the prose checker

`scripts/validate-prose.mjs` holds a list of the nouns the examples are
built from. Two of its checks read that list: one catches a domain noun
standing where a structural word belongs, and one catches a noun buried
inside a longer word. Both go blind on any noun the list does not name.

So when a new domain enters the examples, add its nouns to that list in
the same commit. The checks exist because a word-level rename coined
`treatmention`, turned `Order matters:` into `Booking matters:`, and
was then audited and reported clean.

## Adding a skill

1. Create `plugin/skills/<name>/SKILL.md` with the frontmatter above.
1. Add routing cases for it in `evals/routing-cases.md`, in the wording
   someone actually said.
1. Run `npm test`. Coverage gates; if the new skill does not reach the
   top three for its own cases, the description is missing the words
   people use for that problem.
1. Run `node scripts/eval-routing.mjs --noise` and read whose territory
   the new description overlaps. Two skills that could both claim a task
   means neither will be chosen reliably.

The manifest needs no change. `plugin/.claude-plugin/plugin.json`
declares `"skills": "./skills/"`, so a new directory is discovered
without being listed anywhere. The version in its frontmatter must match
`package.json`; `npm test` fails if it does not.

## The two script pairs

`scripts/install.sh` and `scripts/install.ps1` do the same job, as do
`scripts/link-local.sh` and `scripts/link-local.ps1`. This is the one
place the repository deliberately keeps two implementations of the same
thing, because a Windows user may have neither a shell nor WSL. Change
one and change the other in the same commit, and keep their output
wording identical so a bug report reads the same from either.

## Working locally

```bash
./scripts/link-local.sh
```

This links `plugin/skills/` into `.claude/skills/` so an agent working
in this repository can load them. That directory is gitignored. Remove
the links with `./scripts/link-local.sh --remove`. On Windows the
equivalent is `.\scripts\link-local.ps1`, with `-Remove`.

## Files you should not create

- Any `markdownlint` configuration file.
- A second copy of skill content in another format.
- `plugin/package.json` or `plugin/package-lock.json`. A lock file at
  the plugin's root makes `claude plugin install` run npm on the machine
  of everyone who installs the plugin, pulling this repository's dev
  tooling for no benefit. That is why `plugin/` exists at all.
  `npm test` fails if either file appears there.
- `SOURCES.md` and `PRIVATE-NOTES.md` are gitignored by design. Do not
  commit either, and do not add their contents to any tracked file.
