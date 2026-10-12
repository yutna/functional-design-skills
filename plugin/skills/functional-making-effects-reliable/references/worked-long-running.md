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

Three effects, of which only the hold goes away by itself, and a network
between each pair. No transaction spans them, so the answer is an
explicit process with explicit undo.

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
what it is. Two undos are the same when they are the same case and name
the same hold or the same receipt, so compare the identifiers and not
every field. A refused undo stops the process in `Stuck` until a person
has settled that one undo and said which, and the rest then carry on. A
person may also settle the undo in hand while the process is still
`Undoing`, after a wait on it has run out, and that report moves the
process on in the same way:

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

advance now (Undoing u) (SettledByHand undo) =
  if undo == u.current
    then undoAll u.key u.because u.later
    else (Undoing u, [])

advance now (Stuck s) (SettledByHand undo) =
  if undo == s.refused
    then undoAll s.key s.because s.later
    else (Stuck s, [])
```

A wait that runs out is an ordinary event, and every state that waits on
another system has a clause for it:

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
  are an answer the process is not waiting for, whether it came twice,
  came late or was never asked for; a `Timeout` for a wait the process
  is not in; and `SettledByHand` for an undo that is not the one in
  hand. Dropping such an answer loses nothing while each effect has one
  key and one outcome, as step 4 arranges: a success the process is not
  waiting for can only be a second copy of one it has handled, or the
  hold that the point above leaves to lapse. Writing the pairs out, with
  no default clause, keeps a forgotten pair from hiding.

The core answers two more questions for the shell, so that the shell
holds no rule about states or waits: whether the process still wants an
instruction that is waiting to be performed, and which wait an
instruction starts.

```text
wants : BookingProcess -> Instruction -> Boolean
wants (Started s) (HoldSlot h) = true
wants (Reserved r) (TakePayment p) = true
wants (Charged c) (IssueTicket i) = true
wants (Undoing u) (Compensate c) = c.undo == u.current
wants (Reserved r) (Escalate e) = e.wait == ForCharge
wants (Charged c) (Escalate e) = e.wait == ForTicket
wants (Undoing u) (Escalate e) = e.wait == ForUndo u.current

waitOf : Instruction -> Option<Wait>
waitOf (HoldSlot h) = Some ForHold
waitOf (TakePayment p) = Some ForCharge
waitOf (IssueTicket i) = Some ForTicket
waitOf (Compensate c) = Some (ForUndo c.undo)
waitOf (Escalate e) = None
```

The clauses of `wants` shown are the pairs that are true. Every other
pair is written out as false, with no default clause, so that an
instruction added later cannot go unperformed because nobody listed it.
A page is wanted only while the process is still in the wait it is
about.

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
operation. `HoldSlot h` becomes a call of `hold` under
`effectKey h.key "hold"`, `TakePayment p` a call of `charge` under
`effectKey p.key "charge"`, and `IssueTicket i` a call of `issue` under
`effectKey i.key "issue"`. `Compensate c` becomes a call of `release`
under `effectKey c.key "release"` when `c.undo` is a `ReleaseHold`, and
of `refund` under `effectKey c.key "refund"` when it is a
`RefundCharge`. `Escalate` pages a person. It is done once the page is
sent: nothing answers it, so nothing waits on it and it has no bound.
Sent twice, it pages twice and harms nothing, and one that cannot be
sent is offered again for as long as the process wants it.

What comes back becomes a `ProcessEvent` only when it is definite:
`Ok receipt` is delivered as `ChargeSucceeded receipt`, and
`Error (Refused decline)` as `ChargeFailed decline`. The hold and the
ticket go the same way. For `Compensate c`, `Ok` is delivered as
`UndoSucceeded c.undo`, and `Error (Refused why)` as
`UndoFailed { undo: c.undo, why }`. `Unknown` is none of these, and step
5 says what happens to it. Every call has a timeout of its own, as
[retries-and-backpressure.md](retries-and-backpressure.md) requires, and
a call that runs into it is an `Unknown`.

The payment provider and the ticket system support an idempotency key,
so `charge`, `refund` and `issue` pass theirs straight through. The slot
service does not, so `hold` and `release` keep a record of their own:
the effect key and the outcome, written once the service has answered
and read before it is asked. That is the third and weakest of the ways
in
[idempotency-and-delivery.md](idempotency-and-delivery.md#idempotent-adapters),
because a crash between the answer and the record lets a repeat reach
the service again. The adapter makes what the service says then
harmless. A release of a hold that is already gone, released or lapsed,
is `Ok Released`: what the undo was for has happened. A second hold may
be refused because the first still stands. That booking ends `Abandoned`
over a slot it was holding, and the hold lapses. Nothing is charged, and
against a service with no key an adapter cannot do better.

## Step 5: the shell loop

Two handlers, one for the command and one for everything that arrives
afterwards. Each inbound message carries its own identifier, so the
shell can tell a delivery it has seen from one it has not.
De-duplication on receipt is the shell's job and `advance` knows nothing
of it: the identifier is recorded in the same transaction as the new
state.

```text
type Inbound = { id: EventId, key: CommandId, event: ProcessEvent }
type Saved = Recorded | AlreadySeen | Stale
type InboundFailure =
  | NoSuchProcess of CommandId
  | Unavailable of StoreError

