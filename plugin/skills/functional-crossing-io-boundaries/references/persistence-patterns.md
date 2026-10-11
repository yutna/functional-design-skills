# Persistence Patterns

Storage is a boundary with three additional concerns: transactions,
identity, and concurrency. The domain stays ignorant of all three.

## Contents

- [The shape](#the-shape)
- [Read, decide, write](#read-decide-write)
- [Concurrency](#concurrency)
- [Commands and queries](#commands-and-queries)
- [Storing choice types](#storing-choice-types)
- [Storing events](#storing-events)
- [Identity](#identity)
- [Migrations](#migrations)

## The shape

```text
-- declared in the domain's words; the version is the store's
type Versioned<T> = { value: T, version: Integer }
type StoreError =
  | Unreachable of DbError
  | BadRow of RowError
alias LoadError = StoreError
type SaveError =
  | Conflict
  | Failed of StoreError
alias LoadBooking =
  BookingId -> AsyncResult<Option<Versioned<Booking>>, LoadError>
alias SaveBooking =
  Versioned<Booking> -> AsyncResult<Unit, SaveError>

-- implemented in the shell, over rows
loadBookingFromDb pool id =
  selectRow pool id        -- AsyncResult<Option<Row>, DbError>
    |> mapError Unreachable
    |> bind (traverse fromRow >> mapError BadRow)
```

`fromRow` returns a `Result`, because rows can be wrong. `traverse`
turns the `Option<Result<...>>` that mapping a missing row would give
into a `Result<Option<...>, ...>`, so a missing row is `None` inside
`Ok`. There is no repository interface in the domain, no base class, and
no framework attribute on any domain type.

## Read, decide, write

Every command follows the same cycle, and the pure part sits in the
middle:

```text
type CancelFailure =
  | NotFound
  | Rejected of CancelError
  | VersionChanged
  | Unavailable of StoreError

toFailure : SaveError -> CancelFailure
toFailure e =
  match e with
  | Conflict -> VersionChanged
  | Failed fault -> Unavailable fault

handleCancel :
  LoadBooking -> SaveBooking -> Instant -> BookingId -> CancelReason
    -> AsyncResult<Unit, CancelFailure>
handleCancel loadBooking saveBooking now id reason =
  loadBooking id                                       -- read
    |> mapError Unavailable
    |> bind (toResult NotFound)
    |> bind (\versioned ->
         cancelBooking now reason versioned.value      -- decide
           |> mapError Rejected
           |> map (\booking -> { ...versioned, value: booking }))
    |> bind (saveBooking >> mapError toFailure)        -- write
```

The store owns the transaction. The handler never holds one: it takes
the two capabilities, and a test can hand it a fake store. Elsewhere in
the pack `loadBooking` returns the booking alone, where the version is
not the point. The
pure function cannot start a transaction, commit one, or be affected by
a rollback. That is what makes it testable and reusable.

Where two things must be written together, the store offers one
function that writes both, such as a `saveCancellation` that takes the
booking and the refund it leads to. A handler that has to hold a
transaction open across two calls has been given the wrong interface.

## Concurrency

Use an optimistic version rather than a lock.

1. Read the aggregate together with its version, as a
   `Versioned<Booking>`.
2. Apply the pure transition to the `value`, and keep the version.
3. Write conditional on the version being unchanged; increment it.
4. On zero rows updated, the save returns `Conflict`. The handler
   re-reads and re-applies, or returns the conflict.

The wrapper belongs to the shell: the pure transition takes and returns
a `Booking`, and the version never enters the domain type. If the domain
genuinely needs to know about revisions, that is a domain concept with a
domain name, not an infrastructure counter.

## Commands and queries

Separate the two paths, and let them use different types.

| Path    | Goes through     | Returns             |
| ------- | ---------------- | ------------------- |
| Command | Domain aggregate | Events, or a result |
| Query   | Storage directly | A view type         |

Reconstructing an aggregate to render a list screen is wasted work and
couples the screen to the domain's shape. Query a purpose-built view
type instead:

```text
type BookingListItem = { id: String, patient: String,
                       total: Money, status: String }
listBookings : Filter -> AsyncResult<List<BookingListItem>, LoadError>
```

This is not a violation of the model; it is the recognition that reading
and deciding are different jobs. The invariants matter on the write path,
where they are enforced by the aggregate.

## Storing choice types

Three options, in order of how often they are right:

**One table, a discriminator, nullable columns.** Simple, and fine when
the cases are similar. `fromRow` returns `Result` because the database
can hold combinations the domain forbids.

**One table per case.** Better when the cases have little in common, and
avoids a wide sparse table. Reading requires a union or several queries.

**A document column.** Store the serialised choice type in one column.
Simple and flexible; loses the ability to query inside it, so keep the
fields you filter on as real columns beside it.

## Storing events

When history is part of the domain, store what happened and fold to get
the current state.

```text
current : List<BookingEvent> -> Option<Booking>
current = fold applyEvent None
```

`applyEvent` takes the state so far, `None` before the first event, and
the next event. The first event creates the `Booking`, because there is
no empty `Booking` to start from: its `id` and its non-empty treatments
come from that event.

Gains: complete audit, replay, and the ability to answer questions nobody
asked when the schema was designed. Costs: a projection step, an
event-versioning problem in place of a schema-migration problem, and
snapshots once the streams are long. Choose it because the business wants
history, not because it is elegant. See
[functional-folding-over-data](../../functional-folding-over-data/SKILL.md).

## Identity

The domain assigns identity; storage records it. Two consequences:

- Generate identifiers before saving, at the edge, and pass them in. An
  identifier that only exists after an insert means the domain value was
  incomplete until it was stored.
- Do not use the storage key as a domain identifier when it has no
  meaning to the business. A surrogate row identifier is a storage
  detail.

## Migrations

The domain type changes freely. When the stored representation must
change:

1. Write the new mapping so it can read both shapes.
2. Deploy.
3. Migrate rows in the background.
4. Remove the old branch once no rows remain.

Keeping a sample of every historical row shape in the test suite makes
step 4 safe to take.
