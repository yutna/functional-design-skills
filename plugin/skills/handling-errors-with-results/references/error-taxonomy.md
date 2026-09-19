# A Taxonomy of Failures

Not every failure deserves the same mechanism. Classify first; the
mechanism follows.

## The four kinds

| Kind            | Definition                        | Mechanism        |
| --------------- | --------------------------------- | ---------------- |
| Domain outcome  | The business has a name for it    | `Result` case    |
| Input problem   | Data from outside is unacceptable | `Result` case    |
| Transient fault | Might succeed if retried          | `Result`, marked |
| Programmer bug  | A condition that must not occur   | Crash            |

### Domain outcome

The business says it: quote expired, insufficient funds, slot taken. It
is not an exception; it is an answer.

```text
type WithdrawError =
  | InsufficientFunds of { available: Money, requested: Money }
  | AccountFrozen of FreezeReason
```

Include the data the caller needs to act or to explain. `available` here
lets the interface show how much is possible without another call.

### Input problem

Something outside sent data the domain cannot accept. Distinguish two
sub-kinds, because different people fix them:

- **Malformed**: not the shape the protocol promised. The sender's bug.
- **Invalid**: correct shape, unacceptable values. The user's business.

```text
parseBooking : Json -> Result<UnvalidatedBooking, ParseError>
validateBooking :
  UnvalidatedBooking -> Result<ValidatedBooking, NonEmptyList<ValidationError>>
```

### Transient fault

A timeout, a lost connection, a lock conflict. The caller may retry.
Distinguish it in the type so retry logic does not have to guess.

```text
type TreatmentError =
  | Transient of { retryAfter: Option<Seconds> }
  | Permanent of Text
```

Retry belongs at the edge, not inside a domain step. A domain function
that retries hides latency and makes its own timing untestable.

### Programmer bug

An impossible state, a broken invariant, a null where the type forbids
one. Do not model these as `Result`: doing so forces every caller to
handle a case that means "the program is wrong", and the handling will be
guesswork.

Crash instead, loudly and early, with enough context to debug. In a
server, crash the request, not the process, and let the supervisor or the
handler at the edge convert it into a generic failure response.

## Deciding

Ask, in order:

1. **Would a domain expert have a word for this?** Yes: domain outcome.
2. **Did data from outside cause it?** Yes: input problem.
3. **Could the identical call succeed later?** Yes: transient.
4. **Otherwise:** it is a bug. Crash.

## What errors should carry

Include:

- The identity of the thing that failed: which code, which field, which
  identifier
- The values needed to act: limits, available amounts, retry hints
- A machine-readable case, so callers can branch

Exclude:

- Messages written for end users, which belong at the edge where the
  language and the audience are known
- Stack traces and driver codes in matchable cases; keep them as opaque
  context for logs
- Anything sensitive: tokens, personal data, full payloads

## Converting at the boundary

Every library and every remote call is a source of foreign failures.
Convert once, where the call happens.

```text
saveBooking : Pool -> Booking -> AsyncResult<Unit, SaveError>
saveBooking pool booking =
  tryCatch (\_ -> insert pool (toRow booking)) classify

classify e =
  match e with
  | UniqueViolation _ -> DuplicateBooking
  | Timeout _ -> Transient { retryAfter: Some (Seconds 1) }
  | other -> Unexpected (opaque other)
```

Past this function, no code knows which driver is in use. That is the
whole point of the conversion.

## Logging

Log once, at the edge, where the whole context is available. A step that
logs and returns an error produces two records of one event and buries
the useful one. Errors carry their own context; the edge decides what to
write and at what level.
