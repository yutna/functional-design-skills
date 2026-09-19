# Property Testing

A property test states something that must be true for every input, and
the framework searches for a counterexample. It complements example
tests: examples pin down the cases people care about, properties cover
the space nobody thought of.

## Contents

- [Which library](#which-library)
- [Finding a property](#finding-a-property)
- [Generators](#generators)
- [Shrinking](#shrinking)
- [Where properties beat examples](#where-properties-beat-examples)
- [Where examples beat properties](#where-examples-beat-properties)
- [Stateful property testing](#stateful-property-testing)

## Which library

Guidance that says "the framework" cannot be acted on. These are the
ones the language packs in this pack assume.

| Stack            | Library                                 |
| ---------------- | --------------------------------------- |
| JavaScript       | `fast-check`                            |
| TypeScript       | `fast-check`, with `@fast-check/vitest` |
| Elixir           | `stream_data`                           |
| Erlang or Elixir | `propcheck`, for stateful models        |

`fast-check` supplies `fc.assert`, `fc.property`, and the `fc.*`
arbitraries; `@fast-check/vitest` adds `test.prop` so a property reads
like any other test. `stream_data` supplies `check all` inside
`ExUnit`, and ships `ExUnitProperties` for the generators.
`propcheck` wraps PropEr and is the one of the two with a
command-sequence model built in, which is what the last section here
needs.

Pin whichever you choose to an exact version. A generator library that
changes its shrinking between patch releases changes which
counterexample a failure reports.

## Finding a property

Ask what is true regardless of the input. The recurring answers:

**Round trip.** Anything with two directions.

```text
forAll validBooking $ \o -> fromDto (toDto o) == Ok o
forAll anyText $ \s -> render (parse s) == normalise s
```

The single highest-value property in a codebase, because boundary
mappings are where silent data loss happens.

**Invariant preservation.** A constructed value always satisfies its
rule, and every operation preserves it.

```text
forAll anyString $ \s ->
  match parseTreatmentCode s with
  | Ok c -> length (unwrap c) == 5
  | Error _ -> true
```

**Totality.** For any input of the declared type, the function returns
without raising.

**Idempotence.** Applying twice equals applying once: normalisation,
sorting, deduplication, and any effect that may be retried.

**Model equivalence.** Compare against an obviously correct but slow
implementation.

```text
forAll anyList $ \xs -> fastSort xs == sort (bruteForce xs)
```

**Algebraic laws.** Identity and associativity for a combination,
commutativity where claimed. See
[monoids.md](../../functional-folding-over-data/references/monoids.md).

**Metamorphic relations.** How the output must change when the input
changes: adding a treatment never decreases the total; filtering then sorting
equals sorting then filtering.

## Generators

Write generators for domain types, not for primitives, and build them
from the smart constructors so every generated value is valid.

```text
genQuantity = choose (1, 1000) |> map Quantity
genBookedTreatment = map2 makeTreatment genTreatmentCode genQuantity
genBooking = genNonEmptyList genBookedTreatment |> map makeBooking
```

Two extra generators are worth having:

- **An invalid generator**, producing values that must be rejected, to
  test the parser's error paths.
- **A biased generator**, weighted towards boundaries: zero, one, the
  maximum, empty, single-element, duplicates.

## Shrinking

When a property fails, the framework reduces the counterexample to the
smallest failing input. Make sure it is enabled and that custom
generators support it; a failure reported as a two-hundred-element list
is far less useful than one reported as a two-element list.

Always record the seed of a failure and add the shrunk counterexample as
a permanent example test.

## Where properties beat examples

| Subject                     | Why                            |
| --------------------------- | ------------------------------ |
| Parsers and serialisers     | Round trip covers everything   |
| Smart constructors          | Invariant over arbitrary input |
| Sorting, merging, dedup     | Model equivalence              |
| Money and date arithmetic   | Laws and boundaries            |
| State machines              | Random command sequences       |
| Fold and combine operations | Associativity and identity     |

## Where examples beat properties

- A specific business rule with a named threshold
- A regression from a real bug
- A case a domain expert asked about by name
- Anything where the property would restate the implementation

The last one is the common failure: a property that reimplements the
function to check it passes always, and tests nothing.

## Stateful property testing

Every property above takes one input. A lifecycle takes a history, and
the bugs live in the histories nobody thought to write down: cancel
after expiry, two accepts in a row, a refund before the payment settled.
Generating the sequence is what finds those.

Four pieces, and the whole technique is getting them separate.

**The commands.** A choice type, one case per thing a user or another
system can ask for, each carrying its arguments. This is the same type
the transition table in
[functional-modeling-state-machines](../../functional-modeling-state-machines/SKILL.md)
already names, so it is usually already written.

```text
type Command =
  | Send of Instant
  | Accept of { by: CustomerId, at: Instant }
  | Cancel of { reason: Reason, at: Instant }
```

**The model.** A deliberately stupid version of the state, holding only
what the properties need to talk about. Its job is to be obviously
right, not efficient. For a quote, that is often a single tag plus one
timestamp.

**The precondition.** Given the model, may this command be issued at
all? Without one, most generated sequences stop at the first illegal
command and the rest of the sequence is never exercised. With one, the
generator keeps producing sequences that go somewhere.

**The postcondition.** After running the command against the real
implementation, does the result agree with what the model says, and do
the invariants still hold?

```text
-- one step: model and implementation must stay in step
runCommand (state, model) command =
  let next      = apply command state
      nextModel = applyToModel command model
  in agrees next nextModel && invariantsHold next
```

The property is then: for any sequence of commands whose preconditions
hold in turn, every step agrees.

Three things to get right, because each one silently weakens the test:

1. **Shrink the sequence, not only the values.** A failure reported as
   forty commands is a rumour. The libraries that support this remove
   commands from the middle and re-check, which usually reduces a
   failure to two or three. `propcheck` does it out of the box;
   `fast-check` needs `fc.commands`, which shrinks the command list.
2. **Let the model disagree about performance, never about outcomes.**
   If the model needs the implementation's data structure to answer, it
   is no longer independent and the test compares the code to itself.
3. **Generate illegal commands on purpose too**, in a second property,
   and assert they are refused rather than silently applied. The
   precondition keeps them out of the first property; nothing else would
   check the refusals.

What this finds that examples do not: a transition that is legal twice
when it should be legal once, a guard that reads the wrong timestamp, a
terminal state that is not terminal, and any invariant that holds after
each command in isolation but not after a particular pair.
