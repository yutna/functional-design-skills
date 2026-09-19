---
name: making-effects-reliable
description: Use when a timeout leaves an effect unsure, when a retry could charge or send twice, when a saved change is published separately, or across systems.
---

# Making Effects Reliable

## Overview

A pure core is safe to run twice. An effect is not: a charge that runs
twice is two charges, and a call that times out may have succeeded. Once
a workflow reaches a second system, the failure modes stop being about
correctness of logic and start being about delivery, duplication, and
partial completion.

The rules below all follow from one idea: keep the decision pure and
idempotent-by-nature, and make each effect separately identifiable, so
that repeating it is safe and losing it is detectable.

## When to use

- A workflow calls a payment provider, a queue, or another service
- An operation must not happen twice, and retries exist
- A timeout leaves you unsure whether the effect happened
- Events must reach a consumer, and the database write must also happen
- Deciding where retries, timeouts, and compensation live
- A process spans minutes or days and can fail halfway

Not for: in-process concurrency, which is
[managing-state-immutably](../managing-state-immutably/SKILL.md); or
choosing transaction boundaries, which is
[enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md).

## Core rules

1. **Give every command an identity.** A client-supplied key, carried
   through the workflow, is what makes de-duplication possible at all.
2. **Make the effect idempotent, not the decision.** The pure core is
   already safe to repeat; the write, the charge, and the send are not.
   Idempotency belongs in the adapter.
3. **Assume at-least-once, everywhere.** Exactly-once delivery does not
   exist across a network. De-duplicate on receipt instead.
4. **Never write and publish in two places.** Either the event is
   recorded in the same transaction as the state change and relayed
   afterwards, or a consumer will eventually see one without the other.
5. **Retry at the shell, bounded.** A domain step that retries hides
   latency and cannot be tested in time. Bound attempts, bound total
   time, and add jitter.
6. **Compensate; do not lock across systems.** A distributed transaction
   is a lock held over a network. Undo explicitly instead, and accept
   that the undo is a business operation with a business name.
7. **Model partial success explicitly.** "Three of five sent" is not a
   `Result`. It is a report type with both lists inside it.

## Pattern

Unreliable: two systems, two failure points, no identity.

```text
confirmBooking cmd =
  charge cmd.card cmd.amount       -- may time out after succeeding
    >=> saveBooking                  -- may fail after the charge
    >=> publishBookingConfirmed         -- may be lost entirely
```

A timeout on `charge` leaves nobody knowing whether money moved. A crash
between `saveBooking` and `publishBookingConfirmed` loses the event silently,
and a retry of the whole workflow charges again.

Reliable: an identity, an idempotent adapter, and one transaction.

```text
type BookingRequest = { key: CommandId, ... }   -- supplied by the caller

-- the adapter is idempotent, keyed by the command
charge : CommandId -> Card -> Money -> AsyncResult<Receipt, ChargeError>

-- state and outbox row written together, relayed afterwards
saveBookingAndEvents :
  Booking -> List<BookingEvent> -> AsyncResult<Unit, SaveError>
```

Retrying the workflow with the same `key` is now safe: the charge
returns the original receipt, the save is a no-op, and the event is
relayed at most once more, which the consumer de-duplicates.

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

| Concern           | Layer                                |
| ----------------- | ------------------------------------ |
| Command identity  | Created at the edge, carried through |
| Idempotency       | The adapter that performs the effect |
| Retry and timeout | The shell, bounded                   |
| De-duplication    | The consumer, on receipt             |
| Compensation      | A named domain operation             |
| Ordering          | One writer, or a sequence number     |
| Backpressure      | The shell, from queue depth          |

Nothing in that table belongs in the pure core, which is the point: the
core stays a function from values to a decision, and everything here is
the shell's job. See
[separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md).

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

- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)
- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [designing-what-to-observe](../designing-what-to-observe/SKILL.md)

## Further reading

- [idempotency-and-delivery.md](references/idempotency-and-delivery.md)
  covers command identity, the outbox, and de-duplication.
- [compensating-workflows.md](references/compensating-workflows.md)
  covers process managers, compensation, and when a saga is wrong.
- [retries-and-backpressure.md](references/retries-and-backpressure.md)
  covers retry budgets, circuit breaking, and load shedding.
- [worked-long-running.md](references/worked-long-running.md) builds a
  three-system booking process end to end.
