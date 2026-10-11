# Pipeline Anatomy

## Contents

- [The signature comes first](#the-signature-comes-first)
- [Input: the command](#input-the-command)
- [Stage types](#stage-types)
- [Values read first](#values-read-first)
- [One error type per workflow](#one-error-type-per-workflow)
- [Output: events, not actions](#output-events-not-actions)
- [Sizing the steps](#sizing-the-steps)
- [Sub-steps](#sub-steps)
- [Reading the pipeline back](#reading-the-pipeline-back)

## The signature comes first

Write this before any step exists. It is the contract, and getting it
right constrains everything after it.

```text
confirmBooking :
  Catalogue -> Instant -> UnvalidatedBooking
    -> Result<List<ConfirmBookingEvent>, ConfirmBookingError>
```

Five decisions are already made: what comes in, that it is unchecked,
what must be read first, what comes out, and how it can fail. Review
this signature with a domain expert before writing code, or with
whoever
[working-alone.md](../../functional-design/references/working-alone.md)
puts in their place.

## Input: the command

The command is the caller's input as a record. Here it is
`UnvalidatedBooking`: named for what has not yet happened to it.

```text
type UnvalidatedBooking = {
  patient: PatientRef,
  lines: List<RawTreatmentLine>,
  requestedBy: ActorId,
}
```

Include the actor, in `requestedBy`. It is an input to business rules,
and the entry point sets it from the session, never from the form. The
instant is not a field. It is a separate argument, read once for the
command, because taking it from ambient context is what makes a workflow
untestable.

## Stage types

Each completed step produces a type that did not exist before, and whose
name says what has been established.

```text
UnvalidatedBooking    -- straight from the edge, nothing checked
ValidatedBooking      -- every field parsed, treatment codes exist
PricedBooking         -- every treatment priced, total computed
ConfirmedBooking      -- confirmation issued at the given instant
```

Two rules:

1. **Never reuse a stage type.** Even when the fields are identical
   today, a shared type lets a later step accept unprepared data.
2. **Name the guarantee, not the step.** `ValidatedBooking` says what is
   true of the value. `BookingAfterStep2` says nothing.

## Values read first

A step states what it needs as a value, in the domain's words.
`validateBooking` and `priceBooking` need the `Catalogue`, the treatments
the clinic offers and their prices; `issueConfirmation` needs the
`Instant`. The handler reads them before the workflow runs, and the
workflow passes each to the steps that use it. A step that seems to need
I/O needs a value; where a read cannot come first, the pipeline is cut
in two. See
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).

## One error type per workflow

Every failure the workflow can produce, as one choice type. Callers match
on it once.

```text
type ConfirmBookingError =
  | Validation of NonEmptyList<ValidationError>
  | Pricing of PricingError
```

Each step keeps its own narrow error type, and the composition lifts each
into the workflow's type. That keeps step signatures honest while giving
the caller one thing to handle. A remote service that cannot be reached
is not a case of this type; it belongs to the failure type of the
handler that calls the workflow. See
[functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md).

## Output: events, not actions

The workflow returns what it decided. It does not send the email.

```text
type ConfirmBookingEvent =
  | BookingConfirmed of ConfirmedBooking
  | PaymentDue of { booking: BookingId, amount: Money }
```

An event must be true once the decision is saved and nothing else has
happened. `BookingConfirmed` is. `AcknowledgementSent` is not: nothing
has been sent when the workflow returns, so it is reported by whichever
handler sends the message, after it has.

This matters for three reasons: the workflow stays testable with plain
values; the shell can decide ordering, retries, and failures of delivery;
and other contexts can subscribe without the workflow knowing they exist.

## Sizing the steps

| Signal                                      | Action       |
| ------------------------------------------- | ------------ |
| An expert names it                          | Its own step |
| It changes the stage type                   | Its own step |
| It can fail for its own reason              | Its own step |
| It always fails together with its neighbour | Merge        |
| It is two lines of plumbing                 | Inline it    |
| It needs five parameters from the caller    | Merge upward |

A workflow with three to six steps is typical. Ten is a signal that
implementation details were promoted into the process.

## Sub-steps

A step may itself be a pipeline. That is normal, and it is how a large
workflow stays readable.

```text
validateBooking catalogue =
  checkFields >=> checkLines catalogue >=> assembleValidated

checkLines catalogue fields =
  fields.lines
    |> traverseAll (checkLine catalogue)
    |> map (\lines -> { patient: fields.patient, lines })
```

The signatures that make this fit, all with the same error type:

```text
checkFields :
  UnvalidatedBooking
    -> Result<BookingFields, NonEmptyList<ValidationError>>
checkLines :
  Catalogue -> BookingFields
    -> Result<CheckedLines, NonEmptyList<ValidationError>>
checkLine :
  Catalogue -> RawTreatmentLine -> Result<TreatmentLine, ValidationError>
assembleValidated :
  CheckedLines -> Result<ValidatedBooking, NonEmptyList<ValidationError>>
```

The rule is that the sub-steps are private to the step. Their types do
not appear in the workflow's signature, and no other workflow reaches in.

## Reading the pipeline back

Once composed, read it aloud. "Confirm a booking by validating it,
pricing it, and issuing the confirmation." If that sentence is not the
business process, the steps are wrong, however clean the code is.
