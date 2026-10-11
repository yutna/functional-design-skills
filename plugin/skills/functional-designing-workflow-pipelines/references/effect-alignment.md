# Aligning Effects in a Pipeline

Steps come in shapes that do not compose directly. The fix is to lift
each one into the shape of the chain it joins rather than to give up and
use imperative glue. A workflow joins two shapes. A handler's chain
joins three.

## Contents

- [The three shapes](#the-three-shapes)
- [Lifting](#lifting)
- [Keep steps at their natural shape](#keep-steps-at-their-natural-shape)
- [Aligning error types](#aligning-error-types)
- [Lists inside a pipeline](#lists-inside-a-pipeline)
- [Independent reads](#independent-reads)
- [Where the effects actually run](#where-the-effects-actually-run)

## The three shapes

```text
cannot fail : A -> B
can fail    : A -> Result<B, E>
capability  : A -> AsyncResult<B, E>
```

A workflow joins the first two, and its common shape is `Result`: a step
that cannot fail is mapped into it, and a step that can is bound. A
handler's chain joins all three, and its common shape is `AsyncResult`,
because a capability call is in it. A capability whose call cannot fail
is `A -> Async<B>`, and is lifted the same way.

## Lifting

| From               | To                 | Operation                 |
| ------------------ | ------------------ | ------------------------- |
| `A -> B`           | `A -> Result<B,E>` | `map` on the value        |
| `A -> Result<B,E>` | `A -> AsyncResult` | `bind`; a `Result` joins  |
| `A -> Async<B>`    | `A -> AsyncResult` | wrap its result in `Ok`   |
| `Result<B, E1>`    | `Result<B, E2>`    | `mapError`                |

```text
-- the handler's chain: a capability call, then a step that can fail
loadCatalogue pool
  |> mapError Unavailable
  |> bind (\catalogue ->
       confirmBooking catalogue now unvalidated
         |> mapError Rejected)
```

The names differ by language; the operations are always these. The
language packs give the concrete spellings.

## Keep steps at their natural shape

Do not give a step an effect type because the chain it sits in has one.
A pure step keeps a pure signature, so that it can be tested with plain
values and reused outside the pipeline. Lift at the point of
composition, not in the step's own definition.

```text
-- good: honest signature, lifted where the chain is written
calculateTotal : PricedBooking -> Money

-- bad: an effect type on a step that reaches nothing
calculateTotal : PricedBooking -> Async<Money>
```

## Aligning error types

Steps have narrow error types; the workflow has one. Lift each at
composition, with `>> mapError Case` on a function or `|> mapError Case`
on a value.

```text
confirmBooking catalogue now unvalidated =
  validateBooking catalogue unvalidated
    |> mapError Validation
    |> bind (priceBooking catalogue >> mapError Pricing)
    |> map (issueConfirmation now)
    |> map (\booking -> [BookingConfirmed booking])
```

The handler that calls the workflow has a failure type of its own, with
a case for the workflow's error and a case for the capability's, and
lifts each the same way:

```text
type ConfirmBookingFailure =
  | Rejected of ConfirmBookingError
  | Unavailable of StoreError

loadCatalogue pool |> mapError Unavailable
```

Every step stays honest about what it can produce, and the caller
matches on one type. Do not widen the step's own error type to the
workflow's; that couples steps to the workflow they happen to be used
in.

## Lists inside a pipeline

A step that runs over each element produces a list of results, which is
the wrong shape. Two operations fix it:

```text
-- stop at the first failure
traverse : (A -> Result<B, E>) -> List<A> -> Result<List<B>, E>

-- collect every failure
traverseAll : (A -> Result<B, E>) -> List<A>
                -> Result<List<B>, NonEmptyList<E>>
```

Use the first when the failures are equivalent and one is enough. Use the
second when a user is going to fix them, since fixing one error at a time
is a bad experience. See
[functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md).

## Independent reads

When a handler needs two reads and neither depends on the other, it
starts both at once.

```text
-- both reads start at once, and the first failure wins
both :
  AsyncResult<A, E> -> AsyncResult<B, E> -> AsyncResult<(A, B), E>
```

This is not `map2` in
[composition-toolkit.md](../../functional-composing-functions/references/composition-toolkit.md),
which collects every failure. Here a failed read means the decision
cannot be made, so the first failure is the answer.

The rule: parallelism belongs to the handler, or to an explicit
combinator like this one. A step must never start background work whose
result the chain does not carry, because nothing then owns its failure.

## Where the effects actually run

The workflow performs none. The handler's chain performs them in the
order written: read, decide, write. That is what keeps the workflow
testable: it runs on plain values, and only the handler needs stub
capabilities. See
[functional-separating-pure-core-from-shell](../../functional-separating-pure-core-from-shell/SKILL.md).
