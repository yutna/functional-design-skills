# Contributing

This file is for changing the pack. For installing and using it, see
[README.md](README.md). For the same rules addressed to an agent working
in this repository, see [CLAUDE.md](CLAUDE.md).

Corrections from real use are the most valuable thing here. If a skill
gave wrong guidance, or did not trigger when it should have, say what
you observed; a transcript is worth more than a general report.

## Getting set up

```bash
npm ci
./scripts/link-local.sh    # or .\scripts\link-local.ps1 on Windows
```

Node 24 or later, as `.node-version` says. `mise` reads that file;
`actions/setup-node` reads it too, which is why the version lives there
rather than in `mise.toml`. If `mise` reports that the config is not
trusted, run `mise trust` once: it is asking whether to honour a file
from a repository you have just cloned.

`link-local` puts the skills where an agent working in this clone can
load them. The directory it creates is gitignored.

## Verifying a change

```bash
npm test          # lint, skills, prose, code examples, routing coverage
npm run test:guards   # break every guard and confirm it fires
```

Both must pass, and continuous integration runs both. Run them as you
write rather than once at the end; the eighty-character line limit is
much easier to satisfy while drafting.

Three flags worth knowing on the routing scorer:

```bash
node scripts/eval-routing.mjs --report        # rank for every case
node scripts/eval-routing.mjs --noise         # whose territory a description overlaps
node scripts/eval-routing.mjs --profile full  # also score the "When to use" section
```

## Constraints this pack honours

- Frontmatter stays inside the set Claude Code documents. The ones used
  here are `name`, `description`, `license`, and `metadata`.
- Every `description` opens with `Use when`, states triggers only, and
  stays under 180 characters. The platform truncates `description` and
  `when_to_use` together at 1,536; the tighter limit is this pack's own,
  because a description that does not fit on two terminal lines has
  stopped being a routing table entry.
- Every Markdown file passes `markdownlint` under its default rules,
  with no configuration file, no inline directives, and no custom rules.
- Cross-references between skills are sibling-relative
  (`../other-skill/SKILL.md`), and every reference file is linked from
  its own `SKILL.md`, not only from the index.
- Dependencies are pinned to an exact version, never a range.
- No book titles, author names, or bibliographic references in any
  tracked file.
- Scripts are JavaScript, shell, or PowerShell, and nothing else.

## Adding a skill

1. Write `plugin/skills/<name>/SKILL.md` with a `description` that
   states triggers only, in the vocabulary someone would use for the
   problem rather than for the solution.
2. Add routing cases for it in
   [evals/routing-cases.md](evals/routing-cases.md), in the wording
   someone actually said.
3. Run `npm test`. Coverage gates: if the skill does not reach the top
   three for its own cases, the description is missing the words people
   use, and the description is what to fix.
4. Run `--noise` and read whose territory the new description overlaps.
   Two skills that could both claim a task means neither will be chosen
   reliably, and that is the failure mode no syntax check can see.
5. Add a scenario to [evals/scenarios.md](evals/scenarios.md) if the
   skill has a direction that could invert — a rule that could become an
   escape hatch needs a case that must refuse it, not only one that must
   apply it.

The manifests need no change. `plugin/.claude-plugin/plugin.json`
declares `"skills": "./skills/"`, so a new directory is discovered
without being listed anywhere.

## Changing a rule, or adding a check

Before adding a check or tightening a rule, give the pack the defect the
change is meant to catch and confirm it fires. A rule written from
reasoning alone has an even chance of being the wrong shape, and this
repository has two standing examples in each direction:

- The routing noise measure looked like a real finding and turned out to
  be measuring alphabetical order. It is reported as a diagnostic and
  does not gate. See [evals/README.md](evals/README.md).
- The prose checks each exist because a defect of that exact shape
  shipped, was audited, and was reported clean.

A new guard adds its case to `scripts/negative-test.mjs`, or to the
prose self-test, in the same commit.

The same applies to the form of the guidance. Over-application is not a
discipline failure, so a prohibition does not fix it. State the rule as
a positive conditional keyed to something observable, and put the
exception in its own conditional rather than appending a clause to the
rule.

## Naming a tool

Guidance that avoids naming tools to stay timeless produces guidance
nobody can act on. Name them. Then check the name against the tool's
current documentation rather than writing it from memory, and say in the
commit where you checked, so the next person can re-check cheaply.

## The example domain

The running examples are clinic bookings. When a new domain enters the
examples, add its nouns to the list in `scripts/validate-prose.mjs` in
the same commit — two of the checks read that list, and both go blind on
any noun it does not name.

## Pull requests

Two labels are required and a check enforces them: one type
(`feature`, `release`, `bug`, `hotfix`, `chore`, `documentation`) and
one priority. `breaking-change`, `security`, and `skill` are worth
reaching for when they apply.
