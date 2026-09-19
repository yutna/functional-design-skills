# Idempotency and Delivery

## Command identity

De-duplication is impossible without something to de-duplicate on. That
something is an identifier the **caller** controls, created before the
first attempt and reused on every retry.

```text
type BookingRequest = {
  key: CommandId,          -- created by the client, stable across retries
  customer: CustomerId,
  treatments: NonEmptyList<BookedTreatment>,
}
```

Rules:

1. **The client creates it, not the server.** A server-generated
   identifier changes on retry, which is exactly when it must not.
2. **It is stable for the intent, not the attempt.** Pressing "pay" once
   and retrying twice is one key; pressing "pay" again deliberately is a
   new one.
3. **It is carried into every effect the workflow performs**, so each
   adapter can de-duplicate independently.
4. **It has a lifetime.** Keep the record long enough to cover the
   longest retry window, and say how long in the interface.

## Idempotent adapters

The adapter, not the domain function, is what must tolerate repetition.

```text
-- first call performs the charge and records the key
-- later calls with the same key return the recorded receipt
charge : CommandId -> Card -> Money -> AsyncResult<Receipt, ChargeError>
```

Three implementations, in order of preference:

**The provider supports it.** Most payment and messaging providers accept
an idempotency key. Pass yours through; do not invent a second scheme on
top.

**A unique constraint.** Insert a row keyed by the command identifier in
the same transaction as the effect. A duplicate insert fails, and the
failure is the de-duplication.

```text
-- second attempt violates the unique index and returns the first result
insert into command_log (key, result) values (?, ?)
```

**A recorded outcome.** Write the key and the outcome after the effect
succeeds, and check it before starting. This has a window between the
effect and the record, so prefer one of the first two where possible, and
make the window small.

## Writing state and publishing events

The classic failure: the state change commits and the publish does not,
or the reverse. Two writes cannot be made atomic across two systems, so
do not try.

**The outbox.** Write the events into a table in the same transaction as
the state change, and relay them afterwards.

```text
saveBookingAndEvents :
  Booking -> List<BookingEvent> -> AsyncResult<Unit, SaveError>
-- one transaction: the booking rows and the outbox rows

relay : Unit -> AsyncResult<Relayed, RelayError>
-- separate process: read unsent, publish, mark sent
```

Properties this gives you:

- The event exists if and only if the state change happened.
- The relay can crash and restart; unsent rows are still there.
- Delivery is at-least-once, because the relay may publish and then fail
  before marking. Consumers de-duplicate.

The cost is a table, a relay process, and ordering that is per-stream
rather than global. That is the honest price of not losing events.

**When the outbox is overkill.** If losing the event is genuinely
acceptable — a cache warm-up, a nice-to-have notification — publish
directly and say in a comment that loss is tolerated. Make it a decision,
not an oversight.

## De-duplicating on receipt

A consumer that is not idempotent turns at-least-once delivery into
duplicate work.

```text
handle : EventId -> Event -> AsyncResult<Unit, HandlerError>
handle id event =
  ifNotSeen id (\_ -> process event)
```

Options for `ifNotSeen`, matching the adapter options above: a unique
constraint on the event identifier, a bounded set of recent identifiers,
or an effect that is naturally idempotent (setting a value rather than
incrementing one).

Prefer naturally idempotent handlers where the domain allows it.
`setStatus(paid)` needs no de-duplication; `addPayment(amount)` does.

## Ordering

At-least-once says nothing about booking. If a consumer needs it:

- **One writer per stream.** Partition by the entity's identifier so all
  events for one booking are handled in sequence.
- **A sequence number per stream.** The consumer ignores anything it has
  already passed, and requests a replay if it sees a gap.
- **Or make handlers booking-independent**, which is usually cheaper.
  A handler that folds an event into state by identity does not care.

## Dead letters

An event that fails repeatedly must go somewhere visible. A queue with
no dead-letter destination either blocks or silently drops.

- Bound the attempts, then move the message aside with its error.
- Record enough to replay it: the original payload, the error, the
  attempt count.
- Alert on the dead-letter depth, not on individual failures. See
  [designing-what-to-observe](../../designing-what-to-observe/SKILL.md).
