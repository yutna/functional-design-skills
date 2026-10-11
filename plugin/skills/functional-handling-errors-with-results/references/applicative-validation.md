# Accumulating Validation Errors

Binding stops at the first failure. That is right for a sequence and
wrong for a form, where a person should see every problem at once.
Accumulation is the alternative: run every independent check, collect all
the failures, and return them together.

## Contents

- [The shape](#the-shape)
- [When to accumulate](#when-to-accumulate)
- [Mixing both in one workflow](#mixing-both-in-one-workflow)
- [Carrying the field name](#carrying-the-field-name)
- [Errors that depend on several fields](#errors-that-depend-on-several-fields)
- [Ordering the output](#ordering-the-output)
- [Cost](#cost)

## The shape

```text
map3 :
  (A -> B -> C -> D)
    -> Result<A, NonEmptyList<E>>
    -> Result<B, NonEmptyList<E>>
    -> Result<C, NonEmptyList<E>>
    -> Result<D, NonEmptyList<E>>
```

If all three succeed, the function is applied. If any fail, every failure
is returned. The error type is a `NonEmptyList` because "failed" means at
least one problem.

A field's own parser fails with one error, not a list. `toValidation`
puts that error in a list of one, so that the results line up:

```text
toValidation : Result<A, E> -> Result<A, NonEmptyList<E>>
```

```text
validatePatient raw =
  map3 makePatient
    (parseName raw.name |> toValidation)
    (parseEmail raw.email |> toValidation)
    (parseBirthDate raw.birthDate |> toValidation)
```

## When to accumulate

| Situation                              | Mechanism     |
| -------------------------------------- | ------------- |
| Fields of one form                     | Accumulate    |
| Rows of an uploaded file               | Accumulate    |
| A batch API request                    | Accumulate    |
| Steps of a workflow                    | Short-circuit |
| A check whose input needs a prior step | Short-circuit |
| An expensive check after a cheap one   | Short-circuit |

The test: are the checks independent, and can the caller fix them in one
pass, whether a person or a program? Both yes means accumulate.

## Mixing both in one workflow

The common shape is accumulation inside a step, short-circuiting between
steps.

```text
confirmBooking =
  validateBooking          -- accumulates field errors inside
    >=> priceBooking       -- short-circuits: needs a valid booking
    >=> acknowledgeBooking
```

Validation gathers everything wrong with the input in one pass; the rest
of the pipeline is sequential and stops at the first failure.

## Carrying the field name

An accumulated error is useless to a user interface unless it says where
the problem is.

```text
type ValidationError = {
  field: FieldPath,
  problem: Problem,
}

type Problem =
  | Missing
  | TooLong of Integer
  | BadFormat of String
  | OutOfRange of { min: Decimal, max: Decimal }
```

`FieldPath` handles nesting: `treatments[2].quantity`. Structured problems let
the edge translate messages, and let a client highlight the right input.

## Errors that depend on several fields

"End date must be after start date" belongs to neither field alone. Run
these as a second pass, after the individual fields have parsed.

```text
validateBooking raw =
  validateFields raw
    |> bind crossFieldChecks
```

Field errors accumulate; cross-field checks run only when the fields
parsed, because they cannot be evaluated otherwise. That is short-circuit
between the two passes, accumulation inside each.

## Ordering the output

Return errors in the order the fields appear in the form, not in the
order the checks ran. A user reading a list expects it to match what they
see on screen. A `FieldPath` does not carry that order, so the edge sorts
by each field's position in the form definition, the list of fields in
display order that the edge already holds in order to render the form.
A repeated group such as `treatments[].quantity` appears in that list
once, and every error under it takes the group's position.

```text
sortToForm :
  List<FieldPath> -> List<ValidationError> -> List<ValidationError>
```

## Cost

Accumulation runs every check, including expensive ones, even when an
earlier one already failed. Where a check calls a service, short-circuit
first on the cheap local checks, then accumulate the rest, or run the
expensive checks only after the local ones pass.
