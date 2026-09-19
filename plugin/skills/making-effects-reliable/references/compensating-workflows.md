# Compensating Workflows

A process that spans several systems cannot hold a transaction across
them. The alternative is to make each step separately committable, and to
define an explicit undo for each one that has already run when a later
step fails.

## The shape

```text
-- each step commits on its own
reserve : BookingId -> AsyncResult<Reservation, ReserveError>
charge  : BookingId -> Money -> AsyncResult<Receipt, ChargeError>
issue   : BookingId -> Reservation -> AsyncResult<Ticket, IssueError>

-- each has a named business undo
releaseReservation : Reservation -> AsyncResult<Released, ReleaseError>
refundCharge : Receipt -> AsyncResult<Refunded, RefundError>
```

Note that the undos are not "rollback". `refundCharge` is a real business
operation with its own record, its own accounting consequence, and
possibly its own fee. Naming it `rollback` hides all of that.

## The process manager

The coordinator is a state machine, and the same rules apply as in
[modeling-state-machines](../../modeling-state-machines/SKILL.md): one
case per state, each carrying only its own data, transitions as pure
functions.

```text
type Booking =
  | Started of { key: CommandId, request: BookingRequest }
  | Reserved of { key: CommandId, reservation: Reservation }
  | Charged of { key: CommandId, reservation: Reservation,
                 receipt: Receipt }
  | Issued of { key: CommandId, ticket: Ticket }
  | Compensating of { key: CommandId, undo: NonEmptyList<Undo> }
  | Failed of { key: CommandId, reason: BookingFailure }
```

The pure part decides what to do next; the shell performs it.

```text
next : Booking -> Event -> (Booking, List<Command>)
```

That signature is the whole design. It is a pure function of two values,
testable as a table of cases, with no processes, no sleeping, and no
network. Everything hard about the process becomes data.

## Rules

1. **Persist the state after every transition.** A process manager that
   keeps its state in memory loses it on restart, which is the one thing
   it exists to survive.
2. **Every step is idempotent**, because the manager will retry. See
   [idempotency-and-delivery.md](idempotency-and-delivery.md).
3. **Compensation runs in reverse order.** Undo the most recent completed
   step first.
4. **Compensation can fail too.** It needs its own bounded retries and
   its own dead-end state, which is a human's problem and must be
   visible.
5. **Some steps cannot be undone.** An email that has been sent is sent.
   Booking the steps so irreversible ones come last, and if that is
   impossible, say so where the process is defined.
6. **The terminal states are business outcomes.** `Issued`, `Failed`,
   `Refunded` — each with its data, each meaningful to somebody outside
   engineering.

## When a process manager is the wrong answer

It is a real cost: a state table, a coordinator, retries, compensation
paths, and a new class of stuck-in-the-middle bug. Cheaper answers, tried
first:

| Situation                             | Cheaper answer         |
| ------------------------------------- | ---------------------- |
| Both steps are in your own database   | One transaction        |
| The second step may lag               | An event and a handler |
| The second step is optional           | Fire and forget, noted |
| The whole thing fits in one aggregate | One aggregate          |
| A human can resolve the rare failure  | Alert and a runbook    |

Reach for a process manager when the steps genuinely span systems, all of
them must eventually happen or be undone, and the failure rate is high
enough that a human cannot absorb it.

## Timeouts as events

A step that never answers is the common case, not an edge case. Give the
process a deadline per state and treat expiry as an ordinary event.

```text
next (Reserved r) (Timeout _) = (Compensating ..., [ReleaseReservation ...])
```

Without this, processes accumulate silently in an intermediate state, and
you discover them from a customer complaint rather than from a metric.

## Testing

The pure `next` function is tested exhaustively as a table: every state
crossed with every event, asserting the resulting state and commands.
That table is also the documentation, and it is where a missing timeout
transition becomes obvious.

The shell needs a small number of tests: that state is persisted before
commands are dispatched, that a restart resumes from the stored state,
and that a duplicate event does not advance the process twice.
