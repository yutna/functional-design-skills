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
type BookingId = BookingId of Uuid

-- a type with a parameter
type Secret<T> = Secret of T

-- alias: the same type under another name, no new guarantees
alias Notes = String

-- module: the indented names are what it exports, and nothing else is
module TreatmentCode
  type TreatmentCode
  parse : String -> Result<TreatmentCode, CodeError>
  value : TreatmentCode -> String
```

`|` reads "or". A comma between record fields reads "and". A choice with
no payload (`Cash`) carries only the fact that it is that case. `--`
starts a comment. A type an example uses and does not declare, such as
`Money` or `Duration`, is a domain type whose name says what it holds.

A type that a module lists by name alone, as `TreatmentCode` is above,
is opaque: code outside the module can hold a value and pass it on, and
can neither build one nor read inside it except through the functions
listed.

## Function signatures

```text
-- one argument, one result
parseTreatmentCode : String -> Result<TreatmentCode, CodeError>

-- several arguments, written curried
priceBooking :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, PricingError>

-- a function passed as a value
alias RoundingRule = Money -> Money
roundTotal : RoundingRule -> PricedBooking -> PricedBooking
```

Read `->` right-associatively: `A -> B -> C` is a function from `A` to a
function from `B` to `C`, so `priceBooking catalogue` is itself a function,
waiting for the booking. Every signature in this pack is **total**, as
[defined below](#words-with-one-meaning). An example of what not to do
marks the promise it breaks in a comment, such as `-- throws`.

## Expressions

```text
-- a function with no name, and one that takes a pair apart
\booking -> booking.treatments
\(slot, patient) -> hold slot patient

-- naming a step; several `let` lines may come before one `in`
let lines = booking.treatments
let total = sumOf lines
in nearestBaht total

-- a choice between two values
if total > limit then Error OverLimit else Ok total

-- building a case of a choice, and a record
Card number
{ bank: code, ref: reference }
{ code, quantity }      -- short for { code: code, quantity: quantity }

-- a copy of a record with one field replaced
{ ...booking, treatments: remaining }

-- a list: empty, written out, and split into its first element and rest
[]
[cash, card]
first :: rest

-- a helper named after the line that uses it
describe booking = join ", " names
  where names = treatmentNames booking

-- a function written as one clause for each shape of its argument
count [] = 0
count (first :: rest) = 1 + count rest
```

Nothing in an expression changes a value that already exists. The record
copy builds a new record and leaves `booking` as it was.

A dot reads a field (`booking.treatments`), or names a function that
belongs with a type (`TreatmentCode.parse`). Applying a function is
written with a space and binds tighter than any operator, so
`1 + count rest` adds one to the count of the rest. Comparison and
arithmetic are written as usual, and an operator in parentheses is the
function it stands for: `(+)`.

A few names are used without being declared. `identity` returns its
argument, `const x` returns `x` whatever it is given, `fold` reduces a
list to one value, `tryCatch` turns a thrown exception into an `Error`,
`crash` stops with a message, and `done x` is an `Async` that has
already finished with `x`. Any other name an example uses and does not
declare, such as `trim` or `sumOf`, is an ordinary function that does
what its name says.

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
a `Result`, and stops at the first `Error`. Three more names work on a
value that is already a `Result`, and take it from the left of `|>`:

```text
priced |> map addTax              -- the next step cannot fail
validated |> bind (priceBooking catalogue)  -- the next step can
priced |> mapError Pricing        -- change the error, keep the value
```

`map` and `bind` mean the same on an `Option` and on an `Async`, and all
three on an `AsyncResult`. A chain may mix the two results: once any
step is an `AsyncResult` the whole chain is one, and a plain `Result`
before or after it joins without ceremony. `map` is also the name for
applying a function to each element of a `List`. To adapt a function
rather than a value, put the name after `>>`:
`priceBooking catalogue >> mapError Pricing`.

`>=>` and `bind` need one error type all the way along. Where two steps
fail with different types, `mapError` lifts each into a type with a case
for both. The full set is in
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
  a value of its output type. No input the type allows makes it throw,
  return nothing, or return a placeholder that is not an answer.
  Totality is about inputs, not effects: a function that saves a booking
  is total and not pure.
- **crash.** Stopping because the program is wrong: a state arrived that
  the types were supposed to rule out. A crash is a bug to fix, never a
  value to return, and a failure the business can name is never a crash.
  Nor is a fault in the machinery, such as a database that cannot be
  reached: the capability returns that as a value, as
  [error-taxonomy.md](../../functional-handling-errors-with-results/references/error-taxonomy.md)
  says. A total function does not crash on any input its type admits; it
  may crash when code upstream broke that type's promise.
- **rule.** Anything the business would state that decides an outcome:
  a condition, a calculation, a classification. Code applies a rule
  whenever it compares, computes with, or chooses by the contents of a
  domain value. Handing a value on unread applies none.
- **capability.** A function with an effect type that the shell supplies
  so that a handler can reach the world through it: load a row, send a
  message, draw an identifier. Whatever calls one has an effect type
  too.
- **core.** The pure functions that hold the domain's types and rules:
  constructors, calculations, state transitions, and the workflows that
  compose them. No function in the core has an effect type or receives a
  capability.
- **shell.** Everything else: the code that reaches the world, and the
  code that wires, translates and sequences for it. Some of it is pure,
  such as a mapping from a domain value to a database row, and is shell
  all the same: it serves the world's shape, not a rule.
- **handler.** The shell function that carries out one command, or
  reacts to one event. It reads, calls the core, and writes. A query,
  which changes nothing, needs no core: it is a read and a mapping, and
  both are shell.
- **workflow.** The pure function a handler calls to decide what one
  command, or one event, leads to. Values go in, and a `Result` comes
  out that holds the events it decided, with the new state where one is
  kept. A workflow performs nothing.
- **command.** What a caller asks for: a record of the caller's input,
  parsed for shape at the edge and not yet checked against any rule. It
  is named for the request (`CancelBooking`). Where the workflow's first
  step is to validate it, the name may say that instead
  (`UnvalidatedBooking`).
- **event.** A fact, named in the past tense. A workflow returns the
  events it decided, and each must be true once that decision is saved
  and nothing else has happened: `BookingConfirmed` is, and
  `ConfirmationSent` is not. A fact that needs the world to have moved
  is reported by the shell, after it has (`PaymentTaken`).
- **instruction.** A value by which the core tells the shell which
  effect to perform (`SendReminder`). A command comes in from a caller;
  an instruction goes out from the core. The same record can be an
  instruction to the program that sends it and a command to the one
  that receives it. The core returns instructions only where the effects
  have to exist as data; see
  [functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).
- **decision.** What the core returns to a handler: a result, a new
  state, events, or instructions. It is always a value, never an action.
- **edge.** Where the program meets what is outside it: the entry point
  that receives a request or a message and hands a command to a
  handler, the adapter a handler calls to reach a database or another
  system, and the composition root that wires them. "At the edge" means
  in that code, and not in the core.
- **idempotent.** Doing it twice leaves the same state as doing it once.
  It is said of an operation on state, such as a write or a transition.
  Calling a pure function twice is harmless, because it performs
  nothing; that is determinism, not idempotence, and performing the same
  decision twice may still charge twice.

## Translating to a real language

`functional-javascript`, `functional-typescript` and `functional-elixir`
each open with a "Notation mapping" table that gives the real spelling
of the types on this page and of an exhaustive match. How a `Result` is
chained in that language is shown in the pack's own examples.

Pick the pack that matches the project from
[functional-design](../SKILL.md).
