# A Long-Running Process, Worked

Three systems, none of them yours, all of them able to fail after
succeeding. The example builds the process manager for a clinic booking
that must reserve a slot, take payment, and issue a ticket.

## The request

> Booking a paid appointment holds the slot, charges the card, and issues
> a ticket. The slot service and the payment provider are separate
> systems. If the charge fails we must release the slot. If issuing fails
> after we charged, we must refund. Nothing may be double-charged, and
> nothing may sit half-done without somebody finding out.

Three effects, two of them irreversible-by-default, and a network between
each pair. No transaction spans them, so the answer is an explicit
process with explicit undo.

## Step 1: give the intent an identity

```text
type BookingCommand = {
  key: CommandId,              -- created by the client, stable on retry
  patient: PatientId,
  slot: SlotId,
  card: CardToken,
  amount: Money,
}
```

Everything downstream keys off `key`. Without it there is no way to tell
a retry from a second booking, and every other guarantee here collapses.

## Step 2: model the process as states

Each state holds exactly what has been achieved so far, so nothing can
claim to be charged without a receipt.

```text
type Booking =
  | Started of { key: CommandId, cmd: BookingCommand }
  | Reserved of { key: CommandId, cmd: BookingCommand,
                  hold: SlotHold, expires: Instant }
  | Charged of { key: CommandId, hold: SlotHold, receipt: Receipt }
  | Issued of { key: CommandId, ticket: Ticket, receipt: Receipt }
  | Undoing of { key: CommandId, remaining: NonEmptyList<Undo>,
                 because: BookingFailure }
  | Abandoned of { key: CommandId, because: BookingFailure }
  | Stuck of { key: CommandId, failed: Undo, because: BookingFailure }

type Undo = ReleaseHold of SlotHold | RefundCharge of Receipt
```

`Stuck` is the state people forget. Compensation can fail, and when it
does a human has to act; a process with no such state either loops
forever or silently gives up.

## Step 3: the transition function

Pure, total, and the entire design.

```text
next : Instant -> Booking -> BookingEvent -> (Booking, List<Command>)
```

```text
next now (Started s) (HoldSucceeded h) =
  (Reserved { key: s.key, cmd: s.cmd, hold: h, expires: h.expires },
   [Charge s.key s.cmd.card s.cmd.amount])

next now (Reserved r) (ChargeSucceeded receipt) =
  (Charged { key: r.key, hold: r.hold, receipt },
   [IssueTicket r.key r.hold])

next now (Reserved r) (ChargeFailed reason) =
  (Undoing { key: r.key, remaining: [ReleaseHold r.hold],
             because: PaymentDeclined reason },
   [Release r.hold])

next now (Charged c) (IssueFailed reason) =
  (Undoing { key: c.key,
             remaining: [RefundCharge c.receipt, ReleaseHold c.hold],
             because: IssuingFailed reason },
   [Refund c.receipt])

next now (Reserved r) (Timeout _) =
  (Undoing { key: r.key, remaining: [ReleaseHold r.hold],
             because: HoldExpired },
   [Release r.hold])
```

Two things to notice. Compensation runs in reverse order, refund before
release. And a timeout is an ordinary event, not an exception: without
that clause, a slot service that never answers leaves bookings reserved
for ever.

## Step 4: make every effect idempotent

The manager will retry. Each adapter takes the command identity and
returns the original outcome on a repeat.

```text
hold   : CommandId -> SlotId -> AsyncResult<SlotHold, HoldError>
charge : CommandId -> CardToken -> Money -> AsyncResult<Receipt, ChargeError>
issue  : CommandId -> SlotHold -> AsyncResult<Ticket, IssueError>
refund : CommandId -> Receipt -> AsyncResult<Refunded, RefundError>
```

The payment provider supports an idempotency key, so `charge` passes
`key` straight through. The slot service does not, so `hold` uses a
unique constraint on `(key, slot)` and returns the existing hold when the
insert conflicts. See
[idempotency-and-delivery.md](idempotency-and-delivery.md).

## Step 5: the shell loop

```text
handle : BookingEvent -> AsyncResult<Unit, ShellError>
handle event =
  loadProcess event.key
    |> map (\state -> next now state event)
    |> bind (\(state', commands) ->
         saveProcessAndOutbox state' commands)      -- one transaction
```

The order matters and is the whole reliability argument: **persist the
new state and the commands together, then dispatch from the outbox.** If
the process crashes after saving, the commands are still there. If it
crashes after dispatching but before marking, the command is sent twice,
which step 4 made safe.

## Step 6: bound everything

| Bound                 | Value and reason               |
| --------------------- | ------------------------------ |
| Hold expiry           | 2 min, from the slot service   |
| Charge attempts       | 3, jittered, total budget 20 s |
| Issue attempts        | 5; failure here is expensive   |
| Compensation attempts | 10 over an hour, then `Stuck`  |
| Process lifetime      | 24 h, then `Stuck`             |

Every one of these is a business decision, so each is a value in one
config type and named in the domain's words, not a constant inside a
retry helper. See
[retries-and-backpressure.md](retries-and-backpressure.md).

## Step 7: make it visible

The process states are already the metric.

```text
count "booking.completed"
count "booking.abandoned" { because: tagOf failure }
gauge "booking.in_flight" { state: tagOf state }
gauge "booking.stuck"                       -- alerts at > 0
time  "booking.total"
```

`booking.stuck` above zero is a page: it means money moved and a person
must intervene. Everything else is a dashboard. See
[designing-what-to-observe](../../designing-what-to-observe/SKILL.md).

## What this bought

| Decision                        | What it prevented                |
| ------------------------------- | -------------------------------- |
| Client-supplied command key     | A retry becoming a second charge |
| One state per achievement       | "Charged" with no receipt        |
| Timeout as an ordinary event    | Bookings reserved for ever       |
| State and commands in one write | A charge with no follow-up       |
| Idempotent adapters             | Duplicate holds and charges      |
| Reverse-booking compensation    | A released slot still charged    |
| An explicit `Stuck` state       | Silent give-up after money moved |
| Bounds named in the domain      | Constants nobody could find      |

## Testing it

`next` is tested as a table: every state crossed with every event,
asserting the resulting state and the emitted commands. Around sixty
cases, all pure, all fast, and the table doubles as the specification.
A missing timeout clause shows up as an empty cell.

The shell needs four tests: state is persisted before commands dispatch,
a restart resumes from stored state, a duplicate event does not advance
the process twice, and a failing compensation eventually reaches `Stuck`.

No test in either group needs a real payment provider.
