---
name: functional-making-effects-reliable
description: Use when a timeout leaves an effect unsure, when a retry could charge twice, when a saved change is published separately, or when spawned background work outlives its request.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.1
---

# Making Effects Reliable

## Overview

A pure core is safe to run twice. An effect is not: a charge that runs
twice is two charges, and a call that times out may have succeeded. Once
a workflow reaches a second system, the failure modes stop being about
correctness of logic and start being about delivery, duplication, and
partial completion.

The rules below all follow from one idea: keep the decision pure, so
that deciding again does nothing, and make each effect separately
identifiable, so that repeating it is safe and losing it is detectable.

## When to use

- A workflow calls a payment provider, a queue, or another service
- An operation must not happen twice, and retries exist
- A timeout leaves you unsure whether the effect happened
- Events must reach a consumer, and the database write must also happen
- Deciding where retries, timeouts, and compensation live
- A process spans minutes or days and can fail halfway

Not for: choosing transaction boundaries, which is
[functional-enforcing-consistency-boundaries](../functional-enforcing-consistency-boundaries/SKILL.md).
This skill and
[functional-managing-state-immutably](../functional-managing-state-immutably/SKILL.md)
meet at work that outlives its request: rule 8 states what it needs, and
that skill covers the in-process case in full.

## Core rules

1. Rule. **Give every command whose effects cross a process boundary an
   identity.** A client-supplied key, carried through the workflow, is
   what makes de-duplication possible at all. A command whose whole
   effect is one transaction in one database is outside this rule: where
   a repeat of it would matter, a unique constraint in that transaction
   is enough.
2. Rule. **Make the effect idempotent, not the decision.** The pure core is
   already safe to repeat; the write, the charge, and the send are not.
   Idempotency belongs in the adapter.
3. Rule. **Assume at-least-once, everywhere.** Exactly-once delivery does not
   exist across a network. De-duplicate on receipt instead.
4. Rule. **Never write and publish in two places.** Either the event is recorded
   in the same transaction as the state change and relayed afterwards, or a
   consumer will eventually see one without the other. A notice that carries
   nothing a consumer keeps, such as a hint to a screen to read again, is
   outside this rule: losing it loses nothing that is stored.
5. Default. **Retry at the shell, bounded.** A domain step that retries hides
   latency and cannot be tested in time. Bound attempts, bound total time, and
   add jitter. Retry only a transient fault, and only a read or a write that is
   idempotent on its key. A call that has to outlive its request is not retried
   in place: it is an instruction in an outbox, and the queue retries it.
6. Default. **Compensate; do not lock across systems.** A distributed
   transaction is a lock held over a network. Undo explicitly instead, and
   accept that the undo is a business operation with a business name. This is
   for steps that span systems: steps in one database are one transaction, and
   [compensating-workflows.md](references/compensating-workflows.md) lists the
   other answers that cost less than a process manager.
7. Default. **Model partial success explicitly.** "Three of five sent" is not a
   `Result`. It is a report type with both lists inside it. This is for
   independent items, each of which has taken effect by itself. The steps of one
   process that must all happen or all be undone belong to rule 6, and are
   compensated.
8. Rule. **Work that outlives its command has an owner or a cancel.**
   Something started in the background either has a caller that waits
   for it or a handle that stops it. Work with neither cannot be
   drained at shutdown, cannot be stopped when the request that wanted
   it has gone, and its failures arrive with nothing to attach them to.
   See
   [concurrency.md](../functional-managing-state-immutably/references/concurrency.md).

## Pattern

Unreliable: three effects, three failure points, no identity.

```text
-- one error type, StepError, all the way along
bookPaidAppointment request =
  charge request.card request.amount   -- may time out after succeeding
    |> bind (saveBooking request)      -- may fail after the charge
    |> bind publishBookingConfirmed    -- may be lost entirely
```

A timeout on `charge` leaves nobody knowing whether money moved. A
process that dies between `saveBooking` and `publishBookingConfirmed`
loses the event silently, and a retry of the whole workflow charges
again.

Reliable: an identity, an idempotent adapter for each effect, and one
transaction.

