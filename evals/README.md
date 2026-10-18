# Evals

Three checks on whether the pack routes a problem to the right skill. They
prove different things, and none proves what the others do.

## 1. Routing keyword coverage — automated

```sh
node scripts/eval-routing.mjs            # summary, plus any miss
node scripts/eval-routing.mjs --report   # rank for every case
```

Scores each symptom in [routing-cases.md](routing-cases.md) against the
`name` and `description` of every skill — the text an agent sees before
it opens anything — and reports where the expected skill ranked. It runs
in `npm test` and fails the build if any expected skill falls
outside the top three.

**What it proves:** every skill's description contains enough of the
words people actually use for that problem to be a plausible candidate.

**What it does not prove:** that an agent routes correctly. It is a bag
of words with no idea what any of them mean. A description could pass by
containing the right nouns while describing the wrong thing.

Treat a failure as a defect in the description, not in the case. If a
symptom is phrased the way a developer would phrase it and the skill does
not surface, the skill is missing a trigger word.

Three flags worth knowing:

- `--profile full` also scores each skill's "When to use" section. It
  scores _better_ on exact matches and slightly worse on top-three
  coverage, because the extra text adds noise as well as signal. The
  gate uses descriptions only, because that is what discovery sees.
- `--noise` lists, per skill, how many cases it reaches the top three for
  without owning them. Useful when adding a skill, to see whose territory
  the new description overlaps. It does not gate; the next section says
  why.
- The scorer stems a few suffixes so `skill` and `skills` are one term.
  Irregular forms such as `broke` and `break` are still two, so phrase
  cases in the present tense where it does not distort them.

### Why noise is reported but does not gate

The check measures false negatives only: a skill that should have
answered and did not surface. The obvious complement is a false-positive
gate — catch a description so general that it crowds the top ranks for
problems it does not solve. That was built, then measured, and the answer
was that there is nothing to catch.

