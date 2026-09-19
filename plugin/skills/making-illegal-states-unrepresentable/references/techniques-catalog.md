# Technique Catalogue

Each entry: the illegal thing, the type that permits it, and the type
that does not.

## Correlated optional fields

Permits a cancelled booking with no reason, and a live booking with one.

```text
type Booking = { ..., cancelled: Boolean, cancelReason: Option<Text> }
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
type BookedTreatment = { quantity: Integer, discountPercent: Decimal }
```

```text
type Quantity = Quantity of Integer        -- 1..1000
type Percent = Percent of Decimal          -- 0..100
type BookedTreatment = { quantity: Quantity, discount: Percent }

quantity : Integer -> Result<Quantity, RangeError>
```

See
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md).

## Wrong string format

Permits an email address that is a shopping list.

```text
type Customer = { email: String }
```

```text
type EmailAddress = EmailAddress of String
parseEmail : String -> Result<EmailAddress, EmailError>
type Customer = { email: EmailAddress }
```

## Two identifiers swapped

Permits `transfer(bookingId, customerId)` when the parameters are the other
way round.

```text
transfer : String -> String -> Result<Unit, Error>
```

```text
type CustomerId = CustomerId of Uuid
type BookingId = BookingId of Uuid
transfer : CustomerId -> BookingId -> Result<Unit, Error>
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
type Money = { amount: Decimal, currency: Currency }   -- default USD
```

Remove the default. If the caller does not know the currency, the caller
is not ready to build `Money`, and a default hides that.

## Two fields that must agree

Permits `total` disagreeing with the sum of the treatments.

```text
type Booking = { treatments: NonEmptyList<BookedTreatment>, total: Money }
```

```text
type Booking = { treatments: NonEmptyList<BookedTreatment> }
total : Booking -> Money            -- derived, never stored
```

Store a derived value only when there is a reason it must be frozen, such
as an invoice that must not change when prices do. Then it is not a
duplicate; it is a different concept, and it deserves its own name:
`invoicedTotal`.

## A state that carries no data

Permits `Pending` with leftover fields from a previous state.

```text
type Job = { state: String, result: Option<Output>,
             error: Option<Text> }
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
type Money = { amount: Decimal, currency: Currency }
add : Money -> Money -> Result<Money, CurrencyMismatch>
```

Where a system genuinely has one currency, encode that: `type Baht =
Baht of Decimal`, and addition is total again.

## Optional that means two different things

Permits `Option<Text>` meaning both "not supplied" and "supplied as
empty".

```text
type Profile = { bio: Option<Text> }
```

```text
type Bio = NotProvided | Provided of NonEmptyText
type Profile = { bio: Bio }
```

Whenever an absent value has more than one meaning, name the meanings.
