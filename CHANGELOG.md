# Changelog

Notable changes to this pack. Versions follow [semantic versioning]:
a major bump changes something people depend on, a minor one adds
skills or guidance, a patch one corrects what is already there.

[semantic versioning]: https://semver.org

## 3.0.2

Two sentences this repository had written down as rules, neither of
which anything checked. One of them was already being broken.

The theme: a convention is not a check. Both sentences had been in
`CLAUDE.md` since 2.0.0, both read as constraints, and an agent
following them had no way to find out it had stopped.

### A count that had been wrong since 3.0.0

- `CLAUDE.md` said a skill's description must be "clearly distinct
  from the other thirty-nine". There are forty-three skills, so it is
  distinct from the other forty-two. The sentence was written at 2.0.0
  when there were forty, and the React split, the Elixir split and the
  statechart pack each moved it by one without moving the number.
- `validate-counts.mjs` held eleven claims and now holds sixteen. The
  five added were found by reading every number-word in the tracked
  prose and asking which ones the script knew about. The new claim
  went in against the still-wrong sentence and failed before the word
  was changed.
- `README.md`'s "the thirty-three core skills gained the
  `functional-` prefix" is deliberately not registered. It records
  what 3.0.0 did, so it must still say thirty-three the day a
  thirty-fourth core skill lands.
- One hand-written number is left and is documented next to itself:
  `versionedFiles` adds the manifests as `+ 3`, and the list of them
  lives in `bump-version.mjs`.

### A paragraph belongs to one skill, not one pack

- The duplicate-prose check compared a skill only against the packs
  its own name extends, which is the one pair a reader can spot
  unaided. It compares every pair now. Two core skills sharing a
  paragraph have nothing in their names to say so.
- Measured before widening: zero. This holds a floor rather than
  working off a backlog, and the summary reports 1726 paragraphs
  compared so a run that compared none cannot read as clean.
- A link is reduced to its text before the length is measured. One
  cross-reference line cleared the hundred-and-twenty-character
  threshold on the length of its href alone.
- A fortieth guard, added before the widening and failing then: the
  same paragraph in two skills whose names say nothing about each
  other. The two existing cases now assert their own half of the
  message rather than the prefix they shared, so neither can pass by
  matching what the other proves.

### One rule was written twice

Exact matching cannot see a paragraph with a word changed, so that was
measured separately: sentence-level similarity over 1989 sentences,
three pairs above the threshold, read once and not turned into a gate.
A threshold set by looking at today's text is fitted to today's text,
which is the argument this pack already had with itself over the
routing noise gate.

- `functional-typescript-effect` restated a rule from
  `functional-making-illegal-states-unrepresentable` nearly word for
  word. It says what `Schema` changes about it and links for the rest,
  which is the shape a language pack is meant to have.
- The other two are an example sentence carried between two packs and
  two routing pointers worded differently. Both are left alone.

## 3.0.1

A pass over everything that is not a skill. No skill content changed
except one word, and every bug found was in a script.

The theme, found on the first CRLF checkout anyone had run: three
readers were anchored to a bare `\n`, and one of them matched no
headings, found no rules, printed `0 core rule(s) labelled across 0
skill(s)` and exited zero. The strictness gate had been inert on
Windows since the day it shipped, and green the whole time.

### Checks that could report nothing and call it a pass

- Every validator counts what it read and refuses to print `ok` on a
  zero. Reading an empty pack now throws in the reader rather than
  returning a zero each caller has to remember to check.
- The Windows job runs `npm test` and `npm run test:guards`. It ran
  the PowerShell scripts and nothing else, which is why none of this
  was caught.
- `eval-routing.mjs` had no negative test, so the headline number was
  the one instrument never proved able to fail. It has four now.
- `eval-routing.mjs` read only the first fenced case block. A second
  would have been skipped in silence with every case in it unscored.
- The link check walks the repository. It stopped at `plugin/skills`,
  so a broken link in the README was nobody's job.
- The scorer no longer skips a skill whose frontmatter will not parse.

### The installer could delete a skill it did not own

- `--force` removed a directory that claims no pack. `metadata.pack`
  is this pack's own convention, so unmarked is more likely to be
  someone else's work than an old copy of this one. Unmarked names are
  reported and left alone now, `--force` included.
- The shell installer was unusable from Git Bash or WSL: a CRLF
  checkout made the pack name `functional-design-skills\r`, and all
  forty-three of this pack's own skills came back as conflicts.
