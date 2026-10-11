# Technique Catalogue

Each entry: the illegal thing, the type that permits it, and the type
that does not.

## Contents

- [Correlated optional fields](#correlated-optional-fields)
- [Empty collection where one is required](#empty-collection-where-one-is-required)
- [Out-of-range numbers](#out-of-range-numbers)
- [Wrong string format](#wrong-string-format)
- [Two identifiers swapped](#two-identifiers-swapped)
- [Wrong pipeline phase](#wrong-pipeline-phase)
- [Missing required field filled by a default](#missing-required-field-filled-by-a-default)
- [Two fields that must agree](#two-fields-that-must-agree)
- [A state that carries no data](#a-state-that-carries-no-data)
- [Money in mixed currencies](#money-in-mixed-currencies)
- [Optional that means two different things](#optional-that-means-two-different-things)

## Correlated optional fields

Permits a cancelled booking with no reason, and a live booking with one.

```text
type Booking = { ..., cancelled: Boolean, cancelReason: Option<String> }
```

```text
type Booking = { ..., lifecycle: Lifecycle }
type Lifecycle = Active | Cancelled of { reason: CancelReason,
                                         at: Instant }
```

## Empty collection where one is required

Permits a booking with no treatments, which every consumer then checks for.

```text
type Booking = { treatments: List<BookedTreatment> }
```

```text
type Booking = { treatments: NonEmptyList<BookedTreatment> }
```

`NonEmptyList` is a record of a head and a tail, or a list with a
constructor that rejects empty. Build it once, use it everywhere.

## Out-of-range numbers

Permits a negative quantity and a percentage of 400.

```text
type BookedTreatment = { code: TreatmentCode, quantity: Integer,
                         discountPercent: Decimal }
```

```text
type Quantity = Quantity of Integer        -- at least 1
type Percent = Percent of Decimal          -- 0..100
type BookedTreatment = { code: TreatmentCode, quantity: Quantity,
                         discount: Percent }

quantity : Integer -> Result<Quantity, RangeError>
```

This file gives `BookedTreatment` a discount here, and a unit price under
"Two fields that must agree".

See
[functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md).

## Wrong string format

Permits an email address that is a shopping list.

```text
type Patient = { email: String }
```

```text
type EmailAddress = EmailAddress of String
parseEmail : String -> Result<EmailAddress, EmailError>
type Patient = { email: EmailAddress }
```

## Two identifiers swapped

Permits `transfer patientId bookingId` called with the arguments the
other way round.

```text
transfer : String -> String -> AsyncResult<Unit, TransferError>
```

```text
type PatientId = PatientId of Uuid
type BookingId = BookingId of Uuid
transfer : PatientId -> BookingId -> AsyncResult<Unit, TransferError>
```

## Wrong pipeline phase

Permits pricing a booking that was never validated.

```text
validate : Booking -> Result<Booking, ValidationError>
price : Booking -> PricedBooking
```

```text
validate : UnvalidatedBooking -> Result<ValidatedBooking, ValidationError>
price : ValidatedBooking -> PricedBooking
```

The phases are separate types even when their fields are identical. That
identity is a coincidence, and it will end.

## Missing required field filled by a default

Permits a booking with a silently chosen currency.

```text
type Money = { minorUnits: Integer, currency: Currency }  -- default USD
```

Remove the default. If the caller does not know the currency, the caller
is not ready to build `Money`, and a default hides that.

## Two fields that must agree

Permits `total` disagreeing with the sum of the treatments. Here each
treatment carries the unit price it was booked at.

```text
type BookedTreatment = { code: TreatmentCode, quantity: Quantity,
                         unitPrice: Satang }
type Booking = { treatments: NonEmptyList<BookedTreatment>,
                 total: Satang }
```

```text
type Booking = { treatments: NonEmptyList<BookedTreatment> }
total : Booking -> Satang           -- derived, never stored
```

Store a derived value only when there is a reason it must be frozen, such
as an invoice that must not change when prices do. Then it is not a
duplicate; it is a different concept, and it deserves its own name:
`invoicedTotal`.

## A state that carries no data

Permits `Queued` with leftover fields from a previous state.

```text
type Job = { state: String, result: Option<Output>,
             error: Option<String> }
```

```text
type Job = Queued | Running of { since: Instant }
         | Succeeded of Output | Failed of JobError
```

## Money in mixed currencies

Permits adding euros to yen.

```text
alias Money = Decimal
```

```text
type Money = { minorUnits: Integer, currency: Currency }
add : Money -> Money -> Result<Money, CurrencyMismatch>
```

Where a system genuinely has one currency, encode that: `type Satang =
Satang of Integer`, and addition cannot fail.

## Optional that means two different things

Permits `Option<String>` meaning both "not supplied" and "supplied as
empty".

```text
type Profile = { bio: Option<String> }
```

```text
type Bio = NotProvided | Provided of NonEmptyString
type Profile = { bio: Bio }
```

Whenever an absent value has two meanings and the business needs only one,
repair it by making the other meaning unbuildable. `NonEmptyString` removes
"supplied as empty", so `NotProvided` is the only absence left.
