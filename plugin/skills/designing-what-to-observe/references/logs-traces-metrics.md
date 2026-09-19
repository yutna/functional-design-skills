# Logs, Traces, Metrics

Three storage models with different costs and different questions. Using
one for another's job is the most common waste.

| Signal | Question it answers          | Cost driver    |
| ------ | ---------------------------- | -------------- |
| Metric | Is this happening, how often | Series count   |
| Trace  | Where did this request spend | Span volume    |
| Log    | What exactly happened, once  | Bytes retained |

## Correlation

One identifier per unit of work, created at the edge, carried as a value.

```text
type CorrelationId = CorrelationId of Uuid

-- edge: create it, or adopt the one the caller sent
correlationFor : Request -> CorrelationId
```

Rules:

1. **Adopt an incoming identifier if there is one**, so a request can be
   followed across services. Generate one only at the true entry point.
2. **Carry the identifier, not a context object.** A context that
   accumulates fields becomes a grab bag threaded through every
   signature, which is the pass-through variable smell in
   [hiding-information](../../hiding-information/SKILL.md).
3. **Attach it where records are written**, in the shell, not by passing
   a logger into the domain.
4. **Include the command identity too**, where there is one, so retries
   of the same intent can be grouped. See
   [idempotency-and-delivery.md](../../making-effects-reliable/references/idempotency-and-delivery.md).

For asynchronous work, the correlation identifier travels in the message,
alongside the payload. Losing it at a queue boundary is the usual reason
a trace stops halfway.

## Log records

A log record is structured data, not a sentence. The error type already
has the structure.

```text
-- bad: the structure is destroyed on the way out
log.error("booking failed: " + show error)

-- good: the case and its fields survive
record correlation (BookingRejected { key, reason }) =
  emit {
    event: "booking.rejected",
    correlation: value correlation,
    command: value key,
    reason: tagOf reason,
    detail: fieldsOf reason,
  }
```

Levels, used consistently:

| Level | Means                                            |
| ----- | ------------------------------------------------ |
| Error | A bug, or a failure nobody expected              |
| Warn  | Degraded but handled: a retry, a breaker opening |
| Info  | A business event worth keeping                   |
| Debug | Detail for a developer, off in production        |

An expected domain outcome is `info`, not `error`. Logging every
rejected booking at error level trains everyone to ignore the level.

## Traces

A span per unit of work that could be slow, which in practice means
every call that leaves the process, plus the workflow as a whole.

- Name spans after the operation, not the function: `charge.card`, not
  `handleChargeInternal`.
- Put identifiers on span attributes, which tolerate high cardinality.
- Record the error case on the span when it fails, so a trace search can
  filter by it.
- Do not trace pure functions. They do not wait for anything.

## Sampling

Full-fidelity tracing is expensive at volume. Sample, but decide what is
never sampled away:

1. Everything that failed.
2. Everything slower than the budget.
3. A small, steady fraction of successes, for comparison.

Tail-based sampling, which decides after the request completes, is what
makes that possible. Head-based sampling has to guess, and will throw
away the trace you needed.

## What must never be recorded

Decide this in the type system, not in a code review.

- Credentials, tokens, keys, session identifiers
- Full payment instrument details
- Personal data beyond an identifier: names, addresses, health facts
- Whole request or response bodies from a domain with any of the above

Ways to enforce it rather than remember it:

```text
-- a wrapper whose rendering is redacted, everywhere, by construction
type Secret<T> = Secret of T
render : Secret<T> -> Text
render _ = "[redacted]"
```

If the domain type cannot be rendered, no serialiser can leak it by
accident. That is the same move as
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md):
put the rule in the type so it cannot be skipped.

Log the identifier, and let someone with the right access resolve it.

## Retention

Different signals want different lifetimes: metrics for a year, traces
for days, logs for weeks, business events for as long as the business
says. Decide each once, write it down beside the projection, and make
sure the expensive one is not the one kept longest by default.