- Both are exercised for real against a temporary home. Continuous
  integration only ever passed `--dry-run`, which writes nothing.

### The tooling follows this pack's own rules now

Every bug above was the same bug wearing different clothes, and the
pack has a skill for it.

- `scripts/lib/markdown.mjs` is the only place a Markdown file is read.
  Eight scripts each split lines their own way, twenty-one times, so
  each was a separate chance to be wrong. Nothing downstream can see a
  `\r` now, which makes that class unrepresentable rather than caught.
- `scripts/lib/pack.mjs` holds one definition each of a skill, a
  routing case and a scenario. Five scripts listed the skills
  directory; two counted the cases with regexes that disagreed.
- 254 lines deleted, 80 added, with every guard still firing.

### Scenarios run against real agents

`scripts/eval-scenarios.mjs` runs all forty-two as whole prompts in
isolated sessions and reports which skill each one loaded. Not in
`npm test`: it costs money and moves with the model. Two attempts
measured the wrong thing first -- the operator's other plugins, then
an empty directory -- and both fixes are in the script.

### Smaller

- One rule relabelled. "Two type families, always. Even when they look
  identical today" forecloses its own exception, so it is a `Rule`,
  not a `Default`. Four other candidates were false positives.
- The routing scorer's name weighting is measured rather than assumed,
  and the numbers are in the file: only counting the name twice reaches
  145/145.
- A file under `scripts/` has a shebang and is executable, or neither.
- `scripts/bump-version.mjs` carries the version to the forty-five
  places that repeat it, without going near the lock file.
- The `assign` job no longer fails on a race with its own `labeled`
  event.

Guards: twenty-eight to thirty-eight, plus six that read a CRLF
checkout, six that run against an emptied pack, and six that drive the
real installer.

## 3.0.0

Every skill was renamed, so every install needs attention; see
"Upgrading from 2.x" in the README. What that rename bought is the
ability to install this pack beside another without either one
silently losing skills to the other.

The rest of the release came out of an audit that read all forty
skills and measured them rather than reading them alone. It found
less missing than expected and less findable than expected: one
genuine content gap, five skills whose right answer existed and could
not be reached, and four conventions that depended on care where a
script would do.

Counts, before and after: forty skills to forty-three, sixteen guards
to twenty-eight, 105 routing cases to 142, thirty-seven scenarios to
forty-two, and nothing labelled with how strictly it was meant to 258
rules that are.

### Breaking: every skill is now named `functional-something`

The thirty-three core skills gained the prefix the index and the six
language packs already had. Skills install flat into `~/.claude/skills`,
so a name like `hiding-information` is one any pack might claim and the
second pack to claim it loses. Anyone who installed with the scripts
should remove the old directories by hand; the plugin route replaces
them.

- 1,138 references rewritten across 114 files: sibling links, routing
  cases, scenarios, frontmatter names, and the prose that names a skill.
- Six tables became lists. Eleven more characters per name put them
  past the eighty-character limit, and a wide comparison table is not
  viable at that width, so they now use the arrow form the index
  already used for the same kind of mapping.
- `CHANGELOG.md` was deliberately left alone. A skill that was called
  `separating-layers` when 2.0.0 shipped is still called that in the
  2.0.0 entry; a record that updates itself is not a record.
- The count check caught the rename twice: once when the sentences in
  `CLAUDE.md` describing the naming were rewritten, and it refused to
  keep quiet about numbers it could no longer find.

PowerShell moved into `mise.toml`. This repository keeps two
implementations of each install script and requires them to change
together, and there was no way to run the PowerShell half without
already having it.

### Added: statecharts, and a store's boundaries

The plan called for three library additions. Measuring them first
turned three into two, and shrank one of those.

- **`functional-typescript-xstate`** is new. Hierarchy, parallel
  regions, delayed transitions and actors with lifetimes appeared
  nowhere in the pack, and they cannot go in
  `functional-modeling-state-machines`, which uses neutral notation
  by design. Seven core rules, one of which is when not to reach for
  it: the states become strings in a config rather than cases of a
  type, so an exhaustiveness check is traded for features that may
  not be in use.
- **`stores.md`** in the React pack covers what belongs in a global
  store and what does not, selectors that compute rather than store,
  normalising as one owner per fact, and writing nested updates
  through a draft.
