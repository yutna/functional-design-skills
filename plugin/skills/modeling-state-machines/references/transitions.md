# Transitions in Depth

## Guards

A guard is a condition that decides whether a legal transition succeeds
this time. It belongs inside the transition function, and its failure is
a case of that transition's error type.

```text
accept : Instant -> CustomerId -> Sent -> Result<Accepted, AcceptError>
type AcceptError = Expired of Instant | NotAuthorised of CustomerId
```

Two rules:

1. The guard's inputs are parameters. A guard that reads the clock or the
   database from inside makes the transition untestable and impure.
2. The error names the business reason, not the mechanism. `Expired`,
   not `GuardFailed`.

Where a guard needs data the state does not carry, pass the lookup in:

```text
accept :
  GetCustomerCredit -> Instant -> CustomerId -> Sent
    -> Result<Accepted, AcceptError>
```

## Terminal states

Cancelled, expired, refunded, archived: these are states, and they carry
data. Modelling them as deletion or as a boolean loses the reason and the
time, which is exactly what the business will ask about later.

```text
type Cancelled = { id: QuoteId, reason: CancelReason,
                   at: Instant, by: UserId }
```

A terminal state has no outgoing transitions. That is expressed by there
being no function that takes it.

## The same command from several states

When a command applies to more than one state, write one function per
source state rather than one that takes the union.

```text
cancelDraft : CancelReason -> Instant -> Draft -> Cancelled
cancelSent : CancelReason -> Instant -> Sent -> Result<Cancelled, TooLate>
```

They differ: cancelling a sent quote may need to notify the customer, and
may be refused after acceptance is pending. Merging them hides that
difference behind a branch.

If the two really are identical, and will stay identical, one function
over the union is acceptable. Check the "would they need the same edit"
test in
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

## Concurrent commands

Two commands may arrive for the same entity at once. The state machine
itself stays pure; concurrency is handled where state is stored.

- Read the current state, apply the transition, write back **only if the
  state has not changed** since the read. An optimistic version field
  makes this one comparison.
- On conflict, re-read and re-apply, or report a conflict to the caller.
  Both are business decisions; make them explicitly.
- Never let a transition function retry internally. It has no idea what
  else is happening.

See
[managing-state-immutably](../../managing-state-immutably/SKILL.md).

## Persistence

Storage rarely supports choice types directly. The mapping is explicit
and lives at the edge.

```text
-- one table, a discriminator column, and nullable columns per case
toRow : Quote -> QuoteRow
fromRow : QuoteRow -> Result<Quote, RowError>
```

`fromRow` returns `Result` because storage can hold rows the domain
cannot accept: a row with status "accepted" and no booking identifier, most
likely written by an older version of the code. That failure is real, and
hiding it behind a default produces the illegal state you removed.

Alternatives worth considering when the states differ a lot: one table
per state, or an event log from which the current state is folded. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md) and
[folding-over-data](../../folding-over-data/SKILL.md).

## Evolving a state machine

Adding a state:

1. Add the case to the union. Every match now fails to compile or fails a
   coverage test; that list is the work.
2. Add the transition functions into and out of it.
3. Update the storage mapping, including reading old rows that predate
   the state.
4. Decide what existing consumers should do. Defaulting them to "ignore
   the new case" is a decision, so make it deliberately.

Removing a state:

1. Stop constructing it; keep reading it.
2. Migrate stored instances.
3. Remove the case only when no stored data can produce it.

Renaming a state: change the type name freely; change the **stored**
discriminator only with a migration, since old rows keep the old spelling.

## Checking the model

Two properties worth testing directly:

- **Reachability.** Every state is reachable from the initial state by
  some sequence of commands. An unreachable state is dead code.
- **No accidental cycles.** If the business says a lifecycle only moves
  forward, assert there is no path from a later state back to an earlier
  one.

Both are easy to express as property tests over a generated command
sequence. See
[testing-functional-code](../../testing-functional-code/SKILL.md).
