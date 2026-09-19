# Property Testing

A property test states something that must be true for every input, and
the framework searches for a counterexample. It complements example
tests: examples pin down the cases people care about, properties cover
the space nobody thought of.

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
[monoids.md](../../folding-over-data/references/monoids.md).

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

For a state machine, generate a sequence of commands, apply them, and
assert the invariants after each step.

```text
forAll (listOf genCommand) $ \commands ->
  let states = scan applyCommand initial commands
  in all invariantsHold states
```

This finds ordering bugs that no example test would, and it is the best
available check that a lifecycle model is right. See
[modeling-state-machines](../../modeling-state-machines/SKILL.md).