- **`immer` got nothing**, because measuring showed it did not need
  anything. The real symptom — "updating deeply nested state is
  unreadable" — already reaches
  `functional-managing-state-immutably` first, and
  `persistent-structures.md` already names the library, says what it
  does, and says when to reach for it. The case that failed was one
  this author wrote as a keyword probe rather than something anyone
  would say.

Verified against the current XState documentation rather than from
memory, which changed the example: v5 computes a transition purely
with `transition(machine, state, event)`, not a method on the machine.

The example parser caught a fragment: a `reducers` object written
without the `createSlice` call around it is not standalone
TypeScript, which is exactly the defect class it exists for.

Coverage 142 of 142, 108 placing first.

### Split: Elixir and Phoenix are two packs, and OTP grew

The largest gap the audit found, and the largest piece of work in this
release.

`functional-elixir-phoenix` ranked **21st of 40** for "should this be a
genserver or a plain module", 17th for "our supervision tree restarts
the wrong thing", and 23rd for "a process crashed and took the state
with it". The words `genserver`, `supervis` and `spawn` were in no
skill's description at all. The guidance existed, in one section of a
reference file shared with LiveView, and nothing could reach it.

- **`functional-elixir`** is the base: structs and enforced keys,
  tagged tuples, `with` pipelines, typespecs, and OTP. Eight core
  rules, two of them new.
- **`functional-elixir-phoenix`** is the delta: contexts, Ecto,
  changesets as parsers, LiveView, and where each layer stops. Seven
  core rules, none repeating the base.

**OTP roughly doubled**, from one section of a mixed file to its own
reference, and the additions are the parts that were missing rather
than more of what was there:

- **A process is an isolation boundary, not a variable.** The question
  is not "does this need state" but "what should still be working
  after this fails", and where nothing does, there is no process.
- **A supervision strategy is a design decision, not configuration.**
  Each of the three answers a different question about what depends on
  what, and choosing the default without asking is how a tree restarts
  correctly in testing and wrongly in production.
- **What a restart cannot restore.** Its initial state is the whole
  guarantee: state it was the only copy of is gone, work in flight is
  gone, and effects already performed stay performed.

A thirty-ninth scenario covers the shape all of this produces: three
concerns in one GenServer because each needed state, serialising work
that had no reason to be serialised, losing all three on a crash.

Coverage 135 of 135, 103 placing first.

**A negative test stopped pinning a number.** Two cases broke a
documented count by quoting the sentence that carried it, so every new
scenario edited this file. Three times was enough; they now read the
current wording rather than repeating it.

### Split: React and Next.js are two packs

`functional-react-nextjs` covered a framework and the meta-framework
on top of it in one place, which meant a React project read Server
Action guidance it had no use for, and neither half could say what the
other assumed.

- **`functional-typescript-react`** is the base: components, props,
  state against derivation, and keeping rules out of handlers.
- **`functional-typescript-react-nextjs`** is the delta: the server and
  client boundary, Server Actions as workflows, what may cross and in
  what shape, and where a cache is invalidated. Seven core rules, none
  of which repeat the base.

The long name is deliberate. The check that a pack links to the one it
extends derives the parent from the name, and
`functional-typescript-nextjs` would have derived `functional-typescript`
— skipping React, which is the pack it actually builds on and the one
it could most easily duplicate.

**The duplicate-paragraph check became transitive** as a result. It
compared a pack against its immediate parent only, which would have
left `functional-typescript-react-nextjs` free to repeat anything from
`functional-typescript`. It now walks every ancestor, and a
twenty-seventh guard covers the grandparent case the old one missed.

Adding a forty-first skill moved every routing score, because inverse
document frequency depends on how many documents there are. Two
unrelated cases fell out of the top three and were repaired; coverage
is 127 of 127 with 98 placing first, up from 120 of 120 with 93.

### Added: who owns work that was started

The one genuine content gap the audit found. `concurrency.md` covered
the update cycle, coordination primitives, idempotency, parallelism and
what immutability does not fix -- all of it about coordinating changes
to a value. Nothing anywhere covered a computation that is still
running after everyone stopped caring about it.

Measured before it was written: `functional-making-effects-reliable`
ranked 21st of 40 for "a background task outlives the request that
started it", and the words `cancel`, `spawn`, `supervis` and `parallel`
appeared in no skill's description at all.

