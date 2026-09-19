---
name: designing-what-to-observe
description: Use when deciding what to log, trace, or measure, when an incident could not be diagnosed from what was recorded, or when adding observability late.
---

# Designing What to Observe

## Overview

Observability is a design decision, not an afterthought: it is choosing
which questions a running system must be able to answer, and building
the answers into the types before anything ships. Added afterwards, it
becomes a scattering of log lines that record what was convenient rather
than what anyone needs.

A functional design has an advantage here that most do not. A workflow
that returns events already produces a stream of business facts, in the
domain's own words, at exactly the moments that matter. That stream is
the observability primitive; logs, traces, and metrics are projections
of it.

## When to use

- Designing a workflow, and deciding what it must reveal
- An incident where the recorded data could not answer the question
- A log line is about to be added inside a domain function
- Choosing what to alert on
- Adding observability to a system that has none

Not for: choosing what an interface exposes to callers, which is
[deciding-what-matters](../deciding-what-matters/SKILL.md).

## Core rules

1. **Write the questions first.** "Why did this booking fail?", "How many
   bookings are stuck?", "Is checkout slower than yesterday?" The fields
   follow from the questions; the reverse produces data nobody uses.
2. **Emit domain events, not log lines.** The workflow already returns
   what happened. The shell projects those into whatever the platform
   wants.
3. **Log once, at the edge.** A step that logs and returns an error
   produces two records of one event and buries the useful one.
4. **Correlate at the edge.** Create one identifier per request or
   message, carry it as a value, and attach it where records are written.
   Carry the identifier, never a context object that accumulates.
5. **Structured errors are already structured logs.** The error type
   built for callers has the case, the identifiers, and the values. Do
   not flatten it to a sentence before recording it.
6. **Never record secrets or personal data.** Decide this at the type
   level, so a careless serialisation cannot leak it.
7. **Alert on what users feel**, not on what a machine noticed. Queue
   depth trending up and the oldest unprocessed item beat processor
   utilisation.

## Pattern

Observability bolted on inside the domain:

```text
priceBooking catalogue booking =
  log "pricing booking " + booking.id                -- impure now
  let priced = ...
  log "priced " + show priced.total
  metrics.increment "bookings.priced"
  priced
```

The function is no longer pure, no longer testable without a logger, and
what it records was chosen by whoever was debugging that week.

Observability as a projection of events:

```text
-- core: unchanged, pure, returns what happened
priceBooking : Catalogue -> ValidatedBooking -> Result<PricedBooking, Error>

type BookingEvent =
  | BookingPriced of { booking: BookingId, total: Money, treatments: Integer }
  | PricingRejected of { booking: BookingId, reason: PricingError }

-- shell: one projection, in one place
record : CorrelationId -> BookingEvent -> Async<Unit>
```

Every record now has the same shape, the same identifiers, and the same
vocabulary as the business. Adding a field is a change to one type, and
the compiler lists the projections that must handle it.

## What each signal answers

| Signal | Answers                          | Cardinality  |
| ------ | -------------------------------- | ------------ |
| Metric | Is it happening, how much        | Low          |
| Trace  | Where did this one request go    | One per span |
| Log    | What exactly happened, this time | Unbounded    |
| Event  | What the business did            | Unbounded    |

Put identifiers in logs and traces, never in metric labels: a metric
labelled by booking identifier becomes a new time series per booking and will
break the collector.

## The three questions per workflow

For each workflow, answer these before implementing it:

1. **What must be countable?** Usually: attempted, succeeded, and each
   named failure case. That falls straight out of the error type.
2. **What must be timed?** The whole workflow, plus any step that calls
   another system.
3. **What must be reconstructable?** The identifiers needed to find one
   specific case later: the command identity, the entity, the actor.

If the answers are not in the event types, the event types are missing
something the operator needs.

## Red flags

- A log statement inside a pure function
- The same event logged in the step and again at the edge
- An error flattened to a string before it is recorded
- A metric labelled with an identifier
- An alert on a resource number rather than a user-visible symptom
- An incident report saying "we could not tell from the logs"
- Personal data or a token in a recorded payload
- Observability added only to the code that broke last

## Common mistakes

- **Recording everything.** Volume is not coverage. Unbounded output
  costs money and hides the line that mattered.
- **Deciding fields before questions.** Produces data that is present and
  useless.
- **Making the core impure to observe it.** Return the fact; let the
  shell record it.
- **One correlation object passed everywhere.** That is a pass-through
  variable, and it accumulates. See
  [hiding-information](../hiding-information/SKILL.md).
- **Alerting on every error.** Expected domain outcomes are not
  incidents. Alert on rates and on things users feel.
- **Sampling before deciding what must never be sampled.** Errors and
  slow requests are exactly what you need at full fidelity.

## Related skills

- [deciding-what-matters](../deciding-what-matters/SKILL.md)
- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [making-effects-reliable](../making-effects-reliable/SKILL.md)

## Further reading

- [signals-and-events.md](references/signals-and-events.md) turns domain
  events into indicators, and covers what to count and time.
- [logs-traces-metrics.md](references/logs-traces-metrics.md) covers
  correlation, sampling, and what must never be recorded.
