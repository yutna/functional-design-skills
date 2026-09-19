# A Workflow End to End

One process built from discovery to composed code: **booking a clinic
appointment**. Every skill in the pack appears somewhere here.

## 1. What the experts said

> A patient picks a doctor and a time. We check they're registered and
> the slot is still free. New patients pay a first-visit fee, returning
> ones pay the standard fee, and insured patients pay a co-pay instead.
> Once it's booked, the patient gets a confirmation and the doctor's
> schedule updates. Slots get taken while people are still choosing, so
> we hold the slot for two minutes.

Events, in the past tense: appointment booked, slot held, slot released,
confirmation sent, schedule updated, booking rejected.

Command: book appointment. Pain point named by the experts: the hold, and
the fact that the fee depends on a patient category nobody had written
down.

## 2. Types from the vocabulary

Constrained values first, one rule each:

```text
type PatientId = PatientId of Uuid
type DoctorId = DoctorId of Uuid
type SlotId = SlotId of Uuid
type Baht = Baht of Integer                 -- satang, never negative
type Reason = Reason of NonEmptyText        -- max 200 characters
```

The category the experts named, which had been an untyped assumption:

```text
type PatientCategory =
  | FirstVisit
  | Returning
  | Insured of { policy: PolicyNumber, copay: Baht }
```

The command and the events:

```text
type BookAppointment = {
  patient: PatientId,
  doctor: DoctorId,
  slot: SlotId,
  reason: Reason,
  requestedAt: Instant,
}

type BookAppointmentEvent =
  | AppointmentBooked of Appointment
  | ConfirmationQueued of { to: ContactMethod, appointment: BookingRef }
  | ScheduleUpdated of { doctor: DoctorId, slot: SlotId }
```

## 3. The workflow's signature

```text
type BookAppointmentWorkflow =
  BookAppointment
    -> AsyncResult<List<BookAppointmentEvent>, BookingError>

type BookingError =
  | InvalidRequest of NonEmptyList<ValidationError>
  | PatientNotRegistered of PatientId
  | SlotUnavailable of SlotId
  | HoldExpired of SlotId
  | DoctorUnavailable of DoctorId
```

Written and reviewed before any step exists. The experts confirmed
`HoldExpired` is a real outcome patients see, not a technical error.

## 4. Stage types

```text
UnvalidatedBooking    -- straight from the HTTP edge
ValidatedBooking      -- fields parsed, patient known, category known
HeldBooking           -- a slot is held, with an expiry
PricedBooking         -- fee decided from the category
Appointment           -- confirmed, has a booking reference
```

No stage type is reused, and each name says what has been established.

## 5. Dependencies, in the domain's words

```text
alias FindPatient = PatientId -> Async<Option<Patient>>
alias HoldSlot = DoctorId -> SlotId -> Instant
                   -> AsyncResult<SlotHold, SlotUnavailable>
alias ConfirmHold = SlotHold -> AsyncResult<Unit, HoldExpired>
alias GetStandardFee = DoctorId -> Async<Baht>
```

Four narrow function types. None mentions SQL, HTTP, or a client library,
and each is one line to stub in a test.

## 6. The steps

```text
validateBooking :
  FindPatient -> UnvalidatedBooking
    -> AsyncResult<ValidatedBooking, BookingError>

holdSlot :
  HoldSlot -> ValidatedBooking -> AsyncResult<HeldBooking, BookingError>

priceBooking :
  GetStandardFee -> HeldBooking -> AsyncResult<PricedBooking, BookingError>

confirmBooking :
  ConfirmHold -> PricedBooking -> AsyncResult<Appointment, BookingError>

createEvents : Appointment -> List<BookAppointmentEvent>
```

Field-level validation accumulates errors, because a patient fixing a
form should see all of them at once:

```text
validateFields :
  UnvalidatedBooking -> Result<Fields, NonEmptyList<ValidationError>>
validateFields raw =
  map4 makeFields
    (PatientId.parse raw.patient)
    (DoctorId.parse raw.doctor)
    (SlotId.parse raw.slot)
    (Reason.parse raw.reason)
```

Pricing is pure, and total, because the category already decided it:

```text
feeFor : Baht -> PatientCategory -> Baht
feeFor standard category =
  match category with
  | FirstVisit -> add standard firstVisitSurcharge
  | Returning -> standard
  | Insured i -> i.copay
```

## 7. Composition

```text
bookAppointment findPatient holdSlot getFee confirmHold =
  validateBooking findPatient
    >=> holdSlot' holdSlot
    >=> priceBooking getFee
    >=> confirmBooking confirmHold
    >=> (createEvents >> ok)
```

Read aloud: book an appointment by validating it, holding the slot,
pricing it, confirming it, and reporting what happened. That is the
process the experts described.

## 8. What the shell does

```text
handleBookAppointment request =
  parseRequest request
    |> andThen (bookAppointment
                  (findPatientInDb pool)
                  (holdSlotInRedis client)
                  (getFeeFromCatalogue cache)
                  (confirmHoldInDb pool))
    |> andThen dispatchEvents
    |> map toHttpResponse
```

The shell parses transport, supplies the four capabilities, runs the
workflow, delivers the events, and renders the response. It contains no
business rule.

## 9. What each decision bought

| Decision                       | What it removed                      |
| ------------------------------ | ------------------------------------ |
| `PatientCategory` as a choice  | Fee rules scattered in branches      |
| Distinct stage types           | Steps receiving unprepared data      |
| Dependencies as function types | Mocking frameworks in tests          |
| Events returned, not sent      | Untestable notification side effects |
| Hold as an explicit state      | Double-booking under concurrency     |
| Accumulated validation errors  | Forms fixed one field at a time      |
| One `BookingError` choice type | Callers guessing what can fail       |

## 10. Testing it

```text
test "an insured patient pays the copay" =
  let events =
    bookAppointment
      (stubPatient (insured (Baht 5000)))
      (stubHold ok) (stubFee (Baht 80000)) (stubConfirm ok)
      validRequest
  in assertFee events (Baht 5000)
```

No database, no clock, no HTTP, no mocking library: four one-line stubs
and a plain assertion. That is the return on every decision above.