- **New core rule**, the eighth in `functional-making-effects-reliable`:
  work that outlives its command has an owner or a cancel. Labelled
  `Rule`, because work with neither cannot be drained at shutdown,
  cannot be stopped when the request that wanted it has gone, and its
  failures arrive with nothing to attach them to.
- **New section in `concurrency.md`**: the four symptoms that share
  that one cause, the scope shape that fixes all four, cancellation as
  a value passed in rather than something done to a running
  computation, and why a cancelled effect is not an undone effect.
- **A scenario**, the thirty-eighth: an export endpoint whose job
  duplicates on retry, half-writes on restart, and cannot be counted.
  Three symptoms, one cause.

Coverage went from 114 of 120 to 120 of 120, and the number placing
their skill first from 87 to 93.

### Findable: four skills people were not reaching

Measured with `scripts/eval-routing.mjs`, not guessed. Each of these
had the right answer already written down and no way to reach it.

- **Whether an effect system is worth adopting.**
  `functional-parameterizing-dependencies` ranked 30th of 40 for "should
  we adopt an effect system or just return a result". What surfaced
  instead was `functional-typescript-effect`, which teaches how to use
  one. Someone asking whether reached the pack that answers how. The
  answer was already core rule 1 -- prefer rejection, then
  parameterization, then interpretation -- and the description now
  carries the words for it.
- **Three separate booleans.** The flagship symptom of
  `functional-making-illegal-states-unrepresentable` put it fifth,
  behind three error-handling skills, because "loading" and "error"
  read as error vocabulary.
- **A law as the source of a property.**
  `functional-folding-over-data` ranked 15th for "what law should this
  combining operation obey", and `functional-testing-functional-code`
  18th for checking one. Both descriptions now say so, and the table of
  properties gained the sentence that was missing: each row is a law,
  and a law is where a property comes from.

Nine routing cases were added first and watched to fail, then the
descriptions were changed. Coverage went from 106 of 114 to 114 of 114,
and the number placing their skill first from 81 to 87.

### Also

- **Three symptoms in a data-first vocabulary now reach the skill that
  answers them.** A typed record against a map, a schema as a runtime
  value, and a type per concept blocking generic code all reached
  `functional-choosing-types-or-plain-data` at ranks six to eight.
  The description carries those words now. The skill's content did not
  change: the whole data-first position was already there, with the
  two direct contradictions named and traded off rather than waved at.

- **Three scenarios**, including a pair that tests a rule in both
  directions: one lifecycle that must adopt a statechart and one that
  must refuse it. Testing only the permissive direction would not
  notice a rule that had become an escape hatch.
- **A twenty-eighth guard**, found by making the mistake it catches.
  Bumping the version with a find-and-replace rewrote twenty-one
  dependency versions in `package-lock.json` that happened to match
  the number being replaced. `npm ci` did not notice, because it
  installs from the resolved URL and the integrity hash, so the lock
  file lied rather than failed. Each locked version is now compared
  against the URL it resolves to.

### Mechanism: four conventions became checks

Mechanism, not guidance. Nothing about what the pack recommends has
changed; what changed is that a reader can now tell how firmly each rule
is meant, and that four things which used to depend on care now depend
on a script. Ten new guards, taking the total from sixteen to twenty-six.

- **Added: every core rule says how strictly it is meant.** All 235
  numbered rules across 34 skills now open with `Rule.`, `Default.`, or
  `Judgement.`. Before this, "Name the accumulator type first" and "Do
  not export what callers should not use" read with identical force,
  though breaking the first leaves working code and breaking the second
  breaks a promise. The split came out at 42% Rule, 54% Default, 4%
  Judgement; `validate-rules.mjs` reports the share on every run as a
  health signal, because a pack that is nearly all Rule is overclaiming
  and one with almost none is not saying anything.
- **Added: every skill records which pack it came from.**
  `metadata.pack` is documented as a free-form map read by your own
  tooling, and that is exactly what the installers now do with it.
- **Added: the installers tell a skip from a conflict.** Skills are
  copied flat into `~/.claude/skills`, so a second pack claiming a name
  the first already took used to print `skip` and leave the user
  quietly missing skills. Both installers now print `conflict`, name
  the pack that owns it, and refuse rather than overwrite.
- **Added: `validate-counts.mjs`, which checks numbers written in prose
  against the thing they count.** It found one on its first run.
