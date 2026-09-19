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
- **Coverage is not inflated by that.** Checked directly: zero of the 145
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