```text
type CommandId = CommandId of String
type BookingRequest = { key: CommandId, ... }   -- supplied by the caller

-- each effect gets a key of its own, derived from the command's key
type EffectKey = EffectKey of String
effectKey : CommandId -> String -> EffectKey
effectKey (CommandId key) operation = EffectKey (join ":" [operation, key])

-- every adapter takes its effect key and is idempotent on it
charge :
  EffectKey -> CardToken -> Money -> AsyncResult<Receipt, ChargeError>

-- state and outbox rows written together, relayed afterwards; the key
-- is the unique key of the outbox rows
saveBookingAndEvents :
  EffectKey -> Booking -> List<BookingEvent>
    -> AsyncResult<Unit, StoreError>
```

The shell calls `effectKey key "charge"` for the charge and
`effectKey key "save"` for the save. One key shared by every effect is
wrong: a provider that honours idempotency keys treats a second call
with the same key as a replay of the first, and answers it with the
first call's result or an error. A refund must not come back as the
charge's receipt.

Retrying the workflow with the same `key` is now safe: the charge
returns the original receipt, the save is a no-op, and the event is
relayed again as often as the relay fails before marking it sent, which
the consumer de-duplicates.

## Delivery guarantees

| Guarantee     | What it costs                           |
| ------------- | --------------------------------------- |
| At most once  | Silent loss; only for data you can lose |
| At least once | Duplicates; consumers must de-duplicate |
| Exactly once  | Does not exist across a network         |

What is sold as exactly-once is always at-least-once delivery plus
de-duplication somewhere. Decide where that somewhere is, and write it
down beside the consumer.

## Where each concern lives

| Concern           | Layer                                    |
| ----------------- | ---------------------------------------- |
| Command identity  | The caller, before its first attempt     |
| Idempotency       | The adapter that performs the effect     |
| Retry and timeout | The shell, bounded                       |
| De-duplication    | The consumer, on receipt                 |
| Compensation      | A named domain operation                 |
| Ordering          | One writer, or a sequence number         |
| Backpressure      | The shell, from queue depth              |

The command's key is the one identifier the shell does not generate: a
key made on the server changes on every retry. The shell performs
every effect behind that table and bounds every wait. What an outcome
leads to is decided in the core: `advance`, the transition function of
the process, says when to compensate and what follows a wait that ran
out (see
[compensating-workflows.md](references/compensating-workflows.md)). The
core stays a function from values to a decision. See
[functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md).

## Red flags

- A command with no identifier the caller controls
- A state change and a publish in two separate transactions
- Retry logic inside a domain function
- An unbounded retry loop, or retries with no jitter
- A non-idempotent operation behind a retry
- A workflow that reports success when half its effects ran
- Compensation implemented as "delete the row"
- A queue with no dead-letter destination

## Common mistakes

- **Retrying a non-idempotent effect.** The retry is the bug, not the
  network.
- **Relying on exactly-once from a broker.** It is at-least-once with
  extra steps; de-duplicate anyway.
- **Making the domain function idempotent instead of the adapter.** The
  domain is already pure; the effect is what repeats.
- **Using a distributed transaction.** It holds a lock across a network
  and fails in ways nobody can reason about. Compensate instead.
- **Compensating by deleting.** The undo is a business event with its own
  name and its own record: refunded, cancelled, released.
- **Treating partial success as failure.** Rolling back four successful
  sends because the fifth failed is usually worse than reporting both.

## Related skills

- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-enforcing-consistency-boundaries](../functional-enforcing-consistency-boundaries/SKILL.md)
- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-designing-what-to-observe](../functional-designing-what-to-observe/SKILL.md)

## Further reading

- [idempotency-and-delivery.md](references/idempotency-and-delivery.md)
  covers command identity, the outbox, the queues that can carry it, and
  de-duplication.
- [compensating-workflows.md](references/compensating-workflows.md)
  covers process managers, compensation, and when a saga is wrong.
- [retries-and-backpressure.md](references/retries-and-backpressure.md)
  covers retry budgets, circuit breaking, and load shedding.
- [worked-long-running.md](references/worked-long-running.md) builds a
  three-system booking process end to end.
