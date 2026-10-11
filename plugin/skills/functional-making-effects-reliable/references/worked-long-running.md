# A Long-Running Process, Worked

Three systems, none of them yours, all of them able to fail after
succeeding. The example builds the process manager for a clinic booking
that must reserve a slot, take payment, and issue a ticket.

## Contents

- [The request](#the-request)
- [Step 1: give the intent an identity](#step-1-give-the-intent-an-identity)
- [Step 2: model the process as states](#step-2-model-the-process-as-states)
- [Step 3: the transition function](#step-3-the-transition-function)
- [Step 4: make every effect idempotent](#step-4-make-every-effect-idempotent)
- [Step 5: the shell loop](#step-5-the-shell-loop)
- [Step 6: bound everything](#step-6-bound-everything)
- [Step 7: make it visible](#step-7-make-it-visible)
- [What this bought](#what-this-bought)
- [Testing it](#testing-it)

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
claim to be charged without a receipt. `Booking` is the aggregate the
workflows save; this type is the state of the process, and is declared
here once.

```text
type BookingProcess =
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

`Issued` and `Abandoned` are the two ways the process ends well: the
booking exists, or every effect has been undone. `Stuck` is the state
people forget. Compensation can fail, and when it does a human has to
act; a process with no such state either loops forever or silently
gives up.

## Step 3: the transition function

Pure, total, and the entire design. What reaches the process from other
systems and from timers is a `ProcessEvent`; `BookingEvent` stays the
name for what a workflow decides. What `advance` returns for the shell
to perform is a list of instructions.

```text
type ProcessEvent =
  | HoldSucceeded of SlotHold
  | ChargeSucceeded of Receipt
  | ChargeFailed of ChargeError
  | IssueSucceeded of Ticket
  | IssueFailed of IssueError
  | Timeout

type Instruction =
  | Charge of { key: CommandId, card: CardToken, amount: Money }
  | IssueTicket of { key: CommandId, hold: SlotHold }
  | Release of { key: CommandId, hold: SlotHold }
  | Refund of { key: CommandId, receipt: Receipt }
```

```text
advance :
  Instant -> BookingProcess -> ProcessEvent
    -> (BookingProcess, List<Instruction>)
```

```text
advance now (Started s) (HoldSucceeded h) =
  (Reserved { key: s.key, cmd: s.cmd, hold: h, expires: h.expires },
   [Charge { key: s.key, card: s.cmd.card, amount: s.cmd.amount }])

advance now (Reserved r) (ChargeSucceeded receipt) =
  (Charged { key: r.key, hold: r.hold, receipt },
   [IssueTicket { key: r.key, hold: r.hold }])

advance now (Charged c) (IssueSucceeded ticket) =
  (Issued { key: c.key, ticket, receipt: c.receipt }, [])

advance now (Reserved r) (ChargeFailed reason) =
  (Undoing { key: r.key, remaining: [ReleaseHold r.hold],
             because: PaymentDeclined reason },
   [Release { key: r.key, hold: r.hold }])

advance now (Charged c) (IssueFailed reason) =
  (Undoing { key: c.key,
             remaining: [RefundCharge c.receipt, ReleaseHold c.hold],
             because: IssuingFailed reason },
   [Refund { key: c.key, receipt: c.receipt }])

advance now (Reserved r) Timeout =
  (Undoing { key: r.key, remaining: [ReleaseHold r.hold],
             because: HoldExpired },
   [Release { key: r.key, hold: r.hold }])
```

Two things to notice. Compensation runs in reverse order, refund before
release. And a timeout is an ordinary event, not an exception: without
that clause, a slot service that never answers leaves bookings reserved
for ever. The deadline for each state is a decision, so it is made here
and not in the shell.

## Step 4: make every effect idempotent

The manager will retry. Each adapter takes an effect key and returns the
original outcome on a repeat. The key is derived from the command's key
and the name of the operation with `effectKey` from
[SKILL.md](../SKILL.md), so the charge and the refund of one booking
never share a key. A payment provider that honours idempotency keys
treats a reused key as a replay of the first request; Stripe's
documentation says a retry returns the saved response, and that the
provider errors when the parameters differ. Release is included: a
compensation that is retried releases the hold once.

```text
hold    : EffectKey -> SlotId -> AsyncResult<SlotHold, HoldError>
charge  : EffectKey -> CardToken -> Money
            -> AsyncResult<Receipt, ChargeError>
issue   : EffectKey -> SlotHold -> AsyncResult<Ticket, IssueError>
release : EffectKey -> SlotHold -> AsyncResult<Released, ReleaseError>
refund  : EffectKey -> Receipt -> AsyncResult<Refunded, RefundError>
```

The shell turns each `Instruction` into a call, naming the operation:
`Charge c` becomes `charge (effectKey c.key "charge") c.card c.amount`,
and `Refund c` becomes `refund (effectKey c.key "refund") c.receipt`.
The payment provider supports an idempotency key, so `charge` passes its
key straight through. The slot service does not, so `hold` and `release`
use a unique constraint on the effect key and return the existing result
when the insert conflicts. See
[idempotency-and-delivery.md](idempotency-and-delivery.md).

## Step 5: the shell loop

An inbound message carries its own identifier, so the shell can tell a
delivery it has seen from one it has not. De-duplication on receipt is
the shell's job and `advance` knows nothing of it: the event's
identifier is recorded in the same transaction as the new state.

```text
type Inbound = { id: EventId, key: CommandId, event: ProcessEvent }
type Saved = Recorded | AlreadySeen

alias LoadProcess = CommandId -> AsyncResult<BookingProcess, StoreError>
alias SaveProcess =
  EventId -> BookingProcess -> List<Instruction>
    -> AsyncResult<Saved, StoreError>
-- one transaction: the state, the outbox rows, and the event id; a
-- unique constraint on the event id yields AlreadySeen on a repeat

handle :
  Instant -> LoadProcess -> SaveProcess -> Inbound
    -> AsyncResult<Saved, StoreError>
handle now load save inbound =
  load inbound.key
    |> map (\process -> advance now process inbound.event)
    |> bind (\(process', instructions) ->
         save inbound.id process' instructions)
```

The order matters and is the whole reliability argument: **persist the
new state and the instructions together, then dispatch from the
outbox.** If the process dies after saving, the instructions are still
there. If it dies after dispatching but before marking, the instruction
is sent twice, which step 4 made safe. A duplicate event computes a
decision that `save` discards when it answers `AlreadySeen`, which
costs nothing because `advance` performed nothing.

## Step 6: bound everything

The figures below are placeholders for the business to confirm, not
defaults to keep.

| Bound                 | Placeholder and reason         |
| --------------------- | ------------------------------ |
| Hold expiry           | 2 min, from the slot service   |
| Charge attempts       | 3, jittered, total budget 20 s |
| Issue attempts        | 5; failure here is expensive   |
| Compensation attempts | 10 over an hour, then `Stuck`  |
| Process lifetime      | 24 h, then `Stuck`             |

Every one of these is a business decision, so each is a value in one
config type and named in the domain's words, not a constant inside a
retry helper. Without an answer, use the figure already in the code or
the provider's documentation, and record in the config type that the
value is an assumption; [working-alone.md][wa] says how to ask and what
to hand back. See
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
[functional-designing-what-to-observe](../../functional-designing-what-to-observe/SKILL.md).

## What this bought

| Decision                      | What it prevented                |
| ----------------------------- | -------------------------------- |
| Client-supplied command key   | A retry becoming a second charge |
| One state per achievement     | "Charged" with no receipt        |
| Timeout as an ordinary event  | Bookings reserved for ever       |
| State and instructions, once  | A charge with no follow-up       |
| A key for each effect         | A refund answered as the charge  |
| Idempotent adapters           | Duplicate holds and charges      |
| Reverse-order compensation    | A released slot still charged    |
| An explicit `Stuck` state     | Silent give-up after money moved |
| Bounds named in the domain    | Constants nobody could find      |

## Testing it

`advance` is tested as a table: every state crossed with every event,
asserting the resulting state and the emitted instructions. A few dozen
cases, all pure, all fast, and the table doubles as the specification.
A missing timeout clause shows up as an empty cell.

The shell needs four tests: state is persisted before instructions
dispatch, a restart resumes from stored state, a second delivery of the
same event id leaves the stored state and the outbox as they were, and a
failing compensation eventually reaches `Stuck`.

No test in either group needs a real payment provider.

[wa]: ../../functional-design/references/working-alone.md
