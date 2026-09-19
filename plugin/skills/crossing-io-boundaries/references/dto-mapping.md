# Mapping Domain Types to Transfer Types

A transfer type, or DTO, exists to cross a boundary. It is built from
whatever primitives the format supports, has no invariants, and is never
used to make a decision.

## Single-case wrappers

```text
type BookingId = BookingId of Uuid

-- out
toDto o = { id: uuidToString (unwrap o.id), ... }

-- in
fromDto d =
  parseUuid d.id |> mapError BadBookingId |> map BookingId
```

The wrapper vanishes on the wire and is rebuilt on the way in, through
the same parser every other caller uses.

## Choice types

A tag field plus the payload of the selected case.

```text
type Payment =
  | Cash
  | Card of { number: CardNumber, expiry: ExpiryDate }

-- transfer
{ "kind": "cash" }
{ "kind": "card", "number": "...", "expiry": "2029-04" }
```

Rules:

1. One tag key across the whole codebase.
2. Tag values are lower-case, stable strings, defined as constants. They
   are part of the public contract; renaming one is a breaking change
   even though the domain case can be renamed freely.
3. On the way in, an unknown tag is a named error, never a default.

An alternative encoding puts each case under its own key. Either works;
pick one and be consistent. See
[consistency.md](../../programming-strategically/references/consistency.md).

## Collections with constraints

```text
-- domain
treatments: NonEmptyList<BookedTreatment>

-- transfer: a plain array
-- inward: reject an empty array with a named error
fromDto d =
  NonEmptyList.fromList d.treatments |> toResult EmptyBooking
```

The constraint is checked exactly once, here.

## Optional values

Decide, per field, between "null" and "absent", and be consistent.
Absence and an explicit null often mean different things in patch
semantics, so if the API supports partial updates, model that explicitly:

```text
type FieldUpdate<A> = Unchanged | Clear | SetTo of A
```

Do not overload `null` to mean both "no change" and "clear it".

## Money

```text
-- domain: minor units and a currency
type Money = Money of { minorUnits: Integer, currency: Currency }

-- transfer
{ "amount": 12500, "currency": "THB" }
```

Never a floating point number, and never a bare number without the
currency. If the whole system is single-currency, the transfer type still
carries the code, so that assumption can change later without a format
break.

## Timestamps

Text in one fixed format, in UTC, always. Parse into `Instant` at the
edge, convert to civil time only for display. Store the timezone
separately when a rule genuinely depends on local time.

## Aggregates

An aggregate maps to one document, or to a set of rows written in one
transaction. Do not expose its internal parts as separately addressable
resources; that invites callers to modify a part without the root's
invariants. See
[enforcing-consistency-boundaries](../../enforcing-consistency-boundaries/SKILL.md).

## Where the mapping lives

One module per boundary, holding both directions and the transfer types.
It imports the domain; the domain does not import it.

```text
module BookingApi
  type BookingDto
  toDto : Booking -> BookingDto
  fromDto : BookingDto -> Result<Booking, BookingDtoError>
```

If two boundaries need different shapes, they get different modules and
different DTOs. An `BookingDto` shared between the public API and the
storage layer will end up satisfying neither.

## Versioning

The transfer type is the thing with versions; the domain type is not.

1. Add a new transfer type: `OrderDtoV2`.
2. Add a mapping from it into the same domain type.
3. Keep the old mapping while old clients or old rows exist.
4. Retire the old one when telemetry says nobody uses it.

```text
fromDtoV1 : OrderDtoV1 -> Result<Booking, BookingDtoError>
fromDtoV2 : OrderDtoV2 -> Result<Booking, BookingDtoError>
```

The domain evolves without a version number, because nothing outside
depends on its shape.

## Tolerant reading

For inward mappings, accept what you can and reject clearly what you
cannot:

- Ignore unknown fields; they are usually a newer client.
- Reject unknown tag values; guessing produces silent data loss.
- Do not silently coerce types; a string where a number was promised is
  the sender's bug and should be reported.

## Testing the mapping

Three tests per boundary:

1. **Round trip.** `fromDto (toDto x) == Ok x` for generated domain
   values. This catches most mapping mistakes on its own.
2. **Rejection.** Each error case is produced by an input that triggers
   it.
3. **Compatibility.** A stored sample of every historical payload still
   parses. Keep those samples in the repository; they are the contract.
