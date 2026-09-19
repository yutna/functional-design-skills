# Functional Design Skills

Agent Skills carrying design rules for codebases written in a functional
style. For Claude Code.

They cover:

- Diagnosing complexity, and telling what a design costs from what it
  looks like
- Modelling a domain in types so illegal values cannot be built
- Composing workflows out of total functions, with errors as values
- Module boundaries, information hiding, and interface depth
- Immutability, state, effects at the edges, and reliability across a
  process boundary
- Refactoring imperative or object-oriented code toward all of the above

The rules are language-agnostic. An index and thirty-three core skills
describe designs in a neutral notation; six language packs translate
them into JavaScript, TypeScript, React and Next.js, and Elixir and
Phoenix.

## What it changes

The smallest example of the whole method. A type that permits states the
business forbids:

```text
type Shipment = {
  status: String,
  trackingNumber: Option<String>,
  shippedAt: Option<Date>,
  deliveredAt: Option<Date>,
  failureReason: Option<String>,
}
```

Five fields, four of them optional, so the type admits sixteen
combinations of presence for any status. Reports break on the ones
nobody meant. After:

```text
type Shipment =
  | Pending
  | Shipped of { trackingNumber: TrackingNumber, shippedAt: Date }
  | Delivered of { trackingNumber: TrackingNumber, deliveredAt: Date }
  | Failed of { reason: FailureReason }
```

Each case carries exactly the data that case has, so there is nothing to
check for absence. The gain is not tidiness: every consumer that used to
branch on a status string and then test a field for `null` now handles
four cases and cannot forget one.

## Install

### As a plugin

```text
/plugin marketplace add yutna/functional-design-skills
/plugin install functional-design-skills@functional-design-skills
```

### With the install script

Copies every skill into `~/.claude/skills/`, where Claude Code finds it
in any project:

```bash
git clone https://github.com/yutna/functional-design-skills.git
cd functional-design-skills
./scripts/install.sh
```

Options: `--force` to replace an existing copy, `--dry-run` to see what
it would do.

On Windows, without needing a shell or WSL:

```powershell
git clone https://github.com/yutna/functional-design-skills.git
cd functional-design-skills
.\scripts\install.ps1
```

Same options, as `-Force` and `-DryRun`. PowerShell 7 or later.

### By hand

Copy any `plugin/skills/<name>/` directory into `~/.claude/skills/` for
every project, or into a project's `.claude/skills/` for one repository.
There is nothing to build and no dependency to install.

Start a new session afterwards, whichever route you took.

## Tell the agent the pack is there

Installing puts the rules within reach. It does not say what outranks
what, and an agent with no stated precedence will read a deliberate
convention as a defect. Paste this into the project's `CLAUDE.md`, with
the last line naming the language pack that matches the project:

```markdown
## Design rules

This codebase follows functional design. The `functional-design` skill
is the index; the rest of the pack carries one rule each.

- This project's own conventions win. The pack decides what they leave
  open, and a pack red flag is a place to look, not a finding.
- Before designing a new module, workflow, endpoint, or bounded
  context, read `functional-design` and follow its design loop.
- For anything smaller, use its calibration table to decide how much
  design the task warrants. For one function in a module that already
  exists, that is an honest signature and a precise name, nothing more.
- Before finishing a change that added or reshaped a type, a signature,
  or a module boundary, run the checklist in
  `functional-reviewing-functional-design`.
- Use `functional-typescript` for concrete syntax.
```

The first bullet matters more than it looks. It is what stops the pack
arguing with a decision the team already made.

## Check it took

Start a session in the target project and ask one question whose right
answer names a skill:

> we have four nullable fields that only make sense in some combinations

Expect the agent to reach `functional-making-illegal-states-unrepresentable`. If
it answers from general knowledge without naming a skill, the files are in the
wrong directory.

## If it over-engineers

The symptom is a wrapper type on a throwaway script, a new error union
for a one-line change, or a review finding against something the team
decided on purpose. The cause is the agent applying a heavier rule than
the task warrants.

