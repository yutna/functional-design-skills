# From Domain Events to Indicators

## The events are already there

A workflow designed as a pipeline returns events, in the domain's words,
at the moments that matter. That is a better observability source than
anything added later, because it was reviewed by someone who understands
the business.

```text
type BookingEvent =
  | BookingRequested of { key: CommandId, patient: PatientId }
  | SlotHeld of { key: CommandId, slot: SlotId, expires: Instant }
  | BookingConfirmed of { key: CommandId, booking: BookingRef,
                          fee: Money }
  | BookingRejected of { key: CommandId, reason: BookingError }
```

Each projection below reads this one stream. Nothing new is invented in
the domain to serve the operator.

## Counting

The failure type already enumerates what can go wrong, so the counters
follow from it mechanically.

```text
count "booking.requested"
count "booking.confirmed"
count "booking.rejected" { reason: tagOf error }
```

Rules:

- Label with the **case name** of the error, which is low-cardinality and
  stable. Never with the identifiers inside it.
- Count attempts and outcomes, so a success rate is derivable. A counter
  of failures alone cannot answer "is this worse than usual".
- Add the counter when the case is added. Exhaustive matching over the
  error type is what makes that automatic.

## Timing

Time the whole workflow, and separately every call that leaves the
process.

```text
time "booking.total"
time "booking.hold_slot"      -- another system
time "booking.charge"         -- another system
```

Record durations as a distribution, not an average: the average hides the
tail, and the tail is what users complain about. Watch the high
percentiles and the maximum.

Do not time pure functions by default. They are fast and deterministic,
and timing them adds noise. Time one when a measurement says it matters.
See
[designing-for-performance.md](../../programming-strategically/references/designing-for-performance.md).

## Indicators worth having

An indicator is a number that tracks something a user would notice.
Derive each from the event stream.

| Indicator         | Derived from                        |
| ----------------- | ----------------------------------- |
| Success rate      | Confirmed over requested            |
| Latency at p99    | Duration of the whole workflow      |
| Stuck work        | Held with expiry in the past        |
| Freshness         | Age of the oldest unprocessed event |
| Correctness drift | Recomputed total versus recorded    |

The last two are the ones teams usually lack. Freshness is what tells you
a consumer has fallen behind before anyone notices stale data, and a
drift check is the only thing that catches a projection that has been
quietly wrong for a week.

## Alerting

Alert on a symptom a user would describe, over a window long enough to
avoid noise.

| Good alert                         | Bad alert            |
| ---------------------------------- | -------------------- |
| Success rate below target, 10 min  | Any single error     |
| p99 above budget, sustained        | One slow request     |
| Oldest unprocessed item over 5 min | Queue depth over 100 |
| Dead-letter count rising           | A handler threw      |

An expected domain outcome is not an incident. `SlotUnavailable` is the
system working; a rising _rate_ of it may still be worth knowing about,
which is a dashboard, not a page.

## Cardinality

Every distinct label combination on a metric is a separate time series.
Identifiers, email addresses, URLs with parameters, and free text will
each produce an unbounded number and eventually break the collector.

| Safe as a label | Never a label       |
| --------------- | ------------------- |
| Error case name | Entity identifier   |
| Route pattern   | Resolved URL        |
| Status class    | Full status message |
| Tenant tier     | Tenant identifier   |
| Boolean outcome | Free-text reason    |

Identifiers belong in logs and traces, where the storage model expects
high cardinality and the retention is bounded by time.

## Adding a new event

When a workflow gains an event, work through the same three questions:

1. Does anything need counting? Add the counter beside the projection.
2. Does it start or end something timed? Adjust the timer.
3. Would anyone need to find one specific occurrence later? Then it
   needs the identifiers in the log projection.

Doing this at the moment the event is added costs a minute. Doing it
during an incident costs the incident.
