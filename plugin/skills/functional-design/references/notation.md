# Neutral Notation

Core skills in this pack describe designs in the notation below. It is
deliberately not any real language: the point is that the rule survives
translation. Language packs show the same shapes in real syntax.

## Type declarations

```text
-- record (product type): all fields present at once
type Booking = {
  id: BookingId,
  customer: CustomerId,
  treatments: NonEmptyList<BookedTreatment>,
}

-- choice (sum type): exactly one case at a time
type PaymentMethod =
  | Cash
  | Card of CardNumber
  | Transfer of { bank: BankCode, ref: TransferRef }

-- single-case wrapper: a distinct type over a primitive
type BookingId = BookingId of String

-- alias: the same type under another name, no new guarantees
alias Quantity = Integer
```

`|` reads "or". A comma between record fields reads "and". A choice with
no payload (`Cash`) carries only the fact that it is that case.

## Function signatures

```text
-- one argument, one result
validateBooking : UnvalidatedBooking -> Result<ValidatedBooking, ValidationError>

-- several arguments, written curried
priceBooking : GetTreatmentPrice -> ValidatedBooking -> PricedBooking

-- a function passed as a value
alias GetTreatmentPrice = TreatmentCode -> Price
```

Read `->` right-associatively: `A -> B -> C` is a function from `A` to a
function from `B` to `C`. Every signature in this pack is **total**: for
every input of the declared type there is a result of the declared type,
with no exception and no hidden `null`.

## Composition and pipelines

```text
-- left-to-right composition: build a new function
confirmBooking = validate >> price >> acknowledge

-- pipe: push a value through functions
result = booking |> validate |> price |> acknowledge

-- compose functions that return Result (railway composition)
confirmBooking = validate >=> price >=> acknowledge
```

`>>` composes plain functions. `>=>` composes functions that each return
`Result`, short-circuiting on the first error. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Standard types

| Notation            | Meaning                           |
| ------------------- | --------------------------------- |
| `Option<T>`         | `Some of T` or `None`             |
| `Result<T, E>`      | `Ok of T` or `Error of E`         |
| `List<T>`           | possibly empty ordered collection |
| `NonEmptyList<T>`   | at least one element              |
| `Map<K, V>`         | keys to values                    |
| `Set<T>`            | distinct values, no order         |
| `Async<T>`          | a `T` that arrives later          |
| `AsyncResult<T, E>` | `Async<Result<T, E>>`             |

## Matching

```text
match payment with
| Cash -> "cash"
| Card num -> maskCard num
| Transfer t -> t.bank
```

Matching is exhaustive: every case of the choice appears, and the compiler
or test suite proves it. A `_` wildcard is a deliberate decision to ignore
future cases, never a convenience.

## Effects

```text
-- pure: same input, same output, no observable side effect
calculateTotal : PricedBooking -> Total

-- effectful: touches the outside world, marked in the type
saveBooking : Booking -> AsyncResult<Unit, DbError>
```

If a signature has no effect type, it does no I/O, reads no clock, and
draws no random numbers. That guarantee is what makes the core testable.
See
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

## Translating to a real language

| Notation            | Where to look                          |
| ------------------- | -------------------------------------- |
| choice type         | language pack, "unions" section        |
| single-case wrapper | language pack, "branded types" section |
| `>=>` composition   | language pack, "Result" section        |
| `AsyncResult`       | language pack, "async errors" section  |

Pick the pack that matches the project from
[functional-design](../SKILL.md).
