# The Four Techniques, Worked

## Contents

- [1. Define the error out of existence](#1-define-the-error-out-of-existence)
- [2. Mask it](#2-mask-it)
- [3. Aggregate the handling](#3-aggregate-the-handling)
- [4. Crash](#4-crash)
- [Applying the four in order](#applying-the-four-in-order)

## 1. Define the error out of existence

Change what the operation means so the awkward case becomes ordinary.

### Deletion of nothing

```text
removeTreatment :
  TreatmentCode -> Booking -> Result<Booking, TreatmentNotInBooking>
```

Callers that want the treatment gone do not care whether it was there. The
error exists because the implementer thought about the internal lookup
rather than the caller's intent.

```text
removeTreatment : TreatmentCode -> Booking -> Booking
```

Keep the error only if a caller genuinely needs to distinguish, for
example to report "that treatment was already removed by someone else". Then
the correct interface is different again: it returns what changed.

```text
removeTreatment :
  TreatmentCode -> Booking -> { booking: Booking, removed: Boolean }
```

### Absent configuration

```text
getTimeout : Config -> Result<Seconds, MissingKey>
```

Every caller supplies the same default. Move the default into the module
that owns the meaning:

```text
getTimeout : Config -> Seconds        -- documented default inside
```

### Unbounded operations

```text
take : Integer -> List<A> -> Result<List<A>, NotEnoughElements>
```

Taking five from a list of three is not an error; it is three.

```text
take : Integer -> List<A> -> List<A>
```

### Redefinition gone wrong

Defining away a case the business names. "Treatment code not found" during
booking validation is a real outcome: the patient typed something wrong,
and silently dropping the treatment produces a wrong booking. The test is
whether the specification, the ticket, or the codebase names the case as
one to report. Where none does, see
[working-alone.md](../../functional-design/references/working-alone.md).

## 2. Mask it

Handle the condition where the expertise is, so callers never learn it
exists.

```text
-- the pool reconnects; callers see only real failures
query : Pool -> Sql -> AsyncResult<Rows, QueryError>
```

Good masking has three properties:

1. The recovery is always the same, whoever the caller is.
2. The lower module knows better than the caller how to recover.
3. Masking does not hide information the caller needs, such as the fact
   that the operation took three seconds and two attempts.

### Masking gone wrong

- Masking a failure that changes the caller's decision, such as a partial
  write.
- Retrying a non-idempotent operation, which turns one failure into two
  charges.
- Hiding latency: a mask that retries for thirty seconds turns a fast
  failure into a timeout somewhere else. Bound it and say so.

## 3. Aggregate the handling

Let errors travel to one place that handles them uniformly.

```text
-- one handler per workflow failure type, at the edge
rejectionResponse : ConfirmBookingError -> Response
rejectionResponse e =
  match e with
  | Validation errs -> badRequest (renderAll errs)
  | Pricing _ -> unprocessable "pricing failed"

toResponse : ConfirmBookingFailure -> Response
toResponse f =
  match f with
  | Rejected e -> rejectionResponse e
  | Unavailable _ -> serverError
```

Both failure types are declared in
[functional-designing-workflow-pipelines](../../functional-designing-workflow-pipelines/SKILL.md).

Aggregation works because the response to an error is usually a property
of the boundary, not of the step that produced it. The same rule applies
to logging, metrics, and user-facing messages: do it once, where the
context is complete.

The counterpart inside the domain is one failure type per handler, so
the aggregation point has one thing to match on. See
[error-taxonomy.md](../../functional-handling-errors-with-results/references/error-taxonomy.md).

### Aggregation gone wrong

Aggregating so far up that the context is gone. If the handler cannot
tell which of five operations failed, the error type is too coarse or the
aggregation point is too high.

## 4. Crash

Some conditions are not worth handling.

```text
-- an invariant broken means the program is wrong
bookingOf accepted =
  match accepted.booking with
  | Some booking -> booking
  | None -> crash "accepted quote without a booking"
```

Crash when all of these hold:

- The condition indicates a bug, not an input or a business outcome
- There is no sensible way to continue
- Continuing risks corrupting data or misleading a user

In a server, crash the unit of work, not the process: fail the request,
return a generic response, and record enough to debug. In a batch job,
failing fast on the first corrupt record the program wrote itself is
usually better than processing nine thousand and discovering it later.
A corrupt record that arrives from outside is an input problem, not a
bug: return it and accumulate, as
[applicative-validation.md](../../functional-handling-errors-with-results/references/applicative-validation.md)
describes.

### Crashing gone wrong

Crashing on ordinary outcomes: a missing optional field, an expired
token, a user's typo. Those are business outcomes, and they belong in a
`Result`.

## Applying the four in order

When reviewing an interface with several failure cases, go through them
in this order:

1. Can the operation be redefined so the case is normal? Do that.
2. Is the recovery always the same and best known here? Mask it.
3. Does the case need a decision from higher up? Let it flow, and handle
   it once at the edge.
4. Does it mean the program is broken? Crash.

Whatever survives all four is a genuine part of the contract, and belongs
in the type with a name from the domain.
