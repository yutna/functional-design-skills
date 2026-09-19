# When a Check Is the Right Answer

Designing states away is the default, not an absolute. These are the
cases where a runtime check is correct, and how to keep it contained.

## At the boundary, always

Data from outside arrives in whatever shape the sender chose. There is
nothing to design away: the check is the conversion.

```text
parseBooking : Json -> Result<UnvalidatedBooking, ParseError>
validateBooking :
  UnvalidatedBooking -> Result<ValidatedBooking, ValidationError>
```

Two steps, because they fail for different reasons and different people
need to hear about them: parsing failures are the sender's bug,
validation failures are the user's business.

Everything past `validateBooking` is written against types that cannot be
wrong, so nothing downstream re-checks.

## Drafts and work in progress

A half-filled form is not a broken `Booking`. It is a real business
concept, and it has its own rules: a draft may be saved, resumed, and
abandoned; a booking may not.

```text
type DraftBooking = {
  customer: Option<CustomerId>,
  treatments: List<DraftTreatment>,
  updatedAt: Instant,
}

submit : DraftBooking -> Result<UnvalidatedBooking, IncompleteDraft>
```

The optional fields are legal here, because incompleteness is the point.
The conversion to the domain type is one function, and it is where the
completeness rule lives.

Do not reuse the domain type with everything optional. That destroys the
guarantees for the ninety per cent of code that deals with real bookings.

## Rules that depend on the outside world

Some rules cannot be checked at construction because the answer is not in
the value.

```text
-- cannot be a type: it depends on availability right now
checkAvailability :
  GetAvailability -> Booking -> AsyncResult<Booking, Unavailable>
```

These are workflow steps returning `Result`, not type invariants. The
signal is that the rule mentions time, another system, or state that
lives elsewhere.

## Rules that change more often than the code

A credit limit, a discount threshold, a list of embargoed countries.
Encoding these in types means a deployment for a business decision.
Represent the rule as data, and the check as a function over it.

```text
type CreditPolicy = { limit: Money, requiresApprovalAbove: Money }
checkCredit :
  CreditPolicy -> Customer -> Booking -> Result<Booking, CreditError>
```

The type still prevents the structural mistakes: `Money` is not a float,
`Customer` is not a string. What varies stays data.

## Rules that would make the type unreadable

A type can encode that a list is sorted, that two dates are ordered, that
a matrix is square. Each such encoding costs readability, and readers of
this codebase pay it forever.

Rule of thumb: encode the constraints the domain experts name in
conversation. Everything else is a test's job.

```text
-- the domain says: "a booking can't end before it starts"
type DateRange = DateRange of { from: Date, to: Date }
dateRange : Date -> Date -> Result<DateRange, RangeError>
```

That is worth a type, because it appears in ten places. A constraint that
appears once, deep inside one function, is worth an assertion and a test.

## Keeping checks contained

Wherever a check survives, make sure it is:

1. **In one place.** One parser, one validator, one policy function.
2. **Returning `Result`, not throwing.** The caller decides what to do.
3. **Producing a type that proves it ran.** The output type must differ
   from the input type, or nothing stops the check being skipped.
4. **Not repeated downstream.** If a second function re-checks, either
   the first one's output type is too weak, or the second is defending
   against a state the type forbids.