- **Added: a check that nothing in `evals/` names a skill that does not
  exist.** `scenarios.md` mentions skills in backticks 43 times and no
  script had ever read it, so a rename could have left every one of
  them dangling with the build still green.
- **Added: a pack that extends another must link to it and must not
  repeat a paragraph from it.** Both existing library packs already
  followed the convention; now it cannot be lost.
- **Added: a check for the marks a citation leaves behind** -- an `ISBN`,
  a chapter number, an edition, a year in parentheses. The no-citations
  rule was enforced by hand until now, after an audit had to strip a
  coverage map that had already shipped.
- **Fixed: `evals/README.md` said thirty-five scenarios where
  `scenarios.md` holds thirty-seven.** Found by the count check above,
  on the run that introduced it.
- **Fixed: a recorded measurement had outlived the suite it was taken
  on.** The note that no case reaches the top three on a zero score was
  measured when there were 87 cases; there are 105. Re-measured rather
  than re-typed: still zero.

## 2.0.1

A production-readiness sweep: every file run, parsed, or installed
rather than read. Same skills, same install routes; sixteen examples
that could not be pasted now can be.

- **Fixed: fourteen code examples that were not the language their
  fence claimed.** All fourteen used `...` as an ellipsis, which is
  spread syntax in JavaScript and TypeScript and not a token at all in
  Elixir, so `(s) => ...` and `%Appointment{...status: at}` were parse
  errors rather than omissions.
- **Fixed: three identifiers a word-level rename had missed.** These
  parsed; they were simply the wrong name. `OrderV1` and `OrderV2`
  decoded into `Booking`, and `LARGE_ORDER` was the last
  screaming-case survivor of the old example domain. A name inside a
  code span is invisible to a prose check, which is why none had been
  caught.
- **Fixed: the two installers disagreed about ordering.** A trailing
  slash on the shell glob sorted `functional-typescript-effect/` before
  `functional-typescript/`, because `-` sorts before `/`. The shell was
  the only one of the four scripts not sorting by name.
- **Fixed: a high-severity advisory on every clone.** smol-toml at or
  below 1.7.0 spins on malformed TOML. An exact-pinned override to
  1.8.0 clears it without the major downgrade npm suggested.
- **Fixed: `mise` errors on a fresh clone** and `CONTRIBUTING.md` never
  mentioned `mise trust`. The configuration was right; the instructions
  were incomplete.
- **Added: `validate-examples.mjs`**, which parses every fenced example
  with the real compiler for its language: TypeScript for `ts`, `tsx`
  and `js`, `JSON.parse` for `json`, and Elixir behind `--with-elixir`,
  which continuous integration cannot run. It is a parser, not a type
  checker: an example can still be wrong, but it cannot be unusable to
  paste. It reads a fence indented into a list item as well as one at
  the margin, because house style permits both. Two cases in
  `negative-test.mjs` prove it fires, bringing the guards to sixteen,
  and seven more run in memory under `--selftest`, which
  `npm run test:guards` now calls alongside the prose self-test.
- **Added: `typescript`**, exact-pinned, because the alternative was a
  guard blind to 89 of the 114 fences it exists for.
- **Added: continuous integration runs the install scripts.** Nothing
  had ever run `install.sh`, `install.ps1`, `link-local.sh` or
  `link-local.ps1` outside the machine they were written on. All four
  now run on Linux on every push, and a `windows-latest` job runs the
  PowerShell pair where `link-local.ps1` takes its Windows-only
  junction branch, then reads a skill back through the junction to
  prove it resolved.
- **Added: two lines to the README's list of what the checks do not
  establish**, for the new one. The parser cannot type-check an
  example, run it, or know whether the library it names behaves as
  shown; and 396 of the 537 code blocks are the neutral `text`
  notation, for which no parser exists.

## 2.0.0

Claude Code only, shipped as a plugin.

### Changed, and breaking

- **The skills moved to `plugin/skills/`.** Every documented install
  route changed with them. A lock file at a plugin's root makes
  `claude plugin install` run npm on the machine of everyone who
  installs it, so the packaging tooling now stays one directory up where
  the installer cannot see it.
- **Codex support is gone.** Supporting two runtimes from one set of
  files cost the platform actually in use: frontmatter was held to
  `name` and `description`, so `license` and `metadata` were
  unavailable, and the description budget was squeezed to fit a limit
  only the other runtime had. Nothing was ever run against Codex to
  confirm the support worked.
