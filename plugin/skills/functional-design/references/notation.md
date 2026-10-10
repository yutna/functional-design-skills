# Neutral Notation

Core skills in this pack describe designs in the notation below. It is
deliberately not any real language: the point is that the rule survives
translation. Language packs show the same shapes in real syntax.

This page also fixes the words the rules lean on. Where a skill says
pure, total, command or event, it means what
[Words with one meaning](#words-with-one-meaning) says.

## Contents

- [Type declarations](#type-declarations)
- [Function signatures](#function-signatures)
- [Expressions](#expressions)
- [Composition and pipelines](#composition-and-pipelines)
- [Standard types](#standard-types)
- [Matching](#matching)
- [Effects](#effects)
- [Words with one meaning](#words-with-one-meaning)
- [Translating to a real language](#translating-to-a-real-language)

## Type declarations

```text
-- record (product type): all fields present at once
type Booking = {
  id: BookingId,
  patient: PatientId,
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
alias Notes = String
```

`|` reads "or". A comma between record fields reads "and". A choice with
no payload (`Cash`) carries only the fact that it is that case. `--`
starts a comment.

## Function signatures

```text
-- one argument, one result
parseTreatmentCode : String -> Result<TreatmentCode, CodeError>

-- several arguments, written curried
priceBooking :
  PriceList -> ValidatedBooking -> Result<PricedBooking, PricingError>

-- a function passed as a value
alias RoundingRule = Money -> Money
roundTotal : RoundingRule -> PricedBooking -> PricedBooking
```

Read `->` right-associatively: `A -> B -> C` is a function from `A` to a
function from `B` to `C`, so `priceBooking prices` is itself a function,
waiting for the booking. Every signature in this pack is **total**.

## Expressions

```text
-- a function with no name
\booking -> booking.treatments

-- naming a step
let total = sumOf priced.lines
in roundTotal nearestBaht total

-- a choice between two values
if total > limit then Error OverLimit else Ok total

-- building a case of a choice, and a record
Card number
{ bank: code, ref: reference }

-- a copy of a record with one field replaced
{ ...booking, treatments: remaining }

-- a list: empty, written out, and split into its first element and rest
[]
[cash, card]
first :: rest

-- a helper named after the line that uses it
describe booking = join ", " names
  where names = treatmentNames booking
```

Nothing in an expression changes a value that already exists. The record
copy builds a new record and leaves `booking` as it was.

## Composition and pipelines

```text
-- compose: build a new function from two that fit end to end
normaliseCode = trim >> toUpperCase

-- pipe: push a value through functions
code = raw |> trim |> toUpperCase

-- compose functions that each return a Result
readCode = parseTreatmentCode >=> checkOffered catalogue
```

`>>` composes plain functions. `>=>` composes functions that each return
a `Result` with the same error type, and stops at the first `Error`.
Three more names move a value that is already a `Result`, and each sits
to the right of `|>`:

```text
priced |> map addTax              -- the next step cannot fail
validated |> bind (priceBooking prices)   -- the next step can
priced |> mapError Pricing        -- change the error, keep the value
```

The same three work on an `AsyncResult`, and a `Result` met in such a
chain joins it without ceremony. `map` is also the usual name for
applying a function to each element of a `List`. To adapt a function
rather than a value, compose: `priceBooking prices >> mapError Pricing`.
The full set is in
[composition-toolkit.md](../../functional-composing-functions/references/composition-toolkit.md).

## Standard types

| Notation            | Meaning                            |
| ------------------- | ---------------------------------- |
| `String`, `Integer` | text; a whole number               |
| `Decimal`           | an exact decimal number            |
| `Boolean`           | `true` or `false`                  |
| `Unit`              | the type with one value, `()`      |
| `Instant`, `Date`   | a point in time; a calendar day    |
| `(A, B)`            | a pair                             |
| `Option<T>`         | `Some of T` or `None`              |
| `Result<T, E>`      | `Ok of T` or `Error of E`          |
| `List<T>`           | possibly empty ordered collection  |
| `NonEmptyList<T>`   | at least one element               |
| `Map<K, V>`         | keys to values                     |
| `Set<T>`            | distinct values, no order          |
| `Async<T>`          | a `T` obtained by an effect        |
| `AsyncResult<T, E>` | `Async<Result<T, E>>`              |

## Matching

```text
match payment with
| Cash -> "cash"
| Card number -> maskCard number
| Transfer t -> describeBank t.bank
```

Matching is exhaustive: every case of the choice appears, and the compiler
or test suite proves it. Every arm returns the same type. A `_` wildcard
is a deliberate decision to ignore future cases, never a convenience.

## Effects

```text
-- pure: same input, same output, nothing observable happens
calculateTotal : PricedBooking -> Money

-- effectful: touches the outside world, and the type says so
loadBooking : BookingId -> AsyncResult<Option<Booking>, StoreError>
readClock : Unit -> Async<Instant>
```

If a signature has no effect type, the function does no I/O, reads no
clock, and draws no random number. `Async` is the only effect type in
the notation. It says "this reaches outside the program", not "this
waits": a clock read is marked with it although nothing is awaited.

That guarantee is what makes the core testable. See
[functional-separating-pure-core-from-shell](../../functional-separating-pure-core-from-shell/SKILL.md).

## Words with one meaning

- **pure.** The same input always gives the same output, and nothing
  observable happens: no I/O, no clock, no random number, and no call
  to anything that does those. A signature with no effect type promises
  exactly that.
- **deterministic.** The same input always gives the same output. Every
  pure function is deterministic; pure adds that nothing else happens.
- **total.** For every value its input type admits, the function returns
  a value of its output type. No input the type allows makes it throw or
  return nothing. Totality is about inputs, not effects: a function that
  saves a booking is total and not pure.
- **crash.** Stopping because the program is wrong: a state arrived that
  the types were supposed to rule out. A crash is a bug to fix, never a
  value to return, and a failure the business can name is never a crash.
  A total function does not crash on any input its type admits; it may
  crash when code upstream broke that type's promise.
- **capability.** A function with an effect type that the shell supplies
  so that a handler can reach the world through it: load a row, send a
  message, draw an identifier. Whatever calls one has an effect type
  too.
- **core.** The pure functions that hold the domain's types and rules.
  No function in the core has an effect type or receives a capability.
- **shell.** Everything else: the code that reaches the world, and the
  code that wires, translates and sequences for it.
- **handler.** The shell function that carries out one command, or
  reacts to one event. It reads, calls the core, and writes.
- **workflow.** The pure function a handler calls to decide one command:
  values in, a `Result` of events out. A workflow performs nothing.
- **command.** What a caller asks for: a record of the caller's input,
  parsed for shape at the edge and not yet checked against any rule. It
  is named for the request (`CancelBooking`), or for its stage where the
  workflow's first step validates it (`UnvalidatedBooking`).
- **event.** A fact, named in the past tense. A workflow returns the
  events it decided, and each must be true once that decision is saved
  and nothing else has happened: `BookingConfirmed` is, and
  `ConfirmationSent` is not. A fact that needs the world to have moved
  is reported by the shell, after it has (`PaymentTaken`).
- **instruction.** A value by which the core tells the shell which
  effect to perform (`SendReminder`). A command comes in from a caller;
  an instruction goes out from the core.
- **decision.** What the core returns to a handler: a result, a new
  state, events, or instructions. It is always a value, never an action.
- **edge.** The shell code that touches the world directly: the entry
  point that receives a request or a message, and the adapter that
  makes a call out.
- **idempotent.** Doing it twice leaves the same state as doing it once.
  It is said of an operation on state, such as a write or a transition.
  A pure decision is deterministic, which is a different property: the
  same decision applied twice may still charge twice.

## Translating to a real language

Each language pack has a "Notation mapping" section in its `SKILL.md`
that gives the real spelling of every form on this page: the choice
type, the single-case wrapper, `Result`, `>=>`, and `AsyncResult`.

Pick the pack that matches the project from
[functional-design](../SKILL.md).
