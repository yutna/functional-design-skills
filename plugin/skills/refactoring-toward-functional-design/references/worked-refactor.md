# A Refactor, Move by Move

One legacy service moved through the ten moves in
[migration-moves.md](migration-moves.md), one commit each, tests green
between. Nothing here is a rewrite: at every point the service still
works and still ships.

## The starting point

```text
class BookingService {
  constructor(repo, catalogue, mailer) { ... }

  confirm(dto) {
    if (!dto.customerId) throw new Error("bad booking")
    if (!dto.treatments || dto.treatments.length === 0) throw new Error("no treatments")

    const booking = this.repo.load(dto.id) ?? { id: dto.id, treatments: [] }
    if (booking.status === "confirmed") throw new Error("already confirmed")

    let total = 0
    for (const treatment of dto.treatments) {
      const priced = this.catalogue.find(treatment.code)
      if (!priced) throw new Error("unknown treatment " + treatment.code)
      if (treatment.qty < 1) throw new Error("bad quantity")
      total += priced.price * treatment.qty
    }

    booking.status = "confirmed"
    booking.confirmedAt = new Date()
    booking.total = total
    booking.cancelReason = null

    this.repo.save(booking)
    this.mailer.send(dto.email, "Booking confirmed", render(booking))
    return booking
  }
}
```

Everything is here: primitives, a status string, correlated nullable
fields, exceptions, an ambient clock, a wide service dependency, rules
tangled with effects, one type for every stage, and the storage shape as
the domain model.

## Commit 1 — wrap primitives

```text
type BookingId = BookingId of Uuid
type TreatmentCode = TreatmentCode of String   -- "W" or "G" + 4 digits
type Quantity = Quantity of Integer        -- 1..1000
type Money = Money of { minorUnits: Integer, currency: Currency }

parseTreatmentCode : String -> Result<TreatmentCode, TreatmentCodeError>
quantity : Integer -> Result<Quantity, QuantityError>
```

Change one signature, follow the failures outward, and let the
conversions accumulate at the boundary. The `treatment.qty < 1` check
disappears from the loop: it now lives in `quantity`, once.

**Green when:** the parsers have their own tests and nothing else
changed.

## Commit 2 — status string to a choice type

```text
type Lifecycle =
  | Draft
  | Placed of { at: Instant, total: Money }
  | Cancelled of { at: Instant, reason: CancelReason }
```

Add conversions at the storage boundary, then replace comparisons module
by module. The `booking.status === "confirmed"` guard becomes a match, and the
compiler or a coverage test lists every place still to convert.

## Commit 3 — collapse the correlated fields

`confirmedAt`, `total` and `cancelReason` were three nullable fields whose
validity depended on the status. They are now inside the cases from
commit 2, so this commit is deletion: remove the fields, remove the
`cancelReason = null` line, remove every downstream null check.

The state space drops from "status times four optional fields" to three
cases. Nothing can now be placed without a total.

## Commit 4 — return `Result` instead of throwing

Work outward from the leaves.

```text
type ConfirmBookingError =
  | UnknownTreatment of TreatmentCode
  | AlreadyPlaced of BookingId
  | Invalid of NonEmptyList<ValidationError>

confirm : ... -> Result<Booking, ConfirmBookingError>
```

Stop at the module boundary and convert once there, so the callers that
still expect exceptions keep working. Every `throw` inside the module is
now a named case that the signature admits to.

## Commit 5 — pass the clock in

```text
confirm : Instant -> ... -> Result<Booking, ConfirmBookingError>
```

Add the parameter, default it at the outermost call site, remove the
inner `new Date()`, then remove the default. The tests stop needing a
frozen clock, and one timestamp is used consistently throughout instead
of several samples.

## Commit 6 — narrow the dependencies

`catalogue` had eleven methods; two were used.

```text
alias FindTreatment = TreatmentCode -> Option<Treatment>
alias SaveBooking = Booking -> AsyncResult<Unit, SaveError>
alias SendMail = EmailAddress -> Subject -> Body -> AsyncResult<Unit, MailError>

confirm :
  FindTreatment -> SaveBooking -> SendMail -> Instant -> ...
```

The tests replace three mocks with three one-line functions. The domain
module stops importing the catalogue client entirely.

## Commit 7 — extract the pure decision

The move that changes how the code feels. Reads at the top, decision in
the middle, writes at the bottom; then lift the middle out.

```text
-- pure: no imports, no effects, total
decidePlacement :
  Instant -> Catalogue -> Booking -> BookingRequest
    -> Result<{ booking: Booking, events: List<BookingEvent> }, ConfirmBookingError>

-- shell: sequencing only
place findTreatment saveBooking sendMail now cmd =
  loadBooking cmd.id
    |> map (\o -> decidePlacement now catalogue o cmd)
    |> bind (\d -> saveBooking d.booking |> map (const d.events))
    |> bind dispatch
```

The pricing rule and the already-placed rule are now testable with plain
values. `mailer.send` has become an event the shell delivers, so the
decision no longer depends on a mail server being up.

## Commit 8 — stage types

```text
UnvalidatedBooking -> ValidatedBooking -> PricedBooking -> ConfirmedBooking
```

Rename the input type, add each stage as a copy, and change each step's
signature in turn. The loop that validated and priced in one pass splits
into two steps that cannot run out of booking.

The re-checks inside `decidePlacement` can now be deleted: a
`ValidatedBooking` is validated by construction.

## Commit 9 — split the DTO

Copy the current type to `BookingDto`, keeping every compromise, and write
the two mappings.

```text
toDto : Booking -> BookingDto
fromDto : BookingDto -> Result<Booking, BookingDtoError>
```

`fromDto` returns `Result` because the table still holds rows written by
the old code: a `placed` row with a null total. That failure is real, and
this is where it surfaces instead of becoming an illegal state.

Serialisation now points at the DTO, which releases the domain type.

## Commit 10 — make the aggregate opaque

Stop exporting the constructor and the fields; export the operations.

```text
module Booking
  type Booking                                  -- opaque
  confirm : Instant -> BookingRequest -> Booking
            -> Result<Placed, ConfirmBookingError>
  cancel : Instant -> CancelReason -> Booking -> Result<Cancelled, Error>
  total : Booking -> Money
```

The compiler finds the call sites that were reaching in. After this, the
invariants are enforceable rather than advisory.

## What each commit bought

| Commit | Removed                                     |
| ------ | ------------------------------------------- |
| 1      | Quantity and code checks scattered in loops |
| 2      | Status spelling known in four modules       |
| 3      | Sixteen representable states, three legal   |
| 4      | Failures invisible in every signature       |
| 5      | Tests that had to freeze a clock            |
| 6      | Three mocks, and an import of the client    |
| 7      | Rules that needed a mail server to test     |
| 8      | Steps that could run in the wrong order     |
| 9      | A schema migration for every domain change  |
| 10     | Invariants that callers could walk around   |

## What did not happen

No branch lived longer than a day. No commit changed behaviour and
structure at once. No part of the system was unavailable. The order the
moves were applied in mattered: commit 9 is what unblocked commits 1 to 3
from the schema, and commit 4 is what made commit 7 possible at all.
