# Aligning Effects in a Pipeline

A pipeline usually mixes three kinds of step: pure, fallible, and
asynchronous. They do not compose directly, and the fix is to lift each
one into the pipeline's common shape rather than to give up and use
imperative glue.

## The three shapes

```text
pure     : A -> B
fallible : A -> Result<B, E>
async    : A -> AsyncResult<B, E>
```

Pick the widest shape the pipeline needs as its common shape, and lift
everything into it. If any step does I/O, the common shape is
`AsyncResult`.

## Lifting

| From               | To                 | Operation                |
| ------------------ | ------------------ | ------------------------ |
| `A -> B`           | `A -> Result<B,E>` | Wrap the result in Ok    |
| `A -> Result<B,E>` | `A -> AsyncResult` | Wrap in a resolved async |
| `A -> Async<B>`    | `A -> AsyncResult` | Wrap the result in Ok    |
| `Result<B, E1>`    | `Result<B, E2>`    | Map the error            |

```text
confirmBooking =
  validateBooking      -- Result, lifted
    |> asyncResult
    >=> priceBooking   -- AsyncResult, already the common shape
    >=> (acknowledgeBooking |> pure >> asyncResult)
```

The names differ by language; the operations are always these four. The
language packs give the concrete spellings.

## Keep steps at their natural shape

Do not make every step asynchronous because one of them is. A pure step
should have a pure signature, so that it can be tested with plain values
and reused outside the pipeline. Lift at the point of composition, not in
the step's own definition.

```text
-- good: honest signature, lifted at the call site
calculateTotal : PricedBooking -> Money

-- bad: pretends to need the world
calculateTotal : PricedBooking -> AsyncResult<Money, Never>
```

## Aligning error types

Steps have narrow error types; the workflow has one. Map at composition.

```text
confirmBooking =
  validateBooking |> mapError Validation
    >=> (priceBooking |> mapError Pricing)
    >=> (saveBooking |> mapError Storage)
```

Every step stays honest about what it can produce, and the caller matches
on one type. Do not widen the step's own error type to the workflow's;
that couples steps to the workflow they happen to be used in.

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
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Parallel steps

When two steps are independent, run them together and combine.

```text
-- both fetches start at once, both must succeed
combine2 :
  AsyncResult<A, E> -> AsyncResult<B, E>
    -> ((A, B) -> C) -> AsyncResult<C, E>
```

The rule: parallelism belongs to the shell, or to explicit combinators
like this one. A step must never start background work whose result the
pipeline does not carry, because nothing then owns its failure.

## Where the effects actually run

Nothing above performs an effect; it builds a description of one that the
shell runs at the edge. That is what keeps the workflow testable: supply
stub capabilities and the whole pipeline runs synchronously with plain
values. See
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).