Every core rule says how strictly it is meant, as the first word of the
item. `Rule` means breaking it is a defect. `Default` means do this
unless the stated condition holds. `Judgement` means two answers are
defensible and the skill says what tips it. An agent that quotes a
`Default` as though it were a `Rule` is misreading the pack, and saying
so is usually enough.

Three more things fix it, in order of how much they buy:

1. **Say what outranks what**, as in the snippet above. Most
   over-application is an agent with no stated precedence treating every
   rule as binding.
2. **Name the calibration row out loud** in the session: "this is one
   function in a module that already exists". The row is the pack's own
   answer and the agent will take it.
3. **Scope the rules to the code they apply to.** A rule file under
   `.claude/rules/` takes a `paths:` key in its frontmatter, so a
   codebase that is only partly functional can point these rules at the
   part that is.

## Which skills there are

`functional-design` is the index: the calibration table, the
symptom-to-skill routing, and the notation the core skills use. Start
there.

Thirty-three core skills carry one rule each, grouped roughly as:
complexity and module boundaries; domain modelling and types; workflows,
composition and errors; effects, state and reliability; naming,
comments, testing, review and refactoring.

Six language packs give the concrete syntax: `functional-javascript`,
`functional-typescript`, `functional-typescript-effect`,
`functional-typescript-ts-pattern`, `functional-react-nextjs`,
`functional-elixir-phoenix`.

Each skill's `description` states the situations that should trigger it,
and only those; the body is read when the skill is selected. Reference
files behind each one hold the depth, and load only when a skill links
into them.

## Layout

```text
plugin/skills/<name>/       what ships
  SKILL.md                  the rule, short enough to always read
  references/*.md           depth, loaded only when needed
plugin/.claude-plugin/      the plugin manifest
.claude-plugin/             the marketplace manifest
evals/                      routing cases and agent scenarios
scripts/                    validation, routing, install, link
```

Only `plugin/` ships. Everything else maintains the pack.

## Further reading

- [CONTRIBUTING.md](CONTRIBUTING.md) is how to change the pack, and the
  constraints a change has to keep.
- [CLAUDE.md](CLAUDE.md) is the same thing addressed to an agent working
  in this repository.
- [evals/README.md](evals/README.md) is what the routing check does and
  does not prove, and the scenarios to run against a real agent.
- [CHANGELOG.md](CHANGELOG.md) is what changed in each release.

## What this does not establish

Worth knowing before relying on it.

- **The routing check is a keyword lint, not an oracle.** It scores word
  overlap and has no idea what any word means. A green run means every
  description contains the vocabulary people use for that problem; it
  does not mean an agent routes correctly. The scenarios in `evals/`
  cover that question, as a sample rather than a proof.
- **Only the first place in a ranking is meaningful.** A median of 33 of
  the 40 skills score exactly zero on any given case, and ties break by
  name, so second and third places are often filled alphabetically. The
  gate uses the top three, which is deliberately generous.
- **The prose checks know only the domains they are told about.** They
  catch a domain noun standing where a structural word belongs, and one
  buried inside a longer word, for the nouns listed in
  `scripts/validate-prose.mjs`. A new example domain that is not added
  to that list is unchecked.
- **The example check is a parser, not a type checker.** Every fenced
  example in a real language is handed to that language's compiler, so
  one that cannot be pasted fails the build. An example that parses can
  still be wrong: nothing here type-checks it, runs it, or knows
  whether the library it names behaves as shown. Elixir needs the
  Elixir toolchain, which continuous integration has not got, so those
  fences are checked only by whoever runs `--with-elixir` locally.
- **The neutral notation is checked by nobody.** Around three quarters
  of the code blocks in the pack are `text`, the notation the core
  skills share, and no parser exists for it. Those blocks are held to
  the same standard by review alone.

## Licence

MIT, in [LICENSE](LICENSE). Use the skills in any project, including
commercial work; keep the copyright notice.

The licence covers the wording in this repository and nothing else. The
design principles it states are long-established and belong to nobody
here.
