# A Workflow End to End

One process built from discovery to composed code: **booking a clinic
appointment**. It takes the steps of the design loop in order, and shows
the one shape the short examples leave out: a read that has to wait for
a rule.

## Contents

- [1. What the experts said](#1-what-the-experts-said)
- [2. Types from the vocabulary](#2-types-from-the-vocabulary)
- [3. The signatures](#3-the-signatures)
- [4. Stage types](#4-stage-types)
- [5. What has to be read](#5-what-has-to-be-read)
- [6. The steps](#6-the-steps)
- [7. Composition](#7-composition)
- [8. What the shell does](#8-what-the-shell-does)
- [9. What each decision bought](#9-what-each-decision-bought)
- [10. Testing it](#10-testing-it)

## 1. What the experts said

> A patient picks a doctor and a time. We check they're registered and
> the slot is still free. New patients pay a first-visit fee, returning
> ones pay the standard fee, and insured patients pay a co-pay instead.
> Once it's booked, the patient gets a confirmation and the doctor's
> schedule updates. Slots get taken while people are still choosing, so
> we hold the slot for two minutes.

Events, in the past tense: slot held, hold expired, appointment booked,
confirmation sent, schedule updated.

Commands: hold slot, book appointment. This page builds the second. The
first is the same shape and half the size.

Pain points named by the experts: the hold, and the fact that the fee
depends on a patient category nobody had written down.

## 2. Types from the vocabulary

Constrained values first, one rule each. Each has a parser, such as
`PatientId.parse : String -> Result<PatientId, ValidationError>`.

```text
type PatientId = PatientId of Uuid
type SlotId = SlotId of Uuid
type BookingRef = BookingRef of String
type Satang = Satang of Integer             -- never negative
type Reason = Reason of String              -- 1 to 200 characters
```

A slot is one doctor at one time, so its identifier names both. The
category the experts named had been an untyped assumption, and the hold
had been a timestamp column:

```text
type PatientCategory =
  | FirstVisit
  | Returning
  | Insured of { policy: PolicyNumber, copay: Satang }

type Patient = { id: PatientId, category: PatientCategory }

type SlotState =
  | Free
  | Held of { by: PatientId, until: Instant }
  | Booked of BookingRef

type Slot = { id: SlotId, state: SlotState, standardFee: Satang }
```

The command is what the patient's form sent, with nothing checked. The
event is the one fact this workflow can decide:

```text
type BookAppointment = { patient: String, slot: String, reason: String }

type AppointmentBooked = AppointmentBooked of Appointment
```

With one event there is nothing to put in a list. A second kind of event
would make the result a list of a choice type.

"Confirmation sent" and "schedule updated" are events too, and this
workflow does not return them. Neither is true when the booking is
saved; each becomes true after something else has been done. Section 8
says who does it.

## 3. The signatures

Written and reviewed before any step exists. There are two, because
nothing can be read until the identifiers in the form have been parsed:

```text
parseRequest :
  BookAppointment -> Result<ParsedRequest, NonEmptyList<ValidationError>>

bookAppointment :
  Instant -> BookingRef -> Records -> ParsedRequest
    -> Result<AppointmentBooked, Refusal>

type Refusal =
  | UnknownPatient of NotRegistered
  | NoSlot of SlotProblem

type NotRegistered = NotRegistered of PatientId
type SlotProblem = NoSuchSlot | TakenByAnother | HoldExpired
```

Both are pure. The experts confirmed `HoldExpired` is a real outcome
patients see, not a technical error, so it has a name and a case.

## 4. Stage types

```text
type ParsedRequest = { patient: PatientId, slot: SlotId, reason: Reason }
type KnownRequest = { request: ParsedRequest, patient: Patient }
type HeldRequest = { known: KnownRequest, slot: Slot, heldUntil: Instant }
type PricedRequest = { held: HeldRequest, fee: Satang }

type Appointment = {
  ref: BookingRef,
  patient: PatientId,
  slot: SlotId,
  reason: Reason,
  fee: Satang,
  bookedAt: Instant,
}
```

Each stage is the one before it with one thing established: the
identifiers parsed, the patient known, the slot still held for them, the
fee decided. No stage type is reused.

## 5. What has to be read

Two things: the patient's record, and the slot with its state and the
doctor's standard fee.

```text
type Records = { patient: Option<Patient>, slot: Option<Slot> }
```

Neither can be asked for until `parseRequest` has run. Each identifier
arrives as text, and whether that text is an identifier at all is the
first rule the request meets. That is the first of the three cases in
rule 1 of
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md):
what to read cannot be named until a rule has run. So the handler reads
between two pure functions, and takes its capabilities as parameters,
declared here in the domain's words:

```text
alias ReadForBooking =
  ParsedRequest -> AsyncResult<(BookingRef, Records), StoreError>

type SaveError = Conflict | Failed of StoreError
alias SaveBooked =
  AppointmentBooked -> AsyncResult<AppointmentBooked, SaveError>
```

`ReadForBooking` also draws the booking reference, because a new
identifier is a read like any other. Neither alias mentions SQL, HTTP,
or a client library, and each is one line to stub in a test.

## 6. The steps

```text
knownPatient :
  Option<Patient> -> ParsedRequest -> Result<KnownRequest, NotRegistered>

heldSlot :
  Instant -> Option<Slot> -> KnownRequest
    -> Result<HeldRequest, SlotProblem>

priceVisit : HeldRequest -> PricedRequest

confirm : Instant -> BookingRef -> PricedRequest -> Appointment
```

Each step that can fail has an error type of its own, as narrow as what
can go wrong in it.

Parsing accumulates errors, because a patient fixing a form should see
all of them at once. `map3` applies a function to three results and
keeps every failure, as
[applicative-validation.md](../../functional-handling-errors-with-results/references/applicative-validation.md)
shows:

```text
parseRequest command =
  map3 (\patient slot reason -> { patient, slot, reason })
    (PatientId.parse command.patient |> toValidation)
    (SlotId.parse command.slot |> toValidation)
    (Reason.parse command.reason |> toValidation)
```

The hold is a match on the slot's state, with every case answered:

```text
heldSlot now found known =
  match found with
  | None -> Error NoSuchSlot
  | Some slot ->
      match slot.state with
      | Free -> Error HoldExpired
      | Booked _ -> Error TakenByAnother
      | Held hold ->
          if hold.by != known.patient.id then Error TakenByAnother
          else if hold.until < now then Error HoldExpired
          else Ok { known, slot, heldUntil: hold.until }
```

Pricing is pure, and total, because the category already decided it:

```text
feeFor : Satang -> PatientCategory -> Satang
feeFor standard category =
  match category with
  | FirstVisit -> add standard firstVisitSurcharge
  | Returning -> standard
  | Insured insurance -> insurance.copay

priceVisit held =
  { held, fee: feeFor held.slot.standardFee held.known.patient.category }
```

## 7. Composition

```text
bookAppointment now ref records parsed =
  knownPatient records.patient parsed
    |> mapError UnknownPatient
    |> bind (heldSlot now records.slot >> mapError NoSlot)
    |> map priceVisit
    |> map (confirm now ref)
    |> map AppointmentBooked
```

Read aloud: book an appointment by checking the patient is known,
checking the slot is still held for them, pricing the visit, and
confirming it. That is the process the experts described.

Each narrow error is lifted into `Refusal` here, at the composition, and
nowhere else.

## 8. What the shell does

```text
type BookingFailure =
  | Invalid of NonEmptyList<ValidationError>
  | Rejected of Refusal
  | SlotChanged
  | Unavailable of StoreError

handleBookAppointment :
  ReadForBooking -> SaveBooked -> Instant -> BookAppointment
    -> AsyncResult<AppointmentBooked, BookingFailure>
handleBookAppointment readForBooking saveBooked now command =
  parseRequest command                                -- pure
    |> mapError Invalid
    |> bind (\parsed ->
         readForBooking parsed                        -- read
           |> mapError Unavailable
           |> bind (\(ref, records) ->
                bookAppointment now ref records parsed    -- pure
                  |> mapError Rejected))
    |> bind (saveBooked >> mapError saveFailure)      -- write

saveFailure error =
  match error with
  | Conflict -> SlotChanged
  | Failed fault -> Unavailable fault
```

The handler holds no rule. It calls two pure functions, reads between
them, and writes what the second one decided. `saveFailure` renames how
the write came out and decides nothing.

The composition root gives the handler its capabilities once:

```text
buildApp pool =
  { book = handleBookAppointment (readForBooking pool) (saveBooked pool) }
```

The entry point for the HTTP route reads the clock, builds the command
from the request body, calls `app.book`, and renders either outcome.

Three things the adapters and the entry point do, which are real work
and are not rules:

- `saveBooked` writes the appointment and the event, and marks the slot
  booked under the appointment's reference, in one transaction. The
  event carries everything that changed, so the adapter decides nothing.
  It marks the slot only if the slot is still held by this patient, and
  returns `Conflict` if it is not.
- On `SlotChanged` the entry point runs the handler once more, with a
  new clock reading, and this time the rules see the slot as it now is.
  That, and not the hold alone, is what stops two patients getting one
  slot.
- A relay delivers the saved event. Two other handlers receive it: one
  sends the patient's confirmation, one updates the doctor's schedule.
  Each is a read, a decision and a write of its own, and each can fail
  and be tried again without touching the booking. See
  [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

## 9. What each decision bought

| Decision                       | What it removed                      |
| ------------------------------ | ------------------------------------ |
| `PatientCategory` as a choice  | Fee rules scattered in branches      |
| Distinct stage types           | Steps receiving unprepared data      |
| Reads between two pure halves  | Rules that need a database to test   |
| An event returned, not sent    | Untestable notification side effects |
| The hold as a state of a slot  | A hold hidden in a timestamp column  |
| Accumulated validation errors  | Forms fixed one field at a time      |
| Narrow errors, lifted once     | Callers guessing what can fail       |

## 10. Testing it

The rules are tested with plain values:

```text
test "an insured patient pays the copay" =
  let insured = { id: patientA, category: Insured insurance }
  let held = Held { by: patientA, until: later }
  let slot = { id: slotA, state: held, standardFee: Satang 80000 }
  let records = { patient: Some insured, slot: Some slot }
  in expect (bookAppointment now ref records parsedA |> map feeOf)
       toBe (Ok insurance.copay)
```

`patientA`, `slotA`, `insurance`, `later`, `now`, `ref` and `parsedA`
are plain values built in the test file, and `feeOf` reads the fee off
the event. No database, no clock, no HTTP, no mocking library, and no
stub. That is the return on every decision above.

The handler has paths of its own, and each gets one test with one-line
stubs: a form that does not parse reads nothing; a refusal saves
nothing; a read that fails is `Unavailable`; a slot that changed before
the write is `SlotChanged`.