Giving a skill a deliberately vague description ("use when code is hard
to work with, when something is wrong") raised its noise by 2 and made it
**fail coverage** instead. Inverse document frequency already gives common
words almost no weight, so a description made of them scores near zero on
everything, including its own cases. Over-generality is a coverage
failure, not a separate one.

Two things came out of building it anyway, both worth knowing:

- **Places below the first are often alphabetical.** A median of 36 of
  the 43 skills score exactly zero on any given case, and `rank` breaks
  ties by name. So the second and third places are frequently filled by
  whichever zero-scoring skill sorts earliest. The first measurement of
  noise reproduced alphabetical order almost exactly before it was
  restricted to skills that actually matched a word.
- **Coverage is not inflated by that.** Checked directly: zero of the 154
  cases place their expected skill in the top three with a score of zero.
  Every pass is earned on shared vocabulary. The gate is sound.

The general lesson for anyone extending these evals: before adding a
check, give the pack the defect the check is meant to catch and confirm
the check fires. A gate that cannot fail on a real defect is worse than
no gate, because it reads as coverage that is not there.

## 2. Scenarios — against real agent sessions

[scenarios.md](scenarios.md) holds forty-two fuller problems, each a
paragraph of realistic context with the response a correct answer must
contain.

```sh
node scripts/eval-scenarios.mjs              # all of them
node scripts/eval-scenarios.mjs --only 1,30  # just these
```

Each scenario runs as the whole prompt in its own session, and the script
reports which skill the agent loaded first. It is not in `npm test`: it
costs money, it needs the `claude` CLI signed in, and the result moves
with the model, so it is a measurement rather than a gate.

Two details decide whether the number means anything, and both were
learned by getting them wrong first.

- **The session must contain this pack and nothing else.** The script
  passes `--setting-sources ''` and loads the plugin from disk. Without
  that, whatever else the operator has installed competes: on the first
  run a skill from an unrelated plugin answered a scenario before this
  pack saw it.
- **The session must have code to look at.** Several scenarios open with
  "review this" or "I have three nested loops", written to be pasted where
  the code is already open. Run against an empty directory the agent
  correctly asks for the file instead of answering, and three scenarios
  scored as routing failures that were nothing of the kind. Sessions run
  inside a copy of [fixture](fixture), a small project with the shapes
  those scenarios describe.

**What it proves:** that a real agent, given this pack and nothing else,
loads the skill the scenario was written for.

**What it does not prove:** anything stable. Re-running moves the result by
a scenario or two in either direction, so a mis-route is a question to look
into rather than a defect. Roughly half of them turn out to be a
neighbouring skill giving a defensible answer: a nullable status with
correlated fields is a state machine as fairly as it is an illegal state,
and "capabilities passed as parameters" is in the scenario's own list of
things a correct answer contains.

Reading the answer is the point, not the score. Each session leaves its
transcript beside the fixture it ran against.

### Grading the answers against a baseline

`eval-scenarios.mjs` reports which skill a session loaded. It does not
read the answer, and it cannot say whether the pack made the answer
better. A second runner does both:

```sh
node scripts/eval-plugin.mjs --dry-run     # build the cases, call nothing
node scripts/eval-plugin.mjs --tag smoke   # a few scenarios, both arms
node scripts/eval-plugin.mjs               # every scenario, both arms
```

It turns each scenario into a case for `claude plugin eval`. The block
quote is the prompt, the prose under it is the rubric a judge model
grades the final answer against, and the skill it should reach becomes an
indicator. Every case runs with the pack loaded and again with no plugin
at all, so the result is a pair of pass rates and the difference between
them.

**What it proves:** whether answers written with the pack meet the
scenario's own criteria more often than answers written without it.

**What it does not prove:** that the judge is right. The rubric was
written for a person and a model is reading it, a run is one sample of a
non-deterministic agent, and a difference smaller than the spread between
repeated runs is not a difference. Read the answers behind any number you
intend to act on; the result file keeps each one.

The cases are generated into a throwaway copy of the plugin and never
committed, so `scenarios.md` stays the only place a scenario is written
down and nothing is added to what `plugin/` ships. Results land in
`evals/results/`, which git ignores.

It costs money, as the runner above does: every run and every judge call
is a model call on your account. `--max-cost-usd` sets a ceiling and has
a default. `--runs`, `--only` and `--ablation none` make a pass cheaper.

Each question case carries one sentence in its system prompt: the code
the user describes is not in this workspace, so answer from the
description. The prompts describe code the fixture does not contain, and
an agent that searched for it ended on "I can't find the code", which is
all the judge reads. A run reaches the expected skill by calling the
`Skill` tool or by opening its `SKILL.md` with `Read`, as a link in the
index invites; either counts, once.

Each run's trace is copied to `traces/` in the results folder, and
`summary.json` lists under `skillsLoaded` the skills each run loaded and
under `skillFilesRead` the skill files it opened with `Read`, so a skill
used instead of the expected one can be named. `--keep` keeps the
generated directory and the tool's workspaces as well.

#### Task cases

A scenario is a question, and a question tells the agent that a design
problem is in front of it. Most work does not. The nine task cases ask
the agent to change code in a small project and grade the files it
leaves behind. They come in three families:

- **task**: work where the pack should change what is built;
- **restraint**: work where the pack should change nothing, such as a
  throwaway script, a one-line fix or a ticket nobody has decided;
- **precedence**: work where the project's own written convention
  disagrees with the pack, and the convention wins.

Each case is one file in [tasks](tasks), written as `claude plugin eval`
reads a case, and its file name is its `name`. The project they run in is
[fixture-tasks](fixture-tasks), whose `CONVENTIONS.md` is the written
convention the precedence case is graded against. The runner copies each
file as it is, and adds only the text of `--system-file`.

```sh
node scripts/eval-plugin.mjs --tag restraint    # one family
node scripts/eval-plugin.mjs --only 1,t04-publish-on-confirm
```

`--tag` takes a family, `question` for the scenarios, or `smoke`.
`--only` takes scenario numbers and case names in one list.

A run that holds both kinds is made as two invocations of the tool, the
question cases first, because the write grant would otherwise reach the
question cases. A question case is measured with the tools it asks for
only. The cost ceiling covers both, and the second does not start if the
first ended partial.

A case passes in a run when every one of its graders passes, leaving out
the indicators. An indicator is a `tool_used` grader whose name begins
`loaded-`; it records what the agent did on the way and decides nothing.
The summary gives each family its own pass rate with the pack and without
it, how often each indicator fired in each arm, and, for each case, the
graders that failed in at least one run. That last list is how a failure
is traced to the one point it tests. A run that ended in an error, and a
run in which a judge gave no verdict, are reported apart and counted for
neither arm.

### Running them by hand

The script automates what this section used to ask for, and the manual
route still works when you want to watch one:

1. Install the pack into a scratch project, per the main README.
2. Start a session there and paste one scenario as the whole prompt.
3. Record which skill the agent loaded first and whether the response
   contains the required elements.
4. Note anything the agent did instead, which is usually more
   informative than a pass.

## 3. What the first automated run found

The forty-two scenarios were run this way for the first time in 3.0.1, on
Sonnet, one session each:

```text
expected skill first: 31/41   no skill loaded: 4/42
```

Forty-one, because scenario 37 names no skill: it is a behaviour test.

Read the four that loaded nothing before reading the thirty-one. One of
them is scenario 4, whose stated requirement is "recognition that this
needs almost none of the pack" -- an agent that answers a one-off script
question without reaching for a skill has done the right thing, and
scoring it as a failure would be scoring the wrong thing. The other three
were answered from general knowledge, correctly enough, with the pack
sitting unopened.

Of the ten that went elsewhere, most went next door. Scenario 1's nullable
status with correlated fields is a state machine as fairly as it is an
illegal state. Scenario 3's list of things a correct answer must contain
includes "capabilities passed as parameters", which is the skill that
answered it.

An earlier run of the same forty-two, before the fixture existed, put the
first skill right 32 times. The difference between 31 and 32 is the noise
floor of this measurement, which is the number worth remembering about it.

Nothing in the pack was changed because of any of it. A description tuned
until one sampled run goes green is a description fitted to noise.

## 4. What the 3.2.2 baseline found

Every scenario and every task case was graded on 3.2.2, three runs per
case in each arm, with Sonnet 5.5 as both agent and judge. A third arm
ran the pack with the block from the main README's "Tell the agent the
pack is there" passed as `--system-file`, which is how a case stands in
for a project's `CLAUDE.md`:

```text
                   pack and block   pack alone   no pack
scenarios          60/126           52/126       19/126
  loaded a skill   114/126          85/126
task               12/15            11/15        9/15
  loaded a skill   11/15            1/15
restraint          6/9              5/9          5/9
precedence         3/3              3/3          3/3
```

Three things follow, and one thing does not.

**The pack helps where it is read.** Ten scenarios loaded no skill in
any run of the pack-alone arm, and on those ten the two arms passed the
same 6 of 30 runs. The whole difference comes from the cases where the
agent opened a skill.

**Work does not open it.** Asked a design question, the agent loads a
skill two times in three. Asked to change code, it loaded one in a
single task run out of fifteen, so for most real work the pack sat
unread. The block changes that, 11 runs of 15, without costing
restraint: the throwaway script and the one-function fix were still
left alone.

**Loading is not enough.** `t04-publish-on-confirm` and
`t05-undecided-ticket` failed every run in every arm, and scenarios 9,
12, 16, 18, 28, 29, 32 and 34 to 41 failed every run with the block,
and half of those that name a skill had loaded it in every run. Those
answers have to be read before any skill is changed for them, because a
rubric the judge reads too literally fails an answer in the same way a
skill that misses the point does.

**What it does not show** is that the block raises the score. With
three runs per case, it lifted nine scenarios and lowered three, which
is a direction and not a result.

The question numbers above were taken before the question cases told
the agent that the code is not in the workspace. In 45 of 126 pack-arm
runs and 59 of 126 block-arm runs the final answer said the code could
not be found. With the block those answers passed 22 of 59, against 38
of 67 for the rest, so the numbers measure the fixture as well as the
pack. They are rerun under the new cases in section 5.

They were also taken in runs that held the task cases, and the tool's
write grant reaches every case in a run, so the question cases had
Write and Edit as well. The runner now makes a run of both kinds as two
invocations; sections 5 and 6 ran the question cases on their own.

The runs were made in pieces with `--only`, because the account's usage
limit ended the longer runs part way. A case was kept
from a piece only when every one of its runs in that arm finished with
no error and a judged verdict; the rest were run again.

## 5. The question rerun under the new cases

Every scenario was run again on the content that followed 3.2.2, with
the sentence that says the code is not in the workspace, three runs per
case in each arm and Sonnet 5.5 as both agent and judge. "Reached"
counts the runs that opened the skill the scenario expects, out of
those that name one:

```text
                     pack and block   pack alone   no pack
scenarios            80/126           58/126       25/126
  loaded a skill     107/126          65/126
  reached            98/123           62/123
the 3.2.2 baseline   60/126           52/126       19/126
```

**The block raises the score.** Against the pack alone it lifted
thirteen scenarios and lowered two, by 24 runs against 2. In 3.2.2 it
was nine against three, which was a direction; this is a result, though
each case still rests on three runs.

**Every arm scored higher, the no-pack one too.** With the fixture out
of the way an agent answers in one to three turns instead of searching.
In those shorter runs the pack alone opened a skill in 65, against 85
in 3.2.2, so without the block the pack is read less often than the
baseline suggested.

**Where it still fails.** Eleven scenarios failed every run with the
block: 9, 12, 18, 23, 32, 34, 35, 36, 39, 40 and 41. Three of them, 9,
32 and 34, never reached the expected skill, so they are routing
questions. The other eight reached it in at least one run, so their
answers have to be read against the rubric before a skill is changed
for them.

`t05-undecided-ticket` was run again too, since the skill it tests was
changed after 3.2.2 to agree with its rubric. It still failed every run
in both arms without the block: the agent loaded no skill, designed the
report, and wrote code in four runs of six.

## 6. What D3 changed, measured before it merged

The eleven scenarios that failed every run with the block were read
answer by answer. Three never reached the skill they expect, because
its description lacked the user's words. The rest reached it and missed
for a reason in the skill's text: a point only a reference made, a rule
that read two ways, and in one place two pages that said opposite
things about an undecided problem. Each change was measured on its
branch against the rerun above, with neighbouring scenarios held out,
so that a gain on a target could not hide a loss next door. Substance
passes, three runs per case:

```text
                                       rerun   after
descriptions, with the block
  scenarios 9, 32, 34                  0/9     5/9
  held out 7, 10, 15, 17, 20, 33       18/18   16/18
descriptions, pack alone
  scenarios 9, 32, 34                  0/9     4/9
  held out 7, 10, 15, 17, 20, 33       9/18    11/18
skill text, with the block
  scenarios 18, 23, 35, 36, 40, 41     0/18    5/18
  held out 4, 6, 37, 42                8/12    10/12
```

**The three routing misses now reach their skill** in every run with
the block, 9 of 9 against none. Scenario 32 passed two runs of three
once the point its rubric wants moved from a reference into the skill's
own file. Scenario 34 still fails, on its rubric's "proposes removing an
existing `useCallback`": the prompt's convention names `memo()`, and
whether it covers the callbacks is a question about the case, left
open. The two held-out runs lost with the block loaded the same skill
as before, which no description change touched.

**Two rubrics changed, and the numbers say where.** Scenario 23's "write
them before the implementation" now applies to new code, as the
skill's own rule does. `t05`'s "says what to produce instead" asked for
the rules written with examples, while its other grader failed any rule
the agent made up; it now accepts naming the rules as the thing to
produce. With the block it passed three runs of three, against none in
3.2.2, and that needs the rubric change as well as the skill's: no run
wrote code or designed the report any more.

**Still failing every run with the block:** 12, 18, 23, 34, 35, 36 and
39. They go into the release as open, not as fixed.

## 7. The task cases on the release content

The task cases were run again on the content that ships as 3.3.0, three
runs per case in each arm, apart from the question cases, so that the
write grant reached only the cases that ask for it. A run passes when
every grader other than the indicators passed:

```text
                     pack and block   pack alone   no pack
task                 11/15            11/15        9/15
  loaded a skill     12/15            1/15
restraint            9/9              6/9          4/9
precedence           3/3              3/3          3/3
the 3.2.2 baseline
  task               12/15            11/15        9/15
  restraint          6/9              5/9          5/9
  precedence         3/3              3/3          3/3
```

**Restraint is where the release moved.** `t05-undecided-ticket` passed
three runs of three with the block, against none in 3.2.2 and none here
without it: the agent loaded the index, wrote no code, and said the
rules had to be decided first. The throwaway script and the one-function
fix passed every run with the block and loaded no skill, so the block
did not pull the pack into work that does not need it.

**The task family held.** `t03-refund-rules-testable` lost one run of
three with the block, where the agent moved the rule into a pure
function and took away the entry point its callers use.
`t04-publish-on-confirm` failed every run in every arm, as it did in
3.2.2, and loaded no skill in any of them, so it is a routing question
and still open.

**Without the block the pack is still seldom read at work:** it opened
a skill in one task run of fifteen, as in 3.2.2. The no-pack arm, which
nothing in the release touches, moved by one run, which is the size of
the spread between repeats.

With the block, the pack is below no pack in no family, and above it in
task and restraint.

## Adding cases

Add a routing case whenever you catch yourself describing a problem in
words the pack does not contain. Add a scenario when a real task needed
more than one skill and the order mattered.

Keep case wording as it was actually said. A case rewritten until it
passes tests nothing. If a case fails, either the description is missing
a trigger word or the expected skill was the wrong answer -- fix whichever
it is, and leave the wording alone.

Scenarios come in pairs where a rule has a direction. Scenario 30 must
take the generic route and scenario 31 must refuse it; scenario 41 must
adopt a statechart and scenario 42 must refuse one. Testing only the
permissive direction would not notice a rule that had become an escape
hatch.
