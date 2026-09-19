# Composition Toolkit

Every problem of "these two functions do not fit" is one of a small set
of shape mismatches. This is the operator for each. Names vary between
languages; the shapes do not.

## The operators

| You have                               | You want             | Operator    |
| -------------------------------------- | -------------------- | ----------- |
| `A -> B` and `B -> C`                  | `A -> C`             | compose     |
| `A -> Result<B,E>`, `B -> Result<C,E>` | `A -> Result<C,E>`   | bind, `>=>` |
| `A -> Result<B,E>` and `B -> C`        | `A -> Result<C,E>`   | map         |
| `A -> Result<B,E1>`                    | `A -> Result<B,E2>`  | mapError    |
| `Result<Result<A,E>,E>`                | `Result<A,E>`        | flatten     |
| `List<Result<A,E>>`                    | `Result<List<A>,E>`  | sequence    |
| `A -> Result<B,E>` over a `List<A>`    | `Result<List<B>,E>`  | traverse    |
| Two independent `Result`s              | One `Result` of both | combine     |
| `A -> B` and a `Result<A,E>`           | `Result<B,E>`        | map         |
| `Option<A>`                            | `Result<A,E>`        | toResult    |
| `A -> B` into an async pipeline        | `A -> Async<B>`      | lift        |

## The four you will use constantly

**map** applies a function to the success value and leaves the failure
alone. Use it when the next step cannot fail.

```text
pricedBooking |> map calculateTotal
```

**bind** applies a function that can itself fail, and flattens. Use it
when the next step can fail.

```text
rawBooking |> bind validate |> bind price
```

**mapError** converts a step's narrow error into the workflow's error
type. Use it at composition, never inside the step.

```text
validate |> mapError Validation
```

**traverse** runs a fallible function over a collection and turns the
list of results into a result of a list. Use it whenever a step operates
per element.

```text
treatments |> traverse validateTreatment
```

## Combining independent results

When two computations do not depend on each other, combine them rather
than chaining, so both failures can be reported.

```text
combine2 : Result<A,E> -> Result<B,E> -> ((A,B) -> C) -> Result<C, E>
```

Chaining with bind stops at the first failure, which is right for
sequential steps and wrong for validating a form. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Parameter order, precisely

Order parameters from most stable to least stable:

1. Configuration and policy that changes rarely
2. Dependencies supplied at wiring time
3. Context for this call, such as the current instant or the actor
4. The data being transformed

```text
priceBooking : PricingPolicy -> GetPrice -> Instant -> Booking -> Priced
```

Every prefix of that list is a useful partially applied function, and the
final shape `Booking -> Priced` is what a pipeline wants.

## When to stop composing

Break a chain and name an intermediate value when:

- The chain exceeds about four steps
- An intermediate value has a name a domain expert would use
- The same sub-chain appears twice, in which case name and reuse it
- A reader has asked what the value at step three is

```text
-- clearer than one nine-step chain
let validated = raw |> bind validate
let priced = validated |> bind (price catalogue)
in priced |> map acknowledge
```

Readability is the criterion. There is no prize for the shortest
expression.
