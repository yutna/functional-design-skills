# Persistence Patterns

Storage is a boundary with three additional concerns: transactions,
identity, and concurrency. The domain stays ignorant of all three.

## The shape

```text
-- declared by the domain, in the domain's words
alias LoadBooking = BookingId -> AsyncResult<Option<Booking>, LoadError>
alias SaveBooking = Booking -> AsyncResult<Unit, SaveError>

-- implemented in the shell, over rows
loadBookingFromDb pool id =
  selectRow pool id
    |> map (map fromRow)          -- Result, because rows can be wrong
```

There is no repository interface in the domain, no base class, and no
framework attribute on any domain type.

## Read, decide, write

Every command follows the same cycle, and the pure part sits in the
middle:

```text
handleCancel pool now id reason =
  withTransaction pool (\tx ->
    loadBooking tx id
      |> bind (toResult BookingNotFound)
      |> bind (cancelBooking now reason)     -- pure
      |> bind (saveBooking tx))
```

The pure function cannot start a transaction, commit one, or be affected
by a rollback. That is what makes it testable and reusable.

## Concurrency

Use an optimistic version rather than a lock.

1. Read the aggregate together with its version.
2. Apply the pure transition.
3. Write conditional on the version being unchanged; increment it.
4. On zero rows updated, re-read and re-apply, or return a conflict.

The version lives in the storage representation, not in the domain type.
If the domain genuinely needs to know about revisions, that is a domain
concept with a domain name, not an infrastructure counter.

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
type BookingListItem = { id: String, customer: String,
                       total: Money, status: String }
listBookings : Filter -> Async<List<BookingListItem>>
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
current : List<BookingEvent> -> Booking
current = fold applyEvent emptyBooking
```

Gains: complete audit, replay, and the ability to answer questions nobody
asked when the schema was designed. Costs: a projection step, an
event-versioning problem in place of a schema-migration problem, and
snapshots once the streams are long. Choose it because the business wants
history, not because it is elegant. See
[folding-over-data](../../folding-over-data/SKILL.md).

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