-- one transaction, under the key the process holds: the process and its
-- outbox rows. A repeat of the command is AlreadySeen
alias CreateProcess =
  BookingProcess -> List<Instruction> -> AsyncResult<Saved, StoreError>
alias LoadProcess =
  CommandId
    -> AsyncResult<Option<Versioned<BookingProcess>>, StoreError>
-- one transaction: the state, the outbox rows, and the event id. A
-- unique constraint on the event id yields AlreadySeen on a repeat, and
-- a version that is no longer the stored one yields Stale
alias SaveProcess =
  EventId -> Versioned<BookingProcess> -> List<Instruction>
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
    |> bind (\found ->
         advance now found.value inbound.event
           |> (\(advanced, instructions) ->
                save inbound.id { ...found, value: advanced } instructions)
           |> mapError Unavailable)
```

`Versioned<T>` pairs a value with the version it was read at, and
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md)
declares it.

The order matters and is the whole reliability argument: **persist the
new state and the instructions together, then dispatch from the
outbox.** If the process dies after saving, the instructions are still
there. If it dies after dispatching but before marking, the instruction
is sent twice, which step 4 made safe. A duplicate event computes a
decision that `save` discards when it answers `AlreadySeen`, which
costs nothing because `advance` performed nothing.

**Two workers on one process.** Events for one process are best handled
one at a time, partitioned by the command's key as
[Ordering](idempotency-and-delivery.md#ordering) describes, and a job
queue does not promise that by itself. So nothing here relies on it. The
save writes only when the stored version is still the one that was
loaded. `Stale` means another event got in between: nothing was written,
and whoever delivered the event, the worker or the tool a person acts
through, hands it to `handleInbound` again, which loads afresh. It is
the conflict that a versioned save reports in
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md),
kept among the answers here because the reply to it is to try again.

Instructions need no such guard. Two workers that offer one instruction
make two calls under one key. For the charge, the refund and the ticket,
step 4 made that one effect, and their two answers are one event. For
the hold and the release it is the repeat that step 4 describes, and it
ends as that one does.

**Dispatching.** An outbox row holds the instruction, the time it was
saved, how often it has been offered, when it is next due, and whether
it is waiting, done or a dead letter. The worker takes an instruction
from the outbox, loads the process, and asks `wants`. What the process
no longer wants is marked done without a call: a charge still queued
when a person has entered the provider's answer, or a dead letter
replayed too late. Otherwise the worker calls the adapter, and a
definite answer goes to `handleInbound` as an event. The instruction is
marked done once that answer has come back `Recorded` or `AlreadySeen`.
If it comes back `Unavailable`, the instruction stays to be offered
again, and the adapter answers the repeat from its key, so the answer is
not lost.

After an `Unknown` the worker does not wait. It puts the instruction
back in the outbox with the time of its next offer, spaced as
[Backoff and jitter](retries-and-backpressure.md#backoff-and-jitter)
sets out, and goes on to whatever else is due. Every offer starts with
`wants` again, and then with the clock. `waitOf` names the wait, step 6
gives its bound, and the bound runs from the time the instruction was
saved, which the row holds, so it survives a restart. An offer that
finds the bound passed makes no call: the worker keeps the instruction
as a dead letter and delivers the `Timeout` of that wait. An `Escalate`
starts no wait, so it has no bound to check, and is offered until it is
sent or no longer wanted.

A dead letter stays until a person acts on it. A replay is one more
offer under the same key, made without the check against the clock: it
gets its answer, or `wants` marks it done. It is safe only while the
provider still holds that key, and a key has a lifetime, as
[Command identity](idempotency-and-delivery.md#command-identity) says.
Past it, the person reads the outcome off the provider's own records and
enters that as the event. A person who has entered an outcome replays
the dead letter afterwards as well: the process no longer wants it, so
`wants` marks it done and the gauge in step 7 goes back to zero.

`wants` stops a call that has not been made. One that is already on its
way cannot be recalled, which is why a person enters a refusal only from
the provider's own record of it, and not from the lack of an answer. For
the same reason a person settles an undo by hand only when its
instruction is a dead letter or the process is `Stuck`: in both, nothing
is offering it any more.

This worker is the relay of
[idempotency-and-delivery.md](idempotency-and-delivery.md) with adapter
calls where that one publishes: the outbox there holds events to
publish, and here it holds instructions to perform. With a job queue as
the outbox, the instruction is a job, and the queue's count of attempts
must not end the offers before the clock does, so set the job's limit on
attempts high enough that it is never the one to end them. The offer
that finds the bound passed delivers the `Timeout` and tells the queue
to stop retrying and keep the job. A replay carries a mark that says it
is one, so that its offer skips the clock. In Oban, stopping is
`{:cancel, reason}` returned from `perform/1`, which leaves the job
`cancelled`. Oban's pruner deletes cancelled and discarded jobs by age,
after sixty seconds unless it is given a `max_age`, so set that past the
longest a dead letter may wait for a person.

**Identifiers.** The worker derives an event's identifier from the
outbox row the event is about and from which case of `ProcessEvent` it
is. An answer delivered twice is therefore one event, and so is the
answer to a dead letter replayed after the first answer arrived. An
event that a person enters, an answer read off the provider's own
records or a `SettledByHand`, gets its identifier once, from the tool
the person acts through. That tool shows the state of the process after
the entry, so a report that changed nothing, such as one for an undo
that is not the one in hand, is seen to have changed nothing.

**What the caller sees.** `handleBookingRequest` answers that the
request was taken, not that the booking exists. The patient's screen
reads the process by its key: `Issued` shows the ticket, `Abandoned`
the reason, and any other state that the booking is still in hand.

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
helper. The timeout of one call and the two figures of the backoff sit
in that type as well. Without an answer, use the figure already in the
code or the provider's documentation, and record in the config type that
the value is an assumption; [working-alone.md][wa] says how to ask and
what to hand back. See
[retries-and-backpressure.md](retries-and-backpressure.md).

## Step 7: make it visible

The process states, the escalations and the dead letters are already the
metric. The shell counts a state when a save has moved the process into
it, and an escalation when its page has been sent. The two gauges are
read from the store.

```text
count "booking.issued"
count "booking.abandoned" { because: failureLabel because }
count "booking.escalated" { wait: waitLabel wait }
gauge "booking.dead_letters"                -- alerts at > 0
gauge "booking.stuck"                       -- alerts at > 0
time "booking.total"              -- from the request to its last state
```

`because` is the field of the `Abandoned` state the process has just
moved into, and `wait` the field of the `Escalate` just performed.
`failureLabel` and `waitLabel` each map a case to a fixed string, as
`rejectionLabel` does in
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
| A save that checks a version  | Two workers overwriting a state   |
| A key for each effect         | A refund answered as the charge   |
| Idempotent adapters           | Duplicate charges and refunds     |
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
table, filled in the same way.

The shell's tests are few. A repeat of the command starts one process.
State is persisted before instructions dispatch. A restart resumes from
stored state. A second delivery of the same event id leaves the stored
state and the outbox as they were. A save against a version that has
moved writes nothing, and the event is handled again. An instruction the
process no longer wants is dropped without a call, a replayed dead
letter among them. An instruction whose answer stays unknown is offered
again under the same key, and ends as a dead letter and a `Timeout`.

No test in either group needs a real payment provider.

[wa]: ../../functional-design/references/working-alone.md