- **`scripts/verify.sh` and `scripts/eval-routing.py` are gone**,
  replaced by `validate-skills.mjs`, `validate-prose.mjs`,
  `eval-routing.mjs` and `negative-test.mjs`. The routing scorer is a
  faithful port, producing byte-identical output on the summary,
  `--report` and `--profile full`; ties in the `--noise` table now break
  alphabetically rather than by which case was scored first.
- **Two descriptions gained a trigger word** they were missing, in
  `separating-pure-core-from-shell` and `separating-layers`, after
  routing cases for the new guidance failed to reach them.

### Fixed

Thirty-two defects that no linter could see.

Twenty-five of them came from one cause. A word-level rename of the
example domain had broken prose wherever the replaced word meant
something else, and the audit that checked it recorded the skills clean.
They were not. Each of these is recovered from the tree as it stood
before that rename rather than rewritten from guesswork.

- Seventeen places where `order` meant a sequence, so the substitution
  produced a sentence that parses and means nothing.
- Two where `service` meant a service object, turning the rule against
  wide dependencies into a rule about the example domain.
- One where `production` contained `product`, coining a word that does
  not exist.
- Five articles left disagreeing with the noun after them, one of them
  split across a line wrap.

The other seven were found by reading the examples as a compiler would
rather than as prose.

- A box diagram whose lines ran 45, 46 and 47 characters.
- `>=/>` in the Elixir notation table, which is not an operator.
- A monoid example labelled "not associative" above a comment saying it
  is associative, when the operation shown is a maximum and therefore
  associative. It is replaced by an averaging example, which genuinely
  is not associative, and by the repair.
- An Elixir example naming a nested module as `Appointment.Id` from
  inside `Clinic.Scheduling.Appointment`, which resolves to
  `Elixir.Appointment.Id` and does not exist.
- A wrapper class defining `valueOf`, which silently restores the
  defect the wrapper removed: `quantity + price` coerces both and
  compiles.
- Two worked examples reachable only from the index, so a reader inside
  the skill that owned each never learned it existed.

### Added

- **Every tool named.** Guidance that said "use a persistent collection
  library" could not be followed, and one sentence of it was wrong:
  JavaScript and TypeScript ship no persistent collections, and they are
  two of the six language packs. Named and verified against current
  documentation: `fast-check`, `stream_data`, `propcheck`, `immutable`,
  `immer`, `oban`, `broadway`, `pg-boss`, `bullmq`, `Ecto.Multi`, `mox`,
  `:telemetry`, `useActionState`, `@tanstack/react-query`, `swr`,
  `xstate`.
- **Effects spread upward**, as the mechanic behind the core-and-shell
  split coming undone, with the drill for finding where to cut.
- **Layers ordered by how often each changes**, as a second axis beside
  vocabulary.
- **Why a constructor returns a value rather than a verdict**, which is
  where duplicated validation comes from.
- **Pinning untested behaviour**, as the move before every other move,
  and where to stand when the code cannot be called at all.
- **Reading two sequences of effects against each other**, with the
  questions to ask and the repairs in order.
- **Stateful property testing** in full, where it had six lines.
- A contents list on all seventy-three references that need one.
- Twelve routing cases for the new material; coverage is 100 of 100.
- `CLAUDE.md`, which this repository never had. Its house rules lived in
  `CONTRIBUTING.md`, which no agent working here reads.
- Guards for every defect above, each with a test that breaks it
  deliberately and confirms the guard fires.
- **A readiness check before the design loop.** The pack answered
  "we do not know what this should do yet" with a module-boundary skill,
  because `know`, `build` and `report` are ordinary words that sit in
  those descriptions as structural vocabulary. `functional-design` now
  asks for one rule with an example it accepts and one it refuses,
  keyed to the two heaviest rows of the calibration table, and says
  what to produce when the answer is no. It does not add a
  specification method; it declines the work and names what is
  missing.

### Removed

- `AUDIT.md`. It recorded how each round was verified, and one of its
  claims — that the skills were clean of rename damage — is disproved by
  the thirty-two fixes above. What was still true about scope and
  limits has moved into `README.md` and `CONTRIBUTING.md`; the rest is
  in the history.

## 1.0.0

First release. Forty skills: an index, thirty-three design rules, and
six language packs, copied into a target project rather than installed.
Worked in Claude Code and, structurally, in Codex.
