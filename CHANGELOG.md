# Changelog

Release notes for v3.4.0 and later are on
[GitHub Releases](https://github.com/yutna/functional-design-skills/releases).
The entries below record earlier versions.

Notable changes to this pack. Versions follow [semantic versioning]:
a major bump changes something people depend on, a minor one adds
skills or guidance, a patch one corrects what is already there.

[semantic versioning]: https://semver.org

## 3.3.0

The pack reaches the agent when it is working, not only when it is
asked a design question, and the evals measure it the way it is meant
to be set up. One paste in a project's `CLAUDE.md` switches it on,
every core skill leads back to the index, and the skills that the
measurements showed missing their point were corrected and measured
again before they merged.

### One paste switches the pack on

- Asked to change code, an agent opened a skill in 1 of 15 task runs
  of the 3.2.2 baseline, and in 11 of 15 when the project's `CLAUDE.md`
  carried the block from the README, with restraint intact. The block
  lived only in the README, which does not ship.
- It moves, byte for byte, to `functional-design`'s new
  `references/project-setup.md`, which says why the precedence bullet
  comes first and how to choose the last line. The index links it.
- `install.sh` and `install.ps1` print the block, read from that one
  file, with identical wording; CI fails when either dry run does not.
- The README explains the skill listing's budget: one per cent of the
  context window, `/doctor` and `/context`,
  `skillListingBudgetFraction` and the other settings that change it.

### Every core skill leads back to the index

- Thirty-four of the forty-two skills other than the index carried no
  link to it, so an agent that opened one for a small change never saw
  the calibration table, the notation, or the language packs. Each core
  skill now carries one line that links all three, and
  `validate-skills.mjs` fails one that does not.

### Skills that taught the opposite of what they are graded on

- Next.js rule 1: the server owns a rule and sends the client its
  answer. A pure function shared by both sides is for a field the user
  is still editing; a rule over a window, a policy or the clock stays
  on the server and crosses as a boolean or a deadline.
- `functional-design`, "Is the problem decided?": a request that
  already states its rules has passed, and the rules are written back
  with an example each way. When the check fails, the reply says the
  task is in no row of the table and that this work comes before
  design, names what has to be produced, and writes out only rules
  someone stated. `working-alone.md` said to take the most cautious
  reading and carry on; an undecided problem is now its exception.
- `functional-programming-strategically` says in its own file that a
  change inside one function stops there, that a grandfathered lint
  baseline is a stated position the change leaves alone, and that what
  was seen and left goes in the change's description.
- `functional-typescript-xstate` maps what a person describes to what
  a statechart adds: parts with their own steps are hierarchy, parts
  that finish in either order are parallel regions, a timeout is time
  as a trigger. Recommending one names its price in the same answer.
- `functional-folding-over-data`: totals per key are a `groupBy` and a
  fold over each bucket. `functional-diagnosing-complexity`: extracting
  a guard that exists only because state mutates in place keeps it for
  good. `functional-elixir` rule 6 asks what should still work after a
  process fails. `functional-writing-useful-comments` points at its
  rule 1 for new code.

### Three descriptions that lacked their users' words

- `functional-crossing-io-boundaries` names a read-only screen that
  rebuilds aggregates, `functional-diagnosing-complexity` the moment
  before refactoring a flag, cache or field, and
  `functional-reviewing-functional-design` a review where a flagged
  pattern may be the project's stated convention. Two other
  descriptions were shortened to pay for them; the listing is 8,093 of
  its 8,100 characters. Nine routing cases are in people's words.

### What the evals measure

- `scripts/eval-plugin.mjs` keeps each run's trace and lists the skills
  it loaded and the `SKILL.md` files it read; before, the tool deleted
  every trace, so a miss could not be explained.
- The prompts of the question cases describe code that the fixture
  does not contain, and in the 3.2.2 baseline 45 of 126 runs with the
  pack ended "I can't find the code". Every question case now says the
  code is not in the workspace, and a run that reads the expected
  `SKILL.md` reaches it as surely as one that loads it.
- The write grant that task cases need reached every case in a run, so
  question cases run beside them had Write and Edit too. A run of both
  kinds is now two invocations.
- Rubrics changed where they asked for more than the prompt implies or
  contradicted another grader of the same case, and each change is
  named in `evals/README.md`.

### Measured

- Every scenario, three runs per case, Sonnet 5.5 as agent and judge,
  before the skill corrections above: with the block 80 of 126, the
  pack alone 58, no pack 25. The block lifted thirteen scenarios
  against the pack alone and lowered two.
- The corrections were measured on their branches against that run,
  with neighbouring scenarios held out: the targets went from 0 to 5 of
  9 and from 0 to 5 of 18, the held-out cases from 18 to 16 and from 8
  to 10, and `t05-undecided-ticket` from none to three of three.
- The task cases on this release's content, with the block: task 11
  of 15, restraint 9 of 9, precedence 3 of 3, against 12, 6 and 3 in
  3.2.2. The pack is below no pack in no family. `t04-publish-on-confirm`
  still fails every run in every arm and loads no skill.
- Seven scenarios still fail every run with the block: 12, 18, 23, 34,
  35, 36 and 39. Three runs per case is a direction, not a proof.

## 3.2.2

The nine language packs follow the vocabulary and the model that 3.2.0
gave the core, which until now they had not been read against, and the
eval runner grades work as well as questions.

### A pack called a handler a workflow

- In the core a workflow is a pure function that returns events, and
  the function that reads, calls it and writes is a handler. Five packs
  still used the older sense.
- Next.js: the Server Action was "a workflow", was itself named
  `confirmBooking`, and awaited a function that took a bag of
  dependencies. It is `confirmBookingAction`, a handler, and calls the
  pure `confirmBooking` with values. Rule 5 and the section "Server
  Actions as workflows" say handler.
- Effect: the generator that holds a slot is `handleBookAppointment`.
  Its type named a `PatientNotFound` that its body could not produce;
  it reads the patient through a second service, decides with a plain
  function, and then holds the slot. Rule 5 gives the error union to
  the handler, and says a pure workflow returns `Either` or `Result`
  with a union of its own.
- JavaScript: `handle` awaited a pricing service between validating and
  saving. It is `handleConfirmBooking`, and reads first.
- Elixir and Phoenix: a function called the domain took a map of
  capabilities and a clock and performed a hold through one of them.
  The core is `Appointment.book/4`, which takes values and returns
  events. The handler is the context function. Private functions of
  the context touch `Repo`, and the one that writes opens the
  transaction; rule 7 of the Phoenix pack says so.

### A name with one shape in the core and another in a pack

- `confirmBooking` takes the catalogue and the instant and returns a
  list of events, in every pack that shows it, and lifts each step's
  error into its case of `ConfirmBookingError`.
- `ConfirmBookingError` has the core's two cases. The TypeScript pack's
  had a third, `Storage`; `ConfirmBookingFailure` is declared beside it
  as the handler's type. Every wrapper case carries its payload as
  `cause`.
- The ts-pattern pack's transition table calls `send`, `accept`,
  `expire` and `cancel` as `functional-modeling-state-machines` signs
  them, and has the table's fourth command.
- `SaveError` had two shapes in the core itself. `error-taxonomy.md`
  classified a thrown error into a duplicate, a transient fault and an
  opaque case under that name, and `persistence-patterns.md` declares
  it as `Conflict` or `Failed`. The taxonomy's example is an insert: it
  is `insertBooking` with an `InsertError` the page declares, and the
  JavaScript and TypeScript packs follow it.
- In the Effect pack `Payment` was declared with `kind` and two cases
  on one page and matched by `_tag` with three on another, and
  `SlotUnavailable` had two sets of fields. Each has one shape, and the
  pack's unions are discriminated by `_tag`.

### Pages that said a thing and showed nothing that did it

- The Elixir and Phoenix pages said a context answers `:unavailable`.
  Ecto raises when the database cannot be reached and answers a stale
  write with a changeset. The store functions turn both into values,
  `:unavailable` and `:conflict`; a row the domain forbids is
  `:corrupt_row`. `find_patient/1` crashed on the fault the page said
  it passes on.
- liveview.md called its broadcast a hint to read again and sent the
  events. It sends a hint, and the last clause of `handle_event/3`
  names the refusals it shows.
- The React page said the event handler performs an effect "with the
  state the reducer returned". `dispatch` returns nothing. The handler
  acts on a decision a pure function made, and the example shows it.
- The Next.js form state crossed to the client holding the workflow's
  error type. The action maps it with `toRefusal` first.
- otp.md awaited two tasks one after the other inside a `with`, which
  left the second running when the first failed. They are awaited
  together.

### Pack rules against the core rules they translate

- A view that only reads needs no second type: TypeScript 7, Next.js 2
  and Phoenix 2 now say what rule 1 of
  `functional-crossing-io-boundaries` says.
- Next.js rule 1 forbade a rule that runs on both sides, and the React
  pack told the reader to run one on both. What is forbidden is a rule
  written twice. React rule 1 says an async server component is shell.
- Effect rule 7 forbade running an effect outside the composition root,
  and the pack's own tests do; a test runs its own. Rule 2 says what a
  pure function does instead of the error channel.
- Elixir rule 5 said each step of a `with` returns the pipeline's
  error; each step keeps its own and is lifted.
- Rule 4 of `functional-modeling-with-algebraic-types` allowed no
  catch-all, and the ts-pattern pack allowed one over a pair of unions.
  The core rule says what a table over a pair may do with the pairs it
  does not list: one refusal that the caller sees.
- The ts-pattern pack says "arm" for the function of an arm. The XState
  pack says that XState's "event" covers what the core calls a command,
  that a machine drops an event no state handles, and whose rule the
  length of a hold is.

### How the nine packs were read

- Four readers with no context read every file of the nine packs
  against eleven core pages and reported 92 places. Each was ruled on,
  in 51 rulings.
- Four fresh readers read the result the same way and reported 68. Two
  were rulings from the first round that were wrong: `SaveError`, which
  was changed in the packs when the fault was in the core, and the
  React sentence about the reducer's state. 63 more rulings went in.
- The same readers went back over their findings: 65 of 68 answered,
  16 new. One more reader was given the nineteen passages written last
  and had something to say about eighteen, most of it small. What an
  agent would trip over was fixed; those last edits, about thirty, were
  read by nobody but their author.
- Every TypeScript and JavaScript example type-checks against the
  pinned libraries, on both majors of Effect where a page claims both,
  and every Elixir example parses. Library names were read in the
  packages' type definitions, or in the documentation of Ecto 3.14.2,
  db_connection 2.10.2 and Elixir 1.20.4.
- What these changes to the packs do to an agent's work was not
  measured.

### Work, as well as questions, in the evals

- `scripts/eval-plugin.mjs` graded only questions, and a question tells
  the agent that a design problem is in front of it. Nine task cases ask
  the agent to change a small project, `evals/fixture-tasks`, and grade
  the files it leaves behind. They come in three families: work the
  pack should change, work it should leave alone, and work where the
  project's own written convention wins. Each is one file in
  `evals/tasks`.
- A case passes in a run when every grader passes, leaving out the
  indicators that record which skills were loaded. Each family is summed
  apart, and the graders that failed are named for each case.
- `claude plugin eval` keeps Write and Edit behind an operator's grant,
  which a case's own list of tools does not give. The runner grants the
  two to the cases that ask for them, and refuses a case that asks for a
  shell or the network.
- One run of the smoke set, once for each case and arm: asked a design
  question, the agent loaded a skill about half the time; given work to
  do, it loaded none, and the two arms gave the same result. With the
  README's `CLAUDE.md` snippet as the project's instructions it loaded a
  skill in all three task cases and none for the throwaway script. One
  run for each case is a direction and not a number.

## 3.2.1

The labels on every core rule are now defined where an agent reads them,
each default says when it gives way, and the two worked examples answer
a third reading.

### The three labels had no definition in the plugin

- Since 3.0.0 every item under `## Core rules` has opened with `Rule.`,
  `Default.` or `Judgement.`. What the three mean was written in the
  README, `CONTRIBUTING.md` and `CLAUDE.md`, and none of those is part
  of the plugin. An agent had 260 labelled rules and no definition of a
  label.
- `functional-design` has a new section, "How strictly a rule is meant".
  It defines the three, says what to do with a default that states no
  condition, and says what comes before any label: the row of the table
  that sizes the task, and a convention of the codebase.
- `validate-rules.mjs` reads the labels from that section and keeps no
  list of its own, so a label the index does not define is a label no
  rule may carry. Three negative cases break the section and confirm the
  check fires.

### A default that did not say when it gives way

- Of 138 items labelled `Default.`, about 118 stated no condition. Every
  one was read against the whole pack for the page that limits or
  excuses it, and each was ruled on. No condition was invented: each
  comes from a page of the pack, or from a fact checked against the
  tool.
- 80 items gain a sentence of their own that says when the default gives
  way. A wrapper type is not for a value that lives and dies inside one
  function. "Data last" is reversed in a language whose pipe passes its
  value first. A pass-through stays when it narrows, translates, guards
  or isolates. A snapshot is stored, not derived.
- 22 had a condition that could not be checked, or that another page
  contradicted, and are rewritten: "a flat module", "few capabilities",
  "booleans that mean something", and "every step should shrink the
  impure region", which was false of seven of the ten moves.
- 7 are `Rule.` now, because another skill states the same thing as a
  rule: one type per stage, a phase in the type, a workflow that returns
  events, a recursion that reaches its base case, and one item each in
  the React, Next.js and Phoenix packs.
- 1 held two axes under one label and keeps the one that is its own. 28
  are unchanged: some already said when they give way, and the rest are
  ones the pack knows no exception to.
- Where two skills stated one rule, one of them owns the condition and
  the other points at it: exporting the least, deleting a pass-through,
  the order of arguments, where the wiring happens.

### Pages that disagreed with the rule beside them

- `naming-rules.md` had two rows that overlapped: a read through a
  capability that may find nothing was both `findX` and `loadX`, and the
  pack's pages used four verbs for it. `findX` and `getX` are for a
  value already held, and `loadX` for whatever reaches the world.
- `migration-moves.md` said that moves 1 to 4 can be done in any module
  at any time, against two rules of its own skill.
- `contexts-and-ecto.md` excused using an Ecto schema as the domain type
  "for a small project". The exception it gives now is the one the rule
  gives: a screen that only reads.
- `liveview.md` broadcasts after the write. Rule 4 of
  `functional-making-effects-reliable` now says that a notice which
  carries nothing a consumer keeps is outside it, and the page says its
  broadcast is one and can be lost.
- The two retry examples in the Effect pack had no jitter, in a pack
  that says backoff without jitter synchronises every client. Both use
  `Schedule.jittered`, on Effect 3 and on Effect 4.
- The Elixir pack says that its pipe passes the value first, so its
  functions take data first, and one private function that ran the
  other way is turned round.
- Three places broke the sentence beside them: a business threshold as
  a bare number in a `P.when`, an error value left unfrozen in a module
  whose first rule is to freeze what it exports, and a table row that
  asked for a measurement the sentence under it said was not needed.

### A report from a person that the process ignored

- In `worked-long-running.md`, a person who settled the undo in hand
  while the process was still `Undoing` was ignored, and a replay could
  then undo it a second time. `Undoing` takes `SettledByHand`.
- The page relied on one worker for each process and recommended a job
  queue, which does not give that. The save is conditional on the
  version that was loaded and answers `Stale`.
- `wants` has no default clause, a page is wanted only while the process
  is in the wait it is about, and `waitOf` gives the shell the wait an
  instruction starts.
- The page no longer says a unique constraint makes a call to another
  system idempotent. The hold and the release are the weakest of the
  three ways, and the page says what the adapter does about a repeat.
- The clock ends the offers of an instruction, and the queue's count of
  attempts does not. A replay skips the clock and is safe only inside
  the key's lifetime.
- Oban's pruner deletes cancelled and discarded jobs by age, sixty
  seconds unless it is given a `max_age`. The page had called a
  discarded job the dead letter that waits for a person.

### A refusal with no home, and two methods of one name

- In `worked-refactor.md`, the conversions that commits 2 and 3 add can
  refuse a stored row, and after commit 4 nothing said where that
  refusal went. It has one named home, the function that loads, until
  commit 10 gives it a type.
- The inner function is `handleConfirm` from commit 4, where the page
  had two methods called `confirm` on one class.
- The page says which tests go through the service and which are a
  commit's own, and commit 7 no longer claims that the pinned tests pass
  unchanged.
- The intro maps the eleven commits to the ten moves, and
  `decideConfirmation` takes the catalogue first, as `confirmBooking`
  does on every other page.
- `notation.md` defines the `module` form that six pages were using.

### How the new sentences and the two pages were read

- The conditions were written by the same hand that ruled on them, so
  three readers with no context were asked, for each of the 131
  defaults: when does it give way, could you check that, is it a
  loophole, does its own page disagree. Their first reports marked about
  fifty-five as loopholes and fifty as contradicted by their page.
  Forty-four places were rewritten, the same readers checked them, and
  thirteen more were rewritten and not read again.
- Each worked example was read by a fresh reader who type-checked it by
  hand and walked it. The same reader then checked the answers twice.
  The long-running process ended "yes". The worked refactor ended
  "almost", on a sentence that did not parse and three judgement calls.
- Checked against the tools' own documentation: what Oban does with
  `{:cancel, reason}` and what its pruner deletes; that Dialyzer warns
  about behaviour callbacks that drift from the declared interface;
  that `Schedule.jittered` exists on both majors of Effect.

No skill is added, renamed or removed, and no description changed.

## 3.2.0

Every core skill was read a second time, line by line, for rules that
contradict each other, examples that break their own rule, names with
two shapes, and steps an agent working alone cannot take. Each finding
was answered. The pack now gives one answer to where an effect goes, and
its words mean one thing each.

### Three skills gave three answers to where an effect goes

- `functional-separating-pure-core-from-shell` said the core returns
  decisions. The workflow in `functional-designing-workflow-pipelines`
  took capabilities and called them. `functional-parameterizing-dependencies`
  ranked the same choices in another order. A reader given all three and
  asked where a confirmation email is sent from found three answers.
- There is one model now. The core is pure: no function in it has an
  effect type or receives a capability. A handler, in the shell, reads,
  calls the core, and writes. Reading first is the default. A read
  cannot come first in three cases, which rule 1 of the parameterizing
  skill names, and then the handler reads between two pure functions.
  The core returns instructions only where the effects have to exist as
  data, as in a process that must resume after a restart. What follows
  from an event is another handler's work.
- The rules of the pure-core skill were rewritten to say this, and there
  are nine where there were eight.
- `worked-example.md` in the pipelines skill had a workflow that took
  four capabilities and held a slot in another system halfway through.
  It is rewritten on the same story as two pure functions with a read
  between them, with the type of every stage written out.

### Words that meant two things

- `notation.md` now defines the words the rules lean on: pure,
  deterministic, total, crash, rule, capability, core, shell, handler,
  workflow, command, event, instruction, decision, edge and idempotent.
  A command comes in from a caller; an instruction goes out from the
  core. The page had used one word for both.
- It also defines the forms the examples had been using without saying
  so: a lambda, `let`, a record copy, a list and its split, `where`,
  function clauses, and `map`, `bind` and `mapError` on a value from the
  left of a pipe.
- One name has one shape across the pack. `validateBooking`,
  `priceBooking` and `confirmBooking` take the catalogue, which had also
  been called a price list. A handler's failure type has a case for what
  the rules refused and a case for what storage could not do. The
  transition of a long-running process is `advance`, and it returns a
  list of `Instruction`. Reading the catalogue is `LoadCatalogue`, or
  `LoadCatalogueById` for one that a rule names. `withRetry` has one
  signature on the three pages that show it.

### Steps that assumed a person who is not there

- About thirty steps said to ask a domain expert, hand a diff to a
  colleague, or take numbers to whoever owns a convention. One skill
  said what to do alone; the others did not.
- `functional-design/references/working-alone.md` is new. It gives four
  substitutes in order: the repository, the user, a reader with no
  context, and saying plainly that the step was not done. It also says
  what does not substitute: the author's judgement of their own work, an
  invented answer, and a feeling where something can be counted.
- Each such step now says what is wanted and what to hand over, and
  links that page. Where a trigger was an opinion, it also names
  something to look at: the files a typical commit touches, the exports
  nobody imports, the history of a name.

### Rules their own pages broke

- A rule labelled `Rule.` that the pack excused somewhere else is now
  worded so the excuse falls outside it. The algebraic-types rule on
  wildcards forbids an arm that returns a value for a case it does not
  name. The rule that every command needs an identity covers commands
  whose effects cross a process boundary. The rule against magic values
  forbids a value that stands for a failure the caller must notice. The
  refactoring rule against widening a type forbids widening it to hold a
  different concept, and its rule on commits forbids two moves in one.
- Two rules could not be scoped and are `Default.` now, each with its
  condition in a sentence of its own: rule 3 of
  `functional-choosing-precise-names` and rule 7 of
  `functional-programming-strategically`.
- The deletion test in `functional-diagnosing-complexity` said to delete
  whatever the requirement does not mention. By that test the pack's own
  stage types and boundary types would go. What the test finds is a list
  of candidates, and it has a fourth outcome: keep what isolates a
  decision that changes on its own, or records a check that has run.
- Where two skills gave opposite advice, one test now separates the
  cases: copies that one person or one event changes together are one
  decision, and copies that different people change are two. Layers are
  ordered on two axes, with dependencies pointing at the domain.
- Decisions that were written in several places have one owner: patch or
  restructure, the note that records a debt, how much better a change
  leaves the code, and whose confusion counts as a finding.

### Two worked examples that could not be followed

- `worked-long-running.md` had nothing that started its process and
  nothing that led out of undoing, and its one deadline clause released
  a slot while the charge it was waiting for might have landed. A wait
  that runs out no longer moves the process: the state stays where a
  late answer will find it, and the core returns an instruction to tell
  a person. `Stuck` comes from a refused undo alone. An adapter's error
  says whether the call was refused or its outcome is unknown. Each
  effect takes a key derived from the command's key and the operation,
  because a provider that honours idempotency keys answers a reused key
  with the first call's result.
- `worked-refactor.md` said no commit changes behaviour. Checked commit
  by commit against its starting code, that was false in fourteen ways.
  The page now says what behaviour means, which is what its
  characterisation tests pin, and makes move 7 two commits: moving the
  reads in front of the checks is a change a caller can see, so it is
  made alone and says what moved. The page has eleven commits for ten
  moves, and `migration-moves.md` says when that half is a commit of its
  own.

### A clinic

- Lead examples that were a shipment, a cart, a conference or an invoice
  are a clinic's appointments, bookings and treatments. The customers in
  the core skills and in the JavaScript, TypeScript and React packs are
  patients.
- `CLAUDE.md` lists parcel shipments among the secondary example
  domains, since two language packs build their tagged-union pages on
  one.

### Checking pages that no check can read

- The notation has no parser, so nothing mechanical reads those
  examples. Pages that set the pack's doctrine were given to readers
  with no context, who type-checked them by hand and tried to build from
  them: the notation page; the three skills on effects, with six tasks;
  the ten pages those skills own; the reliability pages, three times;
  and the worked refactor, twice. Each report was answered before the
  page merged.
- A script listed every name declared with more than one shape in a
  `text` fence across the pack, and the ones that were the same thing
  written two ways were made one.
- Claims about tools were checked against the tools' own documentation:
  that `Oban.insert/5`, and not `insert/3`, adds a job to an
  `Ecto.Multi`; what Oban hands a worker and what it does with a job out
  of attempts; where pg-boss and BullMQ keep their jobs; and what Stripe
  returns for a reused idempotency key.

No skill is added, renamed or removed, and no description changed.

## 3.1.0

The Effect pack serves Effect 4 as well as Effect 3, and the checks hold
it to both.

### A pack that taught one major to projects on another

- `functional-typescript-effect` said its shapes target Effect 3.
  Effect 4.0.0 was published on 2026-10-01 and spells the service
  declaration, every schema constraint, decoding, the union, the retry
  schedule and the configuration readers differently, so an agent that
  followed the pack in a project on Effect 4 wrote code that does not
  compile.
- `SKILL.md` now starts by asking which major is installed, and says
  which page is for which. Its own examples hold on both majors. The one
  line of its lead example that differs, the service declaration, is
  left to the references.
- `references/effect-4.md` is new: a mapping from each Effect 3 name to
  what replaces it, and a compiled example for each shape that moved. It
  ends at the documentation Effect 4 ships inside the package, which
  matches the installed version where the page may not.
- The three existing references stay Effect 3, and each says so in its
  first lines.

### Checks that hold a pack to the major it names

- Effect 4 is pinned beside Effect 3 under the alias `effect-4`.
  `validate-types.mjs` can read a file's imports as another package,
  when its prelude opens with `// @resolve effect effect-4`, and can
  check one Markdown file against a second prelude. The examples keep
  saying `from "effect"`, and `SKILL.md` is type-checked twice.
- `validate-skills.mjs` only looked for the words "installed version" in
  a library pack. It now compares the major each pack names with the
  major `package.json` pins, in both directions.
- Dependabot proposes a new major of a library the examples are checked
  against, and nothing else in npm. An alias is left out of its list,
  because Dependabot does not rewrite one, and `effect` ignores the
  major the alias already holds. The type check fails when that list
  and its own differ.
- `negative-test.mjs` goes from fifty-five guards to sixty-nine.

### What was run, beyond the checks

- The three Effect 3 references were type-checked against Effect 4.0.2.
  Every error the compiler reported is an entry in the mapping or
  follows from one.
- The examples of `effect-4.md` were read from the page and run against
  4.0.2. The schema normalises and rejects as the page says, the custom
  transformation holds both ways, the retry makes four attempts, and the
  round-trip property passes on the page's schema and fails on one that
  loses case.

No skill is added, renamed or removed.

## 3.0.4

Every example written in a real language was compiled or run, and every
claim about a tool was checked against the tool. What failed is fixed,
and the check that does this now runs on every change.

### A Server Action that never asked who was calling

- The lead example of `functional-typescript-react-nextjs` parsed a form
  and ran a workflow without checking the caller. A Server Action is
  reachable by a direct POST from anyone, so an agent that copied it
  wrote an endpoint with no authentication. The rule requiring the check
  was in the reference file only.
- "A Server Action is a public endpoint" is a core rule now. The example
  takes the caller from the session, and the form no longer carries the
  patient's identifier, which let one patient book for another.
- The caching section named no function. It names `cacheTag`,
  `updateTag`, `revalidateTag` and `revalidatePath`, says what the next
  reader sees after each, and the action calls one. It points at the
  documentation Next.js 16 ships inside the package, which matches the
  installed version where the skill may not.

### Examples that did not compile

- `functional-typescript`: an error typed as the global `RangeError`; a
  validator interface no real schema was assignable to; a pipeline that
  bound a total function; a `return` outside a function.
- `functional-typescript-effect`: `Schema.InstantFromSelf` and
  `Schema.Arbitrary`, which Effect 3 does not have; an error built with
  the global `RangeError`; a bare type expression; two "styles" of one
  workflow that were two different programs.
- `functional-typescript-react`, `-xstate` and `-ts-pattern`: seven
  fences, among them three before-and-after pairs that redeclared their
  own names and a pattern catalogue that matched a tuple against an
  object.
- `functional-elixir-phoenix`: a mapping that built a struct with a key
  the struct does not have, and two signatures that were not Elixir.
- `functional-elixir`: a GenServer with no `init/1`.

### Claims about tools that were not true

- The Elixir pack said the language has no compiler that rejects an
  illegal state, and that a misspelled struct field is a compile error.
  On Elixir 1.20 the compiler infers types from patterns and guards and
  warns; it does not read `@spec`; a misspelled field raises `KeyError`
  at run time. The pack now asks for `mix compile --warnings-as-errors`
  beside Dialyzer.
- `Repo.transaction/2` is deprecated in Ecto 3.14. The Phoenix pack uses
  `Repo.transact/2`, and its rule about `Ecto.Multi` follows Ecto's own
  guidance: control flow inside `transact` by default, a multi for steps
  built at run time.
- The comparison of schema libraries called Zod the largest of four and
  ArkType small, and said all three of Zod, Valibot and ArkType have an
  abort-early mode. Measured, ArkType is the largest and only Valibot
  has the mode. The examples were Zod 3 with no major named; they are
  Zod 4 and say so.
- The JavaScript pack said a type checker over JSDoc reports a missing
  case. It does only when the `default` branch passes the value to a
  parameter typed `never`.
- `Schema.trimmed()` in the Effect pack is a filter and rejected a
  padded code that the same example in two other libraries normalises.
- Two statements about XState 5 were wrong: a pending delay is not
  restored after a restart, and a transition target is not type-checked
  while `snapshot.matches()` is.

### Rules their own examples broke

- `functional-elixir` forbade every catch-all clause while its `confirm`
  and every `new/1` ended in one, and recommended an `else` in `with`
  that Elixir's documentation lists as an anti-pattern. The first rule
  now covers a domain choice and names a parser of outside input as the
  opposite case; the second has each step return the pipeline's error.
- `functional-typescript-ts-pattern` said to end every match with
  `.exhaustive()` and then called its own `.otherwise()` legitimate. The
  rule covers a match over a union; a match over a pair is a table.
- `functional-javascript` asked for construction through functions and
  showed a class with a public constructor beside its parser, and a
  `fromDto` that spread whatever arrived into a domain value.
- `functional-typescript-react` showed a loaded list that could be empty
  beside a separate empty state; `functional-typescript-xstate` read its
  context with a cast.
- `functional-elixir-phoenix` gave one context function three names and
  two return shapes.
- `pipe` composed functions in the JavaScript pack and pushed a value in
  the TypeScript pack. It pushes a value in both.

### What a word-level rename left behind

- Three sentences in which "order", meaning sequence, had been renamed
  with the domain's orders; a shipping department in a clinic; a product
  team that had become a treatment team; `OrderDtoV2` beside
  `BookingDto`; and a clinic booking routed to a courier.
- `validate-prose.mjs` catches those three idioms now; the others were
  found by reading.

### Checks that would have caught this

- `scripts/validate-types.mjs` type-checks every TypeScript, TSX and
  JavaScript example against libraries pinned in `package.json`, under
  the compiler options the TypeScript pack recommends, and resolves
  every library member named in prose. What an example assumes is
  declared in a prelude under `example-types/`, outside the plugin; a
  prelude may only declare, and is itself checked. One hundred and
  twenty-seven examples in twenty-two files pass.
- The Elixir examples are parsed in continuous integration, which now
  installs the toolchain. Asking for the parse on a machine without
  Elixir printed a skip and reported every fence as parsed, and a stray
  `end` in one fence killed the parser and reported every fence as
  parsed. Both fail now.
- `validate-prose.mjs` catches three more idioms that a rename fills
  with a domain noun, and `validate-counts.mjs` holds three more counts.
- `validate-skills.mjs` fails when the names and descriptions of the
  skills outgrow a ceiling that only comes down, because Claude Code
  drops descriptions from a listing that overflows its budget. It also
  fails on a manifest key Claude Code does not document: `plugin.json`
  carried one, and `claude plugin validate --strict` rejected the plugin
  for it.
- `scripts/eval-plugin.mjs` grades the answers to the scenarios with the
  pack loaded and with no plugin at all, through `claude plugin eval`.
  It is tooling only: no result from it is claimed in this release.
- `negative-test.mjs` goes from forty-one guards to fifty-five.

## 3.0.3

A pack that teaches a library now says which major its shapes target,
and a check keeps it saying so.

### One pack in six carried a version caveat

- `functional-typescript-effect` told the reader to check the installed
  version before writing code. The five other packs that teach a library
  said nothing, so the same reader was warned about Effect's majors and
  told nothing about XState's -- and XState 5 reorganised everything
  around actors, renaming `interpret` to `createActor` along the way.
- `validate-skills.mjs` now requires that caveat from any pack whose
  name extends another pack's name. That is the one thing observable
  from the name: such a pack is the delta for some library, and a
  library has majors. Six packs are in scope, and one already passed.
- The base packs are out of scope on purpose. `functional-javascript`
  and `functional-elixir` name only long-stable language features, and a
  version caveat over freezing and `defstruct` would be a sentence that
  earns nothing.
- The five now name what they target: ts-pattern 5, XState 5, React 19,
  the App Router on Next.js 16, and Phoenix 1.8 with LiveView 1.2 and
  Ecto 3. Each number was read off that library's own registry rather
  than written from memory.
- The check went in before any of them were fixed and listed all five.
  `negative-test.mjs` gained a case that breaks it on purpose, taking
  the guard count from forty to forty-one.

### A compiler option that stops the build

- `functional-typescript` recommends a set of compiler options carrying
  `erasableSyntaxOnly`, which arrived in TypeScript 5.8. On anything
  older `tsc` answers `error TS5023` and stops, so the skill sent a
  reader to a failed build rather than to a weaker guarantee. It says so
  now.
- Nothing observable separates that flag from an option that has been
  there for a decade, so this one is carried by the prose rather than by
  the check, and `CLAUDE.md` says as much rather than implying the check
  covers it.

### The language-pack list lives in one place

- `validate-counts.mjs` parsed the index's `## Language packs` section
  to tell a pack from a core skill. `validate-skills.mjs` came to need
  the same list, so the parse moved into `lib/pack.mjs` instead of being
  copied into a second reader. It throws on an empty list, so neither
  caller can report a zero as a pass.

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
