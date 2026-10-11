# A Refactor, Move by Move

One legacy service moved through the ten moves in
[migration-moves.md](migration-moves.md), one commit each, tests green
between. Nothing here is a rewrite: at every point the service still
works and still ships, and no commit changes what it does.

## Contents

- [The starting point](#the-starting-point)
- [Before commit 1](#before-commit-1)
- [Commit 1 — wrap primitives](#commit-1--wrap-primitives)
- [Commit 2 — status string to a choice type](#commit-2--status-string-to-a-choice-type)
- [Commit 3 — collapse the correlated fields](#commit-3--collapse-the-correlated-fields)
- [Commit 4 — return `Result` instead of throwing](#commit-4--return-result-instead-of-throwing)
- [Commit 5 — pass the clock in](#commit-5--pass-the-clock-in)
- [Commit 6 — narrow the dependencies](#commit-6--narrow-the-dependencies)
- [Commit 7 — extract the pure decision](#commit-7--extract-the-pure-decision)
- [Commit 8 — stage types](#commit-8--stage-types)
- [Commit 9 — split the row from the domain type](#commit-9--split-the-row-from-the-domain-type)
- [Commit 10 — make the aggregate opaque](#commit-10--make-the-aggregate-opaque)
- [What each commit bought](#what-each-commit-bought)
- [What did not happen](#what-did-not-happen)

## The starting point

The service as it was found, in the language it was written in:

```text
class BookingService {
  constructor(repo, catalogue, mailer) { ... }

  confirm(dto) {
    if (!dto.patientId) throw new Error("bad booking")
    if (!dto.treatments || dto.treatments.length === 0)
      throw new Error("no treatments")

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
fields, exceptions, an ambient clock, wide service dependencies, rules
tangled with effects, one type for every stage, and the storage shape as
the domain model.

## Before commit 1

Two things, neither of them a move.

**Pin what it does.** The service has no tests, so the first work is
characterisation tests, as "Move 0" in
[migration-moves.md](migration-moves.md) describes: one for a booking
that confirms, and one for each of the five `throw` lines, asserting the
message it throws today. Every "green when" below means these still
pass, as well as what the commit adds.

**Ask what should not be moved at all.** One line looks like leftover
state: `booking.cancelReason = null`. Deleting it breaks something. A
cancelled booking that is confirmed again would keep its reason. So it
carries a rule, that a confirmed booking has no cancel reason, and a
rule is moved into a type, which commit 3 does. Nothing else in the
method is a candidate.

## Commit 1 — wrap primitives

```text
type BookingId = BookingId of Uuid
type TreatmentCode = TreatmentCode of String   -- as the catalogue spells it
type Quantity = Quantity of Integer            -- at least 1
type Money = Money of Integer                  -- satang

Quantity.parse : Integer -> Result<Quantity, ValidationError>
```

Change one signature, follow the failures outward, and let the
conversions accumulate at the boundary. The `treatment.qty < 1` check
leaves the loop and lives in `Quantity.parse`, once. Where the old code
threw, the caller of the parser still throws the same message; commit 4
is the one that stops throwing.

The types enforce what the code enforced and nothing more. An upper
bound on a quantity, or a format for a code, may well be right, and
either would change behaviour. That is a separate commit, with its own
reason.

**Green when:** `Quantity.parse` has tests of its own.

## Commit 2 — status string to a choice type

```text
type Status = Draft | Confirmed | Cancelled
```

Add conversions between the stored string and the type at the storage
boundary, then replace comparisons module by module. The
`booking.status === "confirmed"` guard becomes a match, and the compiler
or a coverage test lists every place still to convert.

**Green when:** a test shows every status value found in storage maps
to a case and back to the same string.

## Commit 3 — collapse the correlated fields

`confirmedAt`, `total` and `cancelReason` were three nullable fields
whose meaning depended on the status. They move into the cases:

```text
type Lifecycle =
  | Draft
  | Confirmed of { at: Instant, total: Money }
  | Cancelled of { reason: CancelReason }
```

Write the type beside the record, add a function from the old record to
the new type and one back, move the consumers over, and delete the old
fields last. The `cancelReason = null` line goes with them: a confirmed
booking now has nowhere to keep a reason.

Three statuses and three fields that could each be present or absent
made twenty-four combinations, of which three were legal. There are now
three cases. Nothing can be confirmed without a total.

**Green when:** the two conversion functions round-trip every legal
combination.

## Commit 4 — return `Result` instead of throwing

Work outward from the leaves.

```text
type ValidationError =
  | NoPatient
  | NoTreatments
  | BadQuantity of Integer

type ConfirmError =
  | Invalid of NonEmptyList<ValidationError>
  | UnknownTreatment of TreatmentCode
  | AlreadyConfirmed of BookingId

confirm : BookingDto -> AsyncResult<Booking, ConfirmError>
```

Every `throw` inside the module is now a named case that the signature
admits to. Stop at the module boundary and convert once there, back to
the old exceptions with the old messages, so the callers that still
expect them keep working.

The signature has an effect type because the function still loads,
saves and sends. It always did; the type now says so.

**Green when:** no `throw` or `catch` remains inside the module, and the
conversion at the boundary has a test for each case.

## Commit 5 — pass the clock in

```text
confirm : Instant -> BookingDto -> AsyncResult<Booking, ConfirmError>
```

Add the parameter, default it at the outermost call site, remove the
inner `new Date()`, then remove the default.

**Green when:** the tests no longer freeze a clock.

## Commit 6 — narrow the dependencies

The repository had nine methods and the catalogue client eleven. This
function used two of the first and one of the second.

```text
alias LoadBooking = BookingId -> AsyncResult<Option<Booking>, StoreError>
alias SaveBooking = Booking -> AsyncResult<Unit, StoreError>
alias FindTreatment =
  TreatmentCode -> AsyncResult<Option<Treatment>, StoreError>
alias SendMail = Message -> AsyncResult<Unit, MailError>

type ConfirmFailure =
  | Rejected of ConfirmError
  | Unavailable of StoreError
  | NotSent of MailError

confirm :
  LoadBooking -> SaveBooking -> FindTreatment -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
```

Each alias has an effect type, because each reaches the world, and a
failure of storage or of the mail server is now a value with a case of
its own. The module stops importing the repository and both clients.

**Green when:** the tests replace three mocks with four one-line
functions.

## Commit 7 — extract the pure decision

The move that changes how the code feels. Reads at the top, decision in
the middle, writes at the bottom; then lift the middle out.

The loop looked a treatment up for each line, which put a read inside
the rule. The handler now reads the catalogue once, so the rule can take
it as a value, and `FindTreatment` gives way to `LoadCatalogue`.

```text
-- core: no imports, no effects, total
decideConfirmation :
  Instant -> Catalogue -> Booking -> BookingDto
    -> Result<Booking, ConfirmError>

-- shell: the same effects, in the same order
alias LoadCatalogue = Unit -> AsyncResult<Catalogue, StoreError>

handleConfirm :
  LoadBooking -> LoadCatalogue -> SaveBooking -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
handleConfirm loadBooking loadCatalogue saveBooking sendMail now dto =
  both (loadBooking dto.id) (loadCatalogue ())                 -- read
    |> mapError Unavailable
    |> bind (\(found, catalogue) ->
         decideConfirmation now catalogue (orDraft dto.id found) dto
           |> mapError Rejected)                               -- decide
    |> bind (\booking ->
         saveBooking booking                                   -- write
           |> mapError Unavailable
           |> bind (\_ ->
                sendMail (confirmationFor booking)
                  |> mapError NotSent)
           |> map (\_ -> booking))
```

The reads now come before the checks on the form, where the old code
checked first. The answers are the same, except for a request that is
invalid while storage is down.

The pricing rule and the already-confirmed rule are now tested with
plain values. `orDraft` and `confirmationFor` are pure as well: one
supplies the empty draft the old code built when nothing was stored, the
other builds the message.

The mail is still sent inside the request, after the save, as it always
was. Sending it from the handler that receives a saved event is better,
and [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md)
says why. It is also a change in behaviour, so it is not part of this
refactor.

**Green when:** `decideConfirmation` imports no infrastructure and its
tests need no setup.

## Commit 8 — stage types

```text
UnvalidatedBooking -> ValidatedBooking -> PricedBooking -> Booking
```

Rename the input type to `UnvalidatedBooking`, add each stage as a copy,
and change each step's signature in turn. The loop that validated and
priced in one pass splits into two steps that cannot run out of order,
and `decideConfirmation` becomes their composition.

The re-checks inside it can now be deleted: a `ValidatedBooking` is
validated by construction.

**Green when:** no step accepts the unvalidated type except the first.

## Commit 9 — split the row from the domain type

Commits 2 and 3 left conversion functions at the storage boundary, and
the type they convert from is still the domain's. Copy that type to
`BookingRow`, keeping every compromise, and write the two mappings.

```text
toRow : Booking -> BookingRow
fromRow : BookingRow -> Result<Booking, BookingRowError>
```

`fromRow` returns `Result` because the table still holds rows written by
the old code: a `confirmed` row with a null total. That failure is real,
and this is where it surfaces instead of becoming an illegal state.

Storage now points at the row type, which releases the domain type.

**Green when:** a round-trip property passes, and a stored sample of
every shape the table holds maps to a booking or to a named error.

## Commit 10 — make the aggregate opaque

Stop exporting the constructor and the fields; export the operations.

```text
module Booking
  type Booking                                  -- opaque
  draft : BookingId -> Booking
  confirm :
    Instant -> PricedBooking -> Booking
      -> Result<Booking, ConfirmError>
  total : Booking -> Option<Money>
```

`confirm` is the last step of `decideConfirmation`, under the name the
business uses, and `draft` is what `orDraft` falls back to. `total` is
an `Option` because a draft has none. The compiler finds the call sites
that were reaching in. After this, the invariants are enforceable rather
than advisory.

**Green when:** no code outside the module constructs a booking or
changes one.

## What each commit bought

| Commit | Removed                                     |
| ------ | ------------------------------------------- |
| 1      | Quantities checked where they are used      |
| 2      | Status spelling known in four modules       |
| 3      | Twenty-four combinations, three legal       |
| 4      | Failures invisible in every signature       |
| 5      | Tests that had to freeze a clock            |
| 6      | Three mocks, and the imports of two clients |
| 7      | Rules that needed a database to test        |
| 8      | Steps that could run in the wrong order     |
| 9      | A schema migration for every domain change  |
| 10     | Invariants that callers could walk around   |

## What did not happen

No branch lived longer than a day. No commit changed behaviour and
structure at once. No part of the system was unavailable.

The order mattered. Commit 4 is what made commit 7 possible at all: a
decision cannot be lifted out while it still throws. Commit 6 is what
made the read in commit 7 visible, by giving it a name and a type.

Two things were left for later, on purpose, because each changes what
the service does: tighter bounds on a quantity and a code, and sending
the confirmation from a saved event.
