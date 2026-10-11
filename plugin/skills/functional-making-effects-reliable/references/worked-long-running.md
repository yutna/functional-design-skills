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
type BookingRequest = {
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
  | Started of { request: BookingRequest }
  | Reserved of { request: BookingRequest, hold: SlotHold }
  | Charged of { key: CommandId, hold: SlotHold, receipt: Receipt }
  | Issued of { key: CommandId, ticket: Ticket, receipt: Receipt }
  | Undoing of { key: CommandId, current: Undo, later: List<Undo>,
                 because: ProcessFailure }
  | Abandoned of { key: CommandId, because: ProcessFailure }
  | Stuck of { key: CommandId, refused: Undo, why: UndoRefusal,
               later: List<Undo>, because: ProcessFailure }

type SlotHold = { id: HoldId, expires: Instant }
type Undo = ReleaseHold of SlotHold | RefundCharge of Receipt

type ProcessFailure =
  | SlotRefused of HoldRefusal
  | HoldUnanswered
  | PaymentDeclined of Decline
  | HoldExpired
  | IssuingFailed of IssueRefusal
```

`Issued` and `Abandoned` are the two ways the process ends: the booking
exists, or nothing it did is left standing. `Stuck` is the state people
forget. An undo can be refused, and then a person has to act. The state
holds the undo that was refused, why, and the undos not yet tried. A
process with no such state either loops for ever or silently gives up.

## Step 3: the transition function

Pure, total, and the entire design. What reaches the process from other
systems, from deadlines and from people is a `ProcessEvent`;
`BookingEvent` stays the name for what a workflow decides. What the core
hands the shell to perform is a list of instructions.

```text
type ProcessEvent =
  | HoldSucceeded of SlotHold
  | HoldFailed of HoldRefusal
  | ChargeSucceeded of Receipt
  | ChargeFailed of Decline
  | IssueSucceeded of Ticket
  | IssueFailed of IssueRefusal
  | UndoSucceeded of Undo
  | UndoFailed of { undo: Undo, why: UndoRefusal }
  | Timeout of Wait
  | SettledByHand of Undo

type Wait = ForHold | ForCharge | ForTicket | ForUndo of Undo

type Instruction =
  | HoldSlot of { key: CommandId, slot: SlotId }
  | TakePayment of { key: CommandId, card: CardToken, amount: Money }
  | IssueTicket of { key: CommandId, hold: SlotHold }
  | Compensate of { key: CommandId, undo: Undo }
  | Escalate of { key: CommandId, wait: Wait }
```

```text
start : BookingRequest -> (BookingProcess, List<Instruction>)
advance :
  Instant -> BookingProcess -> ProcessEvent
    -> (BookingProcess, List<Instruction>)
```

The clauses that move the process forward, and the ones that turn it
back:

```text
start request =
  (Started { request },
   [HoldSlot { key: request.key, slot: request.slot }])

advance now (Started s) (HoldSucceeded hold) =
  (Reserved { request: s.request, hold },
   [TakePayment { key: s.request.key, card: s.request.card,
                  amount: s.request.amount }])

advance now (Started s) (HoldFailed refusal) =
  (Abandoned { key: s.request.key, because: SlotRefused refusal }, [])

advance now (Reserved r) (ChargeSucceeded receipt) =
  if now < r.hold.expires
    then (Charged { key: r.request.key, hold: r.hold, receipt },
          [IssueTicket { key: r.request.key, hold: r.hold }])
    else undoAll r.request.key HoldExpired [RefundCharge receipt]

advance now (Reserved r) (ChargeFailed decline) =
  undoAll r.request.key (PaymentDeclined decline) [ReleaseHold r.hold]

advance now (Charged c) (IssueSucceeded ticket) =
  (Issued { key: c.key, ticket, receipt: c.receipt }, [])

advance now (Charged c) (IssueFailed refusal) =
  undoAll c.key (IssuingFailed refusal)
    [RefundCharge c.receipt, ReleaseHold c.hold]
```

Undoing is a list worked through one step at a time. An event about an
undo names the undo, so one that arrives twice, or late, is seen for
what it is. A refused undo stops the process in `Stuck` until a person
has settled that one undo and said which, and the rest then carry on:

```text
undoAll :
  CommandId -> ProcessFailure -> List<Undo>
    -> (BookingProcess, List<Instruction>)
undoAll key because [] = (Abandoned { key, because }, [])
undoAll key because (first :: later) =
  (Undoing { key, current: first, later, because },
   [Compensate { key, undo: first }])

advance now (Undoing u) (UndoSucceeded undo) =
  if undo == u.current
    then undoAll u.key u.because u.later
    else (Undoing u, [])

advance now (Undoing u) (UndoFailed f) =
  if f.undo == u.current
    then (Stuck { key: u.key, refused: u.current, why: f.why,
                  later: u.later, because: u.because }, [])
    else (Undoing u, [])

advance now (Stuck s) (SettledByHand undo) =
  if undo == s.refused
    then undoAll s.key s.because s.later
    else (Stuck s, [])
```

A wait that runs out is an ordinary event, and every waiting state has a
clause for it:

```text
advance now (Started s) (Timeout ForHold) =
  (Abandoned { key: s.request.key, because: HoldUnanswered }, [])

advance now (Reserved r) (Timeout ForCharge) =
  (Reserved r, [Escalate { key: r.request.key, wait: ForCharge }])

advance now (Charged c) (Timeout ForTicket) =
  (Charged c, [Escalate { key: c.key, wait: ForTicket }])

advance now (Undoing u) (Timeout (ForUndo undo)) =
  if undo == u.current
    then (Undoing u, [Escalate { key: u.key, wait: ForUndo undo }])
    else (Undoing u, [])
```

What to notice:

- **Compensation runs in reverse order**, refund before release.
- **A late success is not a success.** A charge that lands after the
  hold has lapsed is refunded, not ticketed. That comparison is why
  `advance` takes the time.
- **A wait that runs out does not say the step failed.** The answer may
  be lost and the effect done. So the clause neither undoes on a guess
  nor forgets the wait: the state stays where a late answer will find
  it, and a person is told. A charge that turns out to have landed is
  then handled by the clause that always handled it. The hold is the
  exception. One that was made and never reported lapses by itself, so
  the process can end.
- **The clauses shown are not the whole function.** `advance` is total:
  it has a clause for every other pair of state and event too, each
  written out as the state unchanged with no instructions. Those pairs
  are an answer that arrives twice or late, a `Timeout` for a wait the
  process has left, an answer for a process that is stuck, and
  `SettledByHand` for one that is not. Writing them out, with no default
  clause, keeps a forgotten pair from hiding.

The core answers one more question for the shell, so that the shell
holds no rule about states: whether the process still wants an
instruction that is waiting to be performed.

```text
wants : BookingProcess -> Instruction -> Boolean
wants (Started s) (HoldSlot h) = true
wants (Reserved r) (TakePayment p) = true
wants (Charged c) (IssueTicket i) = true
wants (Undoing u) (Compensate c) = c.undo == u.current
wants process (Escalate e) = true
wants process instruction = false
```

The clauses are read from the top, and here the last one is a default on
purpose: an instruction that nobody has listed above it is not
performed.

## Step 4: make every effect idempotent

Every instruction may be performed more than once. Each adapter takes an
effect key and returns the original outcome on a repeat. The key is
derived from the command's key and the name of the operation with
`effectKey` from [SKILL.md](../SKILL.md#pattern), so the charge and the
refund of one booking never share a key. A payment provider that honours
idempotency keys treats a reused key as a replay of the first request:
Stripe's API, for one, returns the saved response to a repeat and
rejects a key reused with different parameters. Release is included: a
compensation that is retried releases the hold once.

```text
-- an adapter fails in one of two ways, and the type keeps them apart
type EffectError<Refusal> = Refused of Refusal | Unknown of Fault

alias HoldError = EffectError<HoldRefusal>
alias ChargeError = EffectError<Decline>
alias IssueError = EffectError<IssueRefusal>
alias ReleaseError = EffectError<UndoRefusal>
alias RefundError = EffectError<UndoRefusal>

hold    : EffectKey -> SlotId -> AsyncResult<SlotHold, HoldError>
charge  : EffectKey -> CardToken -> Money
            -> AsyncResult<Receipt, ChargeError>
issue   : EffectKey -> SlotHold -> AsyncResult<Ticket, IssueError>
release : EffectKey -> SlotHold -> AsyncResult<Released, ReleaseError>
refund  : EffectKey -> Receipt -> AsyncResult<Refunded, RefundError>
```

Each `Instruction` becomes one call, under a key that names the
operation. `TakePayment p` becomes a call of `charge` under
`effectKey p.key "charge"`. `Compensate c` becomes a call of `release`
under `effectKey c.key "release"` when `c.undo` is a `ReleaseHold`, and
of `refund` under `effectKey c.key "refund"` when it is a
`RefundCharge`. `Escalate` pages a person. It is done once the page is
sent: nothing answers it, so nothing waits on it and it has no bound.
Sent twice, it pages twice and harms nothing.

What comes back becomes a `ProcessEvent` only when it is definite:
`Ok receipt` is delivered as `ChargeSucceeded receipt`, and
`Error (Refused decline)` as `ChargeFailed decline`. `Unknown` is
neither, and step 5 says what happens to it.

The payment provider supports an idempotency key, so `charge` and
`refund` pass theirs straight through. The slot service does not, so
`hold` and `release` record the effect key under a unique constraint and
return the first result when the insert conflicts. See
[idempotency-and-delivery.md](idempotency-and-delivery.md).

## Step 5: the shell loop

Two handlers, one for the command and one for everything that arrives
afterwards. Each inbound message carries its own identifier, so the
shell can tell a delivery it has seen from one it has not.
De-duplication on receipt is the shell's job and `advance` knows nothing
of it: the identifier is recorded in the same transaction as the new
state.

```text
type Inbound = { id: EventId, key: CommandId, event: ProcessEvent }
type Saved = Recorded | AlreadySeen
type InboundFailure =
  | NoSuchProcess of CommandId
  | Unavailable of StoreError

-- inserts under the command's key: a repeat of the command is AlreadySeen
alias CreateProcess =
  BookingProcess -> List<Instruction> -> AsyncResult<Saved, StoreError>
alias LoadProcess =
  CommandId -> AsyncResult<Option<BookingProcess>, StoreError>
-- one transaction: the state, the outbox rows, and the event id; a
-- unique constraint on the event id yields AlreadySeen on a repeat
alias SaveProcess =
  EventId -> BookingProcess -> List<Instruction>
    -> AsyncResult<Saved, StoreError>

handleBookingRequest :
  CreateProcess -> BookingRequest -> AsyncResult<Saved, StoreError>
handleBookingRequest create request =
  start request
    |> (\(process, instructions) -> create process instructions)

handleInbound :
  LoadProcess -> SaveProcess -> Instant -> Inbound
    -> AsyncResult<Saved, InboundFailure>
handleInbound load save now inbound =
  load inbound.key
    |> mapError Unavailable
    |> bind (toResult (NoSuchProcess inbound.key))
    |> map (\process -> advance now process inbound.event)
    |> bind (\(advanced, instructions) ->
         save inbound.id advanced instructions
           |> mapError Unavailable)
```

The order matters and is the whole reliability argument: **persist the
new state and the instructions together, then dispatch from the
outbox.** If the process dies after saving, the instructions are still
there. If it dies after dispatching but before marking, the instruction
is sent twice, which step 4 made safe. A duplicate event computes a
decision that `save` discards when it answers `AlreadySeen`, which
costs nothing because `advance` performed nothing.

**One worker for each process.** Events for one process are handled one
at a time, and its instructions are performed by the same worker,
between events. Partition by the command's key, as
[Ordering](idempotency-and-delivery.md#ordering) describes. Nothing can
then change a process between a question about it and the call that
follows.

**Dispatching.** The worker takes an instruction from the outbox, loads
the process, and asks `wants`. What the process no longer wants is
marked done without a call: a charge still queued when a person has
entered the provider's answer, or a dead letter replayed too late.
Otherwise the worker calls the adapter, and a definite answer goes to
`handleInbound` as an event.

After an `Unknown` the worker does not wait. It puts the instruction
back in the outbox with the time of its next offer, spaced as
[Backoff and jitter](retries-and-backpressure.md#backoff-and-jitter)
sets out, and goes on to whatever is next for that process. Every offer
starts with `wants` again. The offers stop when the bound of that wait
in step 6 has passed since the instruction was saved; the outbox row
holds that time, so the bound survives a restart. The instruction is
then kept as a dead letter, and the worker delivers the `Timeout` of
that wait. A dead letter stays until a person replays it, and a replay
is one more offer: it gets its answer, or `wants` marks it done.

`wants` stops a call that has not been made. One that is already on its
way cannot be recalled, which is why a person enters a refusal only from
the provider's own record of it, and not from the lack of an answer.

This worker is the relay of
[idempotency-and-delivery.md](idempotency-and-delivery.md) with adapter
calls where that one publishes: the outbox there holds events to
publish, and here it holds instructions to perform. With a job queue as
the outbox, the instruction is a job. Set the queue's limit on attempts
and its backoff so that the last attempt falls at the bound; that
attempt delivers the `Timeout` and then fails, and the queue keeps the
job. Oban hands the worker the job's `attempt` and `max_attempts`, and
keeps a job that has used them all as `discarded`, which serves as the
dead letter.

**Identifiers.** The worker derives an event's identifier from the
outbox row the event is about and from the kind of event. An answer
delivered twice is therefore one event, and so is the answer to a dead
letter replayed after the first answer arrived. An event that a person
enters, an answer read off the provider's own records or a
`SettledByHand`, gets its identifier once, from the tool the person acts
through.

## Step 6: bound everything

Each bound is how long an instruction of that wait goes on being
offered. The figures are placeholders for the business to confirm, not
defaults to keep.

| Wait        | Placeholder and reason                         |
| ----------- | ---------------------------------------------- |
| `ForHold`   | 10 s; the patient is waiting at a screen       |
| `ForCharge` | 2 min; a hold seldom lasts longer              |
| `ForTicket` | 10 min; a charge is standing all that time     |
| `ForUndo`   | 1 h for each undo; money or a slot is standing |

How long a hold really lasts is not ours to set. The slot service says,
inside each `SlotHold`, and `advance` reads it there.

Every bound is a business decision, so each is a value in one config
type and named in the domain's words, not a constant inside a retry
helper. Without an answer, use the figure already in the code or the
provider's documentation, and record in the config type that the value
is an assumption; [working-alone.md][wa] says how to ask and what to
hand back. See
[retries-and-backpressure.md](retries-and-backpressure.md).

## Step 7: make it visible

The process states, the escalations and the dead letters are already the
metric. The shell counts from what it has just saved or performed.

```text
count "booking.issued"
count "booking.abandoned" { because: failureLabel because }
count "booking.escalated" { wait: waitLabel wait }
gauge "booking.dead_letters"                -- alerts at > 0
gauge "booking.stuck"                       -- alerts at > 0
time "booking.total"
```

`because` is the field of the `Abandoned` state just saved, and `wait`
the field of the `Escalate` just performed. `failureLabel` and
`waitLabel` each map a case to a fixed string, as `rejectionLabel` does
in
[signals-and-events.md](../../functional-designing-what-to-observe/references/signals-and-events.md).

A dead letter and a stuck process each mean an effect is standing, or
may be, that the process will not settle by itself. An `Escalate` pages
once; the two gauges stay above zero until a person has acted, so a page
that was dismissed is not the end of it. Everything else is a dashboard.
See
[functional-designing-what-to-observe](../../functional-designing-what-to-observe/SKILL.md).

## What this bought

| Decision                      | What it prevented                 |
| ----------------------------- | --------------------------------- |
| Client-supplied command key   | A retry becoming a second booking |
| One state per achievement     | "Charged" with no receipt         |
| A deadline as an event        | A process waiting unseen for ever |
| No undo on a guess            | Releasing a slot already paid for |
| State and instructions, once  | A charge with no follow-up        |
| A key for each effect         | A refund answered as the charge   |
| Idempotent adapters           | Duplicate holds and charges       |
| Asking `wants` before a call  | A call that nobody wants any more |
| Reverse-order compensation    | A released slot still charged     |
| An explicit `Stuck` state     | Silent give-up after money moved  |
| Bounds named in the domain    | Constants nobody could find       |

## Testing it

`advance` is tested as a table with a cell for every pair of state and
event, each asserting the resulting state and the emitted instructions.
Fill the table in before writing the clauses: a pair nobody has decided
is then an empty cell, and not a default. Every cell is pure and fast,
and the table doubles as the specification. `wants` is a second, smaller
table.

The shell's tests are few. A repeat of the command starts one process.
State is persisted before instructions dispatch. A restart resumes from
stored state. A second delivery of the same event id leaves the stored
state and the outbox as they were. An instruction the process no longer
wants is dropped without a call. An instruction whose answer stays
unknown is offered again under the same key, and ends as a dead letter
and a `Timeout`.

No test in either group needs a real payment provider.

[wa]: ../../functional-design/references/working-alone.md
