# Retries and Backpressure

## Where retries belong

At the shell, wrapping the adapter, never inside a domain step. A domain
function that retries hides latency, cannot be tested in time, and makes
its own behaviour depend on the network.

```text
-- shell: the adapter is wrapped once
saveBookingResilient = withRetry policy (saveBooking pool)

-- domain: unchanged, and unaware
confirmBooking : SaveBooking -> BookingRequest -> AsyncResult<Placed, Error>
```

## Retry only what is worth retrying

The error taxonomy already answers this. See
[error-taxonomy.md](../../handling-errors-with-results/references/error-taxonomy.md).

| Failure kind    | Retry?                          |
| --------------- | ------------------------------- |
| Transient fault | Yes, bounded                    |
| Domain outcome  | Never; it will fail identically |
| Input problem   | Never; the input is wrong       |
| Programmer bug  | Never; fix the program          |

A retry policy that retries everything turns a fast, clear rejection into
a slow, confusing timeout. Make the error type carry the distinction so
the policy does not have to guess.

## Budgets, not attempt counts

Three attempts of an operation with a thirty-second timeout is a
ninety-second wait that some caller upstream will not tolerate. Bound
both.

```text
type RetryPolicy = {
  maxAttempts: Integer,
  perAttemptTimeout: Seconds,
  totalBudget: Seconds,
  backoff: Backoff,
}
```

- **Total budget** is the number that matters, because it is what the
  caller experiences.
- **Per-attempt timeout** stops one slow attempt consuming the budget.
- The budget should shrink as it is passed inward: a request with three
  seconds left must not start an operation that takes five.

## Backoff and jitter

Exponential backoff without jitter synchronises every client, so the
retries arrive together and knock the service over again the moment it
recovers.

```text
delay attempt = random (0, min (base * 2 ^ attempt) ceiling)
```

Full jitter — a random delay between zero and the computed ceiling — is
the safe default. The exact scheme matters less than having any jitter at
all.

## Circuit breaking

When a dependency is failing consistently, retrying makes it worse and
delays every caller. A breaker turns that into a fast, clear failure.

```text
type BreakerState = Closed | Open of Instant | HalfOpen
```

- **Closed**: calls pass; failures are counted over a window.
- **Open**: calls fail immediately with a named error, for a cool-down.
- **Half-open**: one trial call decides whether to close or re-open.

The breaker's error must be distinguishable from the underlying failure,
because the caller's response differs: an open breaker means "do not
bother", not "this request was invalid".

Keep the state in one place at the shell, and note that a breaker per
process means each instance learns independently, which is usually what
you want.

## Backpressure

Retries and queues both hide the same problem: work arriving faster than
it can be done. The queue absorbs it until it cannot, and then the
failure is sudden and total.

Signals, in order of usefulness:

| Signal             | Tells you                         |
| ------------------ | --------------------------------- |
| Queue depth trend  | Whether you are keeping up        |
| Oldest message age | The real latency users experience |
| Rejected count     | That shedding is happening        |
| Retry rate         | That a dependency is degraded     |

Responses, in order of preference:

1. **Slow the producer.** Bounded queues that block, or a rate limit at
   the edge, push the problem to where it can be handled.
2. **Shed load explicitly.** Reject with a clear, retryable error and a
   retry-after hint. A rejection a client can act on beats a timeout.
3. **Degrade the work.** Skip the optional part: no recommendations, no
   enrichment, still a correct answer.
4. **Scale out.** Last, because it is the only one that costs money and
   the only one that hides the design problem.

An unbounded queue is not a solution. It converts a fast failure into
unbounded latency plus eventual memory exhaustion, and it removes the
signal you needed.

## Timeouts

Every call across a process boundary has a timeout, and the default from
the library is almost always wrong.

- Set it from what the caller can wait for, not from what the dependency
  usually takes.
- A timeout is not a failure of the operation: the work may have
  succeeded. That is precisely why the effect must be idempotent. See
  [idempotency-and-delivery.md](idempotency-and-delivery.md).
- Log timeouts separately from errors. They mean different things and
  need different fixes.
