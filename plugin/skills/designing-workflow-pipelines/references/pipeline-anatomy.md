# Pipeline Anatomy

## The signature comes first

Write this before any step exists. It is the contract, and getting it
right constrains everything after it.

```text
type ConfirmBookingWorkflow =
  UnvalidatedBooking
    -> AsyncResult<List<ConfirmBookingEvent>, ConfirmBookingError>
```

Four decisions are already made: what comes in, that it is untrusted,
what comes out, and how it can fail. Review this line with a domain
expert before writing code.

## Input: the command

A command is a record named as an instruction, carrying everything needed
to decide, and nothing else.

```text
type BookingRequest = {
  bookingForm: UnvalidatedBooking,
  timestamp: Instant,
  userId: UserId,
}
```

Include the timestamp and the actor. They are inputs to business rules,
and taking them from ambient context is what makes a workflow untestable.

## Stage types

Each completed step produces a type that did not exist before, and whose
name says what has been established.

```text
UnvalidatedBooking    -- straight from the edge, nothing checked
ValidatedBooking      -- every field parsed, treatment codes exist
PricedBooking         -- every treatment priced, total computed
AcknowledgedBooking   -- customer acknowledgement prepared
```

Two rules:

1. **Never reuse a stage type.** Even when the fields are identical
   today, a shared type lets a later step accept unprepared data.
2. **Name the guarantee, not the step.** `ValidatedBooking` says what is
   true of the value. `BookingAfterStep2` says nothing.

## Dependencies

Each step declares what it needs as a function type, named in the
domain's words.

```text
alias CheckTreatmentExists = TreatmentCode -> Boolean
alias GetTreatmentPrice = TreatmentCode -> Price
```

The workflow takes them and passes them to the steps that need them. See
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

## One error type per workflow

Every failure the workflow can produce, as one choice type. Callers match
on it once.

```text
type ConfirmBookingError =
  | Validation of ValidationError
  | Pricing of PricingError
  | RemoteService of TreatmentError
```

Each step keeps its own narrow error type, and the composition lifts each
into the workflow's type. That keeps step signatures honest while giving
the caller one thing to handle. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Output: events, not actions

The workflow returns what happened. It does not send the email.

```text
type ConfirmBookingEvent =
  | BookingConfirmed of Booking
  | BillableBookingConfirmed of { booking: BookingId, amount: Money }
  | AcknowledgementSent of EmailAddress
```

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
validateBooking checkTreatment booking =
  checkCustomer booking
    >=> checkAddress
    >=> traverse (checkTreatment catalogue)
    >=> assembleValidated
```

The rule is that the sub-steps are private to the step. Their types do
not appear in the workflow's signature, and no other workflow reaches in.

## Reading the pipeline back

Once composed, read it aloud. "Place a booking by validating it, pricing
it, acknowledging it, and creating events." If that sentence is not the
business process, the steps are wrong, however clean the code is.
