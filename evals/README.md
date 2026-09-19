# Evals

Two checks on whether the pack routes a problem to the right skill. They
prove different things, and neither proves what the other does.

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

- **Places below the first are often alphabetical.** A median of 33 of
  the 40 skills score exactly zero on any given case, and `rank` breaks
  ties by name. So the second and third places are frequently filled by
  whichever zero-scoring skill sorts earliest. The first measurement of
  noise reproduced alphabetical order almost exactly before it was
  restricted to skills that actually matched a word.
- **Coverage is not inflated by that.** Checked directly: zero of the 105
  cases place their expected skill in the top three with a score of zero.
  Every pass is earned on shared vocabulary. The gate is sound.

The general lesson for anyone extending these evals: before adding a
check, give the pack the defect the check is meant to catch and confirm
the check fires. A gate that cannot fail on a real defect is worse than
no gate, because it reads as coverage that is not there.

## 2. Scenarios — manual, against a real agent

[scenarios.md](scenarios.md) holds thirty-seven fuller problems, each a
paragraph of realistic context with the response a correct answer must
contain. Run them by hand in an agent session with the pack installed:

1. Install the pack into a scratch project, per the main README.
2. Start a session there and paste one scenario as the whole prompt.
3. Record which skill the agent loaded first and whether the response
   contains the required elements.
4. Note anything the agent did instead, which is usually more
   informative than a pass.

**What it proves:** the pack works end to end for that scenario, with
that agent, on that day.

**What it does not prove:** anything stable. Results move with the model
and with the rest of the session's context, so this is a spot check, not
a regression test. Do not record a score from it as though it were one.

## Adding cases

Add a routing case whenever you catch yourself describing a problem in
words the pack does not contain. Add a scenario when a real task needed
more than one skill and the order mattered.

Keep case wording as it was actually said. A case rewritten until it
passes tests nothing. If a case fails, either the description is missing
a trigger word or the expected skill was the wrong answer -- fix whichever
it is, and leave the wording alone.

Scenarios come in pairs where a rule has a direction. Scenario 30 must
take the generic route and scenario 31 must refuse it; testing only the
permissive direction would not notice a rule that had become an escape
hatch.
