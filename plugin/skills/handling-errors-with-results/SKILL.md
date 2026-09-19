---
name: handling-errors-with-results
description: Use when a function throws and callers cannot tell, when exceptions cross module boundaries, or when validation must report every problem.
---

# Handling Errors With Results

## Overview

An error that a caller is expected to handle is part of the function's
contract, so it belongs in the function's type. `Result<T, E>` puts it
there: the function returns either a success or a named failure, and no
caller can forget that failure exists.

Composing such functions is the only mechanic worth learning. A chain of
steps that each may fail forms two tracks: the success track runs through
every step, and the first failure diverts to the failure track and skips
the rest. Once that shape is in place, error handling stops being
scattered defensive code and becomes part of the pipeline's structure.

## When to use

- Designing what a function returns when it can fail
- Exceptions are thrown in one module and caught in another
- A form must report every invalid field, not just the first
- Deciding what an error type should contain
- A pipeline step can fail and the failure must reach the caller

Not for: failures that can be removed by design, which is
[defining-errors-out-of-existence](../defining-errors-out-of-existence/SKILL.md).

## Core rules

1. **Expected failures are values.** If a caller should act on it, return
   it. Reserve exceptions for programmer bugs and unrecoverable
   conditions.
2. **Name the failures in the domain's words.** `QuoteExpired`, not
   `Error500` or a bare string.
3. **One error choice type per workflow.** Steps keep narrow error types
   and are lifted at composition, so callers match on one thing.
4. **Short-circuit sequential steps; accumulate independent ones.** Bind
   for a pipeline, applicative combination for a form.
5. **Convert exceptions at the boundary.** Libraries throw; wrap them
   once, at the edge, into your own error type.
6. **Never encode failure as a magic value.** No empty string, no `-1`,
   no null. Those hide the branch the type should show.
7. **Do not log and rethrow.** Return the error; let the edge decide what
   to log, once.

## Pattern

Exceptions across boundaries:

```text
priceBooking : ValidatedBooking -> PricedBooking
-- throws TreatmentNotFound, throws PriceServiceUnavailable
-- caller must read the implementation to know
```

Failures in the type:

```text
type PricingError =
  | TreatmentNotFound of TreatmentCode
  | PriceUnavailable of TreatmentCode
  | TotalTooLarge of Money

priceBooking : ValidatedBooking -> Result<PricedBooking, PricingError>
```

Now the failures are visible at every call site, the compiler or the
review process ensures they are handled, and the cases are business
outcomes rather than implementation accidents.

## The two tracks

```text
validate >=> price >=> acknowledge
```

Each step takes a plain value and returns a `Result`. The composition
runs the next step only on success, and passes failures straight
through. That single operator replaces every nested check.

| Operator   | Use when                                          |
| ---------- | ------------------------------------------------- |
| `map`      | The next step cannot fail                         |
| `bind`     | The next step can fail                            |
| `mapError` | Converting a step's error to the workflow's error |
| `traverse` | Running a fallible step over a collection         |
| `combine`  | Two independent results, both failures wanted     |

More in [railway.md](references/railway.md).

## Short-circuit or accumulate

The choice is about who reads the error.

**Short-circuit** when the steps are sequential and later steps depend on
earlier ones. Pricing cannot run if validation failed, so reporting both
failures is meaningless.

**Accumulate** when the checks are independent and a person will fix
them. A form with four bad fields should report four problems, not one
per submission.

```text
validateCustomer :
  UnvalidatedCustomer -> Result<Customer, NonEmptyList<ValidationError>>
validateCustomer raw =
  map3 makeCustomer
    (parseName raw.name)
    (parseEmail raw.email)
    (parseAge raw.age)
```

See
[applicative-validation.md](references/applicative-validation.md).

## Designing the error type

Ask what the caller will do with it. That determines the shape.

| Caller behaviour          | Error shape                        |
| ------------------------- | ---------------------------------- |
| Branches per failure      | Choice type, one case per failure  |
| Shows a message to a user | Structured cases, rendered at edge |
| Retries some failures     | Cases that distinguish transient   |
| Only logs it              | One case with context              |
| Fixes a form field        | Case carrying the field name       |

Include the data needed to act or to explain: which treatment code, which
field, which limit. Do not include stack traces, driver codes, or
sentences meant for end users; the edge renders messages, using the
reader's language.

See [error-taxonomy.md](references/error-taxonomy.md).

## Red flags

- A function documented with "throws" that callers must read
- A `catch` block in the middle of business logic
- An error type that is a plain string
- The same exception caught in five places, each handling it differently
- A `Result` whose failure case is ignored at the call site
- Errors from a database driver reaching a controller
- Validation that stops at the first bad field of a form

## Common mistakes

- **Using `Result` for programmer bugs.** A null argument that should be
  impossible is a bug; crashing is the honest response.
- **One giant error type for the whole application.** Callers then handle
  cases that cannot occur where they are. Scope it to the workflow.
- **Wrapping and rewrapping.** Each layer adding a wrapper produces an
  onion no one can match on. Convert once, at the boundary.
- **Losing the cause.** When converting from a library, keep the original
  as opaque context for logs, out of the matchable cases.
- **Accumulating when steps depend on each other.** Reporting "price
  missing" for a booking that failed validation confuses everyone.

## Related skills

- [defining-errors-out-of-existence](../defining-errors-out-of-existence/SKILL.md)
- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- [composing-functions](../composing-functions/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)

## Further reading

- [railway.md](references/railway.md) is the two-track model, its
  operators, and how to adapt functions to fit it.
- [applicative-validation.md](references/applicative-validation.md)
  covers accumulating errors and when to prefer it.
- [error-taxonomy.md](references/error-taxonomy.md) classifies failures
  and says which mechanism each one deserves.
