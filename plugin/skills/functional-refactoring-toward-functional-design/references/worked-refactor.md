# A Refactor, Move by Move

One legacy service moved through the ten moves in
[migration-moves.md](migration-moves.md), tests green between. Every
move takes one commit except move 7, which takes two, because half of it
is a change a caller can see. Nothing here is a rewrite: at every point
the service still works and still ships.

## Contents

- [The starting point](#the-starting-point)
- [Before commit 1](#before-commit-1)
- [Commit 1 — wrap primitives](#commit-1--wrap-primitives)
- [Commit 2 — status string to a choice type](#commit-2--status-string-to-a-choice-type)
- [Commit 3 — collapse the correlated fields](#commit-3--collapse-the-correlated-fields)
- [Commit 4 — return `Result` instead of throwing](#commit-4--return-result-instead-of-throwing)
- [Commit 5 — pass the clock in](#commit-5--pass-the-clock-in)
- [Commit 6 — narrow the dependencies](#commit-6--narrow-the-dependencies)
- [Commit 7 — read before deciding](#commit-7--read-before-deciding)
- [Commit 8 — extract the pure decision](#commit-8--extract-the-pure-decision)
- [Commit 9 — stage types](#commit-9--stage-types)
- [Commit 10 — split the row from the domain type](#commit-10--split-the-row-from-the-domain-type)
- [Commit 11 — make the aggregate opaque](#commit-11--make-the-aggregate-opaque)
- [What each commit bought](#what-each-commit-bought)
- [What did not happen](#what-did-not-happen)

## The starting point

The service as it was found, in the language it was written in:

```text
class BookingService {
  constructor(repo, catalogue, mailer) { ... }

  async confirm(dto) {
    if (!dto.patientId) throw new Error("bad booking")
    if (dto.treatments.length === 0) throw new Error("no treatments")
    for (const treatment of dto.treatments)
      if (treatment.qty < 1) throw new Error("bad quantity")

    let total = 0
    for (const treatment of dto.treatments) {
      const priced = await this.catalogue.find(treatment.code)
      if (!priced) throw new Error("unknown treatment " + treatment.code)
      total += priced.price * treatment.qty
    }

    const booking = (await this.repo.load(dto.id)) ?? { id: dto.id }
    if (booking.status === "confirmed") throw new Error("already confirmed")

    booking.status = "confirmed"
    booking.confirmedAt = new Date()
    booking.total = total
    booking.cancelReason = null

    await this.repo.save(booking)
    await this.mailer.send(dto.email, "Booking confirmed", render(booking))
    return booking
  }
}
```

Everything is here: primitives, a status string, correlated nullable
fields, exceptions, an ambient clock, wide service dependencies, rules
tangled with effects, one type for every stage, and the storage shape as
the domain model.

What the commits rely on about its surroundings:

- The transport has already checked the request body against the API's
  schema. `id` is a UUID, `qty` an integer, `code` and `email` strings,
  and `treatments` a list, empty when the caller sent none.
- The catalogue's prices are whole numbers of satang. Its client can
  list every treatment as well as find one, and the two agree: `find`
  returns a treatment exactly when the list holds it.
- The repository reads a row on every `load`. It never hands the same
  object out twice.
- The bookings table has the five columns this method touches: the id,
  the status, and the three fields the method sets.

## Before commit 1

Two things, neither of them a move.

**Pin what it does.** The service has no tests, so the first work is
characterisation tests, as "Move 0" in
[migration-moves.md](migration-moves.md) describes. From here on they
are what "behaviour" means:

- a booking that confirms: what is returned, what is saved, and what is
  sent to whom;
- one request for each `throw`, asserting its message;
- one request with two things wrong for each pair of checks that stand
  next to each other, asserting which message wins;
- the catalogue, the repository and the mailer each failing in turn,
  asserting what is thrown and what had been saved by then.

Every "green when" below means these still pass, as well as what the
commit adds.

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

type QuantityError = BelowOne of Integer
Quantity.parse : Integer -> Result<Quantity, QuantityError>
```

Change one signature, follow the failures outward, and let each
conversion settle where its check was. An id and a code cannot fail to
wrap, because the schema has already made them what the wrapper needs,
so they are wrapped as the request arrives. A quantity can fail. So
`Quantity.parse` is called in the loop that held the `qty < 1` check,
and that loop throws the same message from the same place. The order of
the checks does not move, and commit 4 is the one that stops throwing.

The types enforce what the schema and the code already enforced, and
nothing more. An upper bound on a quantity, or a format for a code, may
well be right, and either would change behaviour. That is a separate
commit, with its own reason.

**Green when:** the parser has tests of its own, and below the
validation loop no function of the module's own takes a raw quantity,
code or id.

## Commit 2 — status string to a choice type

```text
type Status = Draft | Confirmed | Cancelled
```

First find out what the column holds. A query for its distinct values
found `draft`, `confirmed` and `cancelled`. A booking that was never
stored has no status at all, and the old comparison let it through, so
the conversion reads a missing status as `Draft`.

Add conversions between the stored string and the type at the storage
boundary, then replace comparisons module by module. The
`booking.status === "confirmed"` guard becomes a match, and the compiler
or a coverage test lists every place still to convert.

A string outside those three now fails to convert, with an error that
names it, where the old code would have gone on and confirmed the
booking. No row holds one, so no caller can see the difference, and the
test below is what shows it. Had the query found a fourth value, it
would have been a fourth case and not a default.

**Green when:** a test shows that every status the query found maps to a
case and back to the same string, and that any other string is refused
by name.

## Commit 3 — collapse the correlated fields

`confirmedAt`, `total` and `cancelReason` were three nullable fields
whose meaning depended on the status. They move into the cases, and
`Status` goes with them:

```text
type Lifecycle =
  | Draft
  | Confirmed of { at: Instant, total: Money }
  | Cancelled of { reason: CancelReason }

type Booking = { id: BookingId, lifecycle: Lifecycle }
```

Write the type beside the record, add a function from the old fields to
the new type and one back, move the consumers over, and delete the old
fields last. The first of the two returns a `Result`: a confirmed status
with no total has no case to go to, and is refused by name. Until commit
4 its caller throws on that refusal, as the caller of commit 1's parser
does. The `cancelReason = null` line goes with the old fields, because a
confirmed booking now has nowhere to keep a reason.

`BookingService.confirm` still returns the record its callers know. The
function back builds it from the new type, and goes on doing so in
every commit that follows.

A query comes first here too. Three statuses and three fields that could
each be present or absent make twenty-four combinations, of which three
are legal, and the query found only those three in the table. Had it
found a fourth, the choice would have been a case for it or a repair of
those rows, in a change of its own, before this one.

**Green when:** the two conversions round-trip every combination the
query found, and the first refuses every other combination by name.

## Commit 4 — return `Result` instead of throwing

Work outward from the leaves.

```text
type ConfirmError =
  | NoPatient
  | NoTreatments
  | BadQuantity of QuantityError
  | UnknownTreatment of TreatmentCode
  | AlreadyConfirmed of BookingId

-- throws what the catalogue, the repository and the mailer throw
confirm : BookingDto -> AsyncResult<Booking, ConfirmError>
```

The cases are in the order the checks run, and the function still stops
at the first check that fails. Every `throw` of the module's own is now
a named case that the signature admits to.

`BookingService.confirm` stays as the boundary. It calls the function
and converts once: an error back to the old exception with the old
message, and the booking back to the old record, so the callers that
expect them keep working.

The signature has an effect type because the function still looks up,
loads, saves and sends. It always did; the type now says so. What those
three collaborators throw still passes straight through, as the comment
says, until commit 6 gives it a type.

**Green when:** the module's own code has no `throw` and no `catch`
outside that one conversion, and the conversion has a test for each
case.

## Commit 5 — pass the clock in

```text
-- throws what the catalogue, the repository and the mailer throw
confirm : Instant -> BookingDto -> AsyncResult<Booking, ConfirmError>
```

Add the parameter with the system clock as its default, remove the inner
`new Date()`, then remove the default, so that `BookingService.confirm`
reads the clock and passes the instant in.

`confirmedAt` is now the instant the request arrived, where it was the
instant after the lookups. Nothing compares the two and no test can tell
them apart. It is a difference all the same, so the commit message says
it.

**Green when:** the tests pass an instant and no longer freeze a clock.

## Commit 6 — narrow the dependencies

The repository had nine methods and the catalogue client eleven. This
function used two of the first and one of the second.

```text
alias FindTreatment =
  TreatmentCode -> AsyncResult<Option<Treatment>, StoreError>
alias LoadBooking = BookingId -> AsyncResult<Option<Booking>, StoreError>
alias SaveBooking = Booking -> AsyncResult<Unit, StoreError>
alias SendMail = Message -> AsyncResult<Unit, MailError>

type ConfirmFailure =
  | Rejected of ConfirmError
  | Unavailable of StoreError
  | NotSent of MailError

confirm :
  FindTreatment -> LoadBooking -> SaveBooking -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
```

Each alias has an effect type, because each reaches the world.
`BookingService.confirm` passes the repository's and the clients' own
methods, each wrapped with `tryCatch`, so that what one of them throws
comes back as a `StoreError` or a `MailError` holding the exception. A
failure of storage or of the mail server is now a value with a case of
its own, and the `-- throws` comment is gone. The conversion at the
boundary gains two cases, which rethrow the held exception as it was.
The module stops importing the repository and both clients.

**Green when:** the tests pass plain functions where they passed mocks,
the module imports none of the three collaborators, and the tests for a
failing collaborator still see the exception they saw.

## Commit 7 — read before deciding

Move 7 has two halves: put the reads at the top, then lift out what is
left in the middle. The first half is the one commit here that a caller
can notice, so it is made alone.

The loop looked a treatment up for each line, which put a read inside
the rule. The function now reads the whole catalogue once, and the
stored booking, before it checks anything. `FindTreatment` gives way to
`LoadCatalogue`, which wraps the client's method that lists every
treatment.

```text
alias LoadCatalogue = Unit -> AsyncResult<Catalogue, StoreError>

confirm :
  LoadCatalogue -> LoadBooking -> SaveBooking -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
```

What is the same: every request that got an answer while the catalogue
and the repository were up gets that answer, the checks run in the same
order, and the save and the mail are untouched.

What changes is the reads. Every request now makes two, the whole
catalogue and the booking. Before, a request made one lookup for each
treatment, stopping at the first that was unknown, and then loaded the
booking; a request with a bad form made none. So a refused request costs
reads it did not cost, and when the catalogue or the repository is down
it fails as unavailable where it used to be refused. No test above pins
a refused request while a collaborator is down, so this commit adds one
for each of the two, and its message says what moved.

The commit rests on the list and `find` agreeing, which is one of the
points under the starting code. Check it against the real catalogue
before relying on it.

**Green when:** the characterisation tests pass with no change but a
list method on the catalogue's test double, and the two new tests show a
refused request failing as unavailable.

## Commit 8 — extract the pure decision

The second half of move 7, and the one that changes how the code feels.
Everything between the reads and the writes is lifted out, and the
function that is left becomes the handler, under the name
`handleConfirm`.

```text
-- core: no imports, no effects, total
decideConfirmation :
  Instant -> Catalogue -> Booking -> BookingDto
    -> Result<Booking, ConfirmError>

-- shell: the reads and writes of commit 7, in the same order
handleConfirm :
  LoadCatalogue -> LoadBooking -> SaveBooking -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
handleConfirm loadCatalogue loadBooking saveBooking sendMail now dto =
  loadCatalogue ()                                             -- read
    |> bind (\catalogue ->
         loadBooking dto.id |> map (\found -> (catalogue, found)))
    |> mapError Unavailable
    |> bind (\(catalogue, found) ->
         decideConfirmation now catalogue (orDraft dto.id found) dto
           |> mapError Rejected)                               -- decide
    |> bind (\booking ->
         saveBooking booking                                   -- write
           |> mapError Unavailable
           |> bind (\_ ->
                sendMail (confirmationFor dto.email booking)
                  |> mapError NotSent)
           |> map (\_ -> booking))
```

Every rule is now tested with plain values. `orDraft` and
`confirmationFor` are pure as well: one supplies the draft the old code
built when nothing was stored, the other builds the message for the
address the request gave.

The mail is still sent inside the request, after the save, as it always
was. Sending it from the handler that receives a saved event is better,
and [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md)
says why. It is also a change in behaviour, so it is not part of this
refactor.

**Green when:** `decideConfirmation` imports no infrastructure, its
tests need no setup, and the handler's tests see the same reads, the
same save and the same mail as after commit 7.

## Commit 9 — stage types

```text
validateRequest :
  UnvalidatedBooking -> Result<ValidatedBooking, ConfirmError>
priceTreatments :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, ConfirmError>
Booking.confirm :
  Instant -> PricedBooking -> Booking -> Result<Booking, ConfirmError>

decideConfirmation now catalogue booking unvalidated =
  validateRequest unvalidated
    |> bind (priceTreatments catalogue)
    |> bind (\priced -> Booking.confirm now priced booking)
```

Rename the input type, `BookingDto`, to `UnvalidatedBooking`. Add each
stage as a copy and change each step's signature in turn: a
`ValidatedBooking` has a patient and a non-empty list of treatments with
parsed quantities, and a `PricedBooking` adds the total. The three steps
fail in the order the checks always ran: the form, then an unknown
treatment, then a booking already confirmed.

**Green when:** no step but `validateRequest` accepts the unvalidated
type.

## Commit 10 — split the row from the domain type

Commits 2 and 3 each left a pair of conversions at the storage boundary,
and the repository still builds a booking field by field. Give the
stored shape a name of its own, `BookingRow`, with the string status and
the three nullable columns exactly as the table has them, and gather the
conversions into two mappings. The move says to copy the current type
and calls the copy a DTO. Commits 2 and 3 have already improved the
current type here, so the copy is taken from the table, and it is called
a row because in this service `BookingDto` was the request.

```text
toRow : Booking -> BookingRow
fromRow : BookingRow -> Result<Booking, RowError>
```

`fromRow` returns `Result` because a table can hold what the domain type
cannot. The refusals of commits 2 and 3, a status or a combination
outside the ones the queries found, now have one home and one type. The
function behind `LoadBooking` calls `fromRow`, and a row it cannot read
comes back in the case of `StoreError` that holds a `RowError`, which
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md)
declares. At the boundary that case becomes the exception those two
conversions threw, with the same message.

Storage now points at the row type, which releases the domain type.

**Green when:** a round-trip property passes, and a stored sample of
every shape the queries found maps to a booking.

## Commit 11 — make the aggregate opaque

Stop exporting the constructor and the fields; export the operations.

```text
module Booking
  type Booking                                  -- opaque
  draft : BookingId -> Booking
  confirm :
    Instant -> PricedBooking -> Booking
      -> Result<Booking, ConfirmError>
  id : Booking -> BookingId
  lifecycle : Booking -> Lifecycle
  restore : BookingId -> Lifecycle -> Booking   -- for fromRow alone
```

`confirm` is the step commit 9 named, and `draft` is what `orDraft`
falls back to. The two accessors are what `toRow` and `confirmationFor`
read. `restore` rebuilds a booking from what was stored, and `fromRow`
is its only caller. The compiler finds the call sites that were reaching
in. After this, the invariants are enforceable rather than advisory.

**Green when:** no code outside the module changes a booking, and none
but `fromRow` builds one from parts.

## What each commit bought

| Commit | Removed                                      |
| ------ | -------------------------------------------- |
| 1      | Quantities checked where they are used       |
| 2      | Status spelling known wherever it was tested |
| 3      | Twenty-four combinations, three legal        |
| 4      | Failures invisible in every signature        |
| 5      | Tests that had to freeze a clock             |
| 6      | Three mocks, and the imports behind them     |
| 7      | A read inside the pricing rule               |
| 8      | Rules that needed a database to test         |
| 9      | Steps that could run in the wrong order      |
| 10     | A schema migration for every domain change   |
| 11     | Invariants that callers could walk around    |

## What did not happen

No branch lived longer than a day. No part of the system was
unavailable. Commits 2 and 5 each record a difference that no caller can
observe. One commit, the seventh, changed something a caller can see,
and that is all it is for: the reads moved, and no rule did.

The order mattered. Commit 4 is what made commit 8 possible at all: a
decision cannot be lifted out while it still throws. Commit 6 is what
made the reads of commit 7 visible, by giving each a name and a type.

Two things were left for later, on purpose, because each changes what
the service does: tighter bounds on a quantity and a code, and sending
the confirmation from a saved event.
