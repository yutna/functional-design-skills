---
name: functional-typescript-ts-pattern
description: Use when a TypeScript project uses ts-pattern for matching, including exhaustive dispatch over unions, state machines, and Result handling.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
---

# Functional TypeScript With ts-pattern

## Overview

`ts-pattern` supplies the one construct TypeScript lacks: pattern
matching over the shape of a value, with an exhaustiveness check the
compiler enforces. Everything the core skills say about choice types and
state machines becomes easier to express, because matching on nested
structure no longer needs a chain of narrowing conditions.

It changes how code is written, not what the design is. The types come
from
[functional-typescript](../functional-typescript/SKILL.md); this pack
covers how to consume them.

**Check the installed version before writing code.** The shapes below
target ts-pattern 5.

## When to use

- A TypeScript project that already depends on ts-pattern
- Dispatching over a discriminated union, especially on nested fields
- Implementing a state machine's transitions
- Handling a `Result` or a union of errors

Not for: designing the union itself, which is
[functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md).

## Core rules

1. Rule. **End a match over a union with `.exhaustive()`.** That is the whole
   point; `.otherwise()` there throws the guarantee away. A match over a pair,
   such as a state and a command, is a table whose empty cells are one
   outcome, and `.otherwise()` is how that outcome is written. The other two
   places for `.otherwise()`, a value from outside the type system and a set
   that is open, are in [patterns.md](references/patterns.md).
2. Default. **Match on the discriminant first**, then on nested structure, so
   the patterns read in the order a person would ask the questions.
3. Default. **Use `P.when` for guards**, not to write a business rule inline. A
   guard fits on a line. One that applies a rule the business would state, such
   as a threshold, compares with a named constant or calls a named predicate
   that is defined beside the domain type.
4. Default. **Select what you use.** `P.select()` names the parts an arm
   needs instead of reaching back into the value. It earns its place when the
   arm needs one or two fields from deep inside. A field at the top of the
   matched shape can as well be read by destructuring the arm's argument.
5. Judgement. **Keep arms small.** A match arm that is ten lines should call
   a named function.
6. Rule. **Do not match on primitives that should be types.** Matching on a raw
   status string is the smell the type was supposed to remove.

## Pattern

```ts
import { match, P } from "ts-pattern";

const describe = (s: Shipment): string =>
  match(s)
    .with({ tag: "Pending" }, () => "awaiting dispatch")
    .with({ tag: "Shipped" }, ({ tracking }) => `in transit: ${tracking}`)
    .with(
      { tag: "Delivered" },
      ({ deliveredAt }) => `delivered ${format(deliveredAt)}`,
    )
    .with({ tag: "Failed", reason: P.select() }, (r) => `failed: ${r}`)
    .exhaustive();
```

Adding a fifth case to `Shipment` makes `.exhaustive()` a compile error
here and at every other match over the type. That list is the value.

ts-pattern's own documentation calls the function of an arm its handler.
This pack keeps that word for the function that carries out a command,
and says arm.

## Matching on structure

Where plain narrowing needs several nested conditions, one pattern says
it directly:

```ts
const routing = (item: ScheduledTreatment) =>
  match(item)
    .with(
      {
        treatment: { tag: "Procedure" },
        minutes: P.when((m) => m > THEATRE_MINUTES),
      },
      () => "theatre",
    )
    .with({ treatment: { tag: "Procedure" } }, () => "procedure room")
    .with({ treatment: { tag: "Consultation" } }, () => "consulting room")
    .exhaustive();
```

Order matters: patterns are tried top to bottom, so the more specific
case goes first. `THEATRE_MINUTES` is the clinic's threshold, a constant
named beside the `ScheduledTreatment` type, which holds one treatment
and the minutes it is booked for.

## State transitions

```ts
const apply = (
  now: Instant,
  quote: Quote,
  command: QuoteCommand,
): Result<Quote, TransitionError> =>
  match([quote, command] as const)
    .with([{ tag: "Draft" }, { tag: "Send" }], ([q]) => send(now, q))
    .with([{ tag: "Sent" }, { tag: "Accept" }], ([q, c]) =>
      accept(now, c.by, c.booking, q),
    )
    .with([{ tag: "Sent" }, { tag: "Expire" }], ([q]) => expire(now, q))
    .with([{ tag: P.union("Draft", "Sent") }, { tag: "Cancel" }], ([q, c]) =>
      cancel(now, c.by, c.reason, q),
    )
    .otherwise(() => err({ tag: "IllegalTransition" }));
```

This is the transition table from
[functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
written directly, and the pair it matches over is why rule 1 lets it end in
`.otherwise()`: enumerating every illegal pair would be noise. The table form
gives up the list `.exhaustive()` produces. A state or a command added later is
not reported here, because `.otherwise()` answers for it. The instant is an
argument, read once by the handler that calls `apply`, and the booking's
identifier arrives in the command, minted there too. `TransitionError` is the
union of the four transitions' own errors and `IllegalTransition`.

Where transitions carry different failures, prefer separate functions per
source state and keep the match only for dispatching commands.

## Useful patterns

| Pattern            | Matches                                |
| ------------------ | -------------------------------------- |
| `P.string`         | Any string                             |
| `P.number`         | Any number                             |
| `P.boolean`        | Any boolean                            |
| `P._`              | Anything                               |
| `P.nullish`        | `null` or `undefined`                  |
| `P.union(a, b)`    | Either of two patterns                 |
| `P.array(p)`       | An array whose items match `p`         |
| `P.optional(p)`    | A key that may be absent               |
| `P.when(f)`        | A value where `f` returns true         |
| `P.select()`       | Binds the matched part as the argument |
| `P.select("name")` | Binds it under a name                  |
| `P.not(p)`         | Anything not matching `p`              |

## Handling Result

```ts
const render = (
  r: Result<readonly ConfirmBookingEvent[], ConfirmBookingFailure>,
) =>
  match(r)
    .with({ ok: true }, ({ value }) => renderEvents(value))
    .with(
      {
        ok: false,
        error: {
          tag: "Rejected",
          cause: { tag: "Validation", cause: P.select() },
        },
      },
      (errors) => renderFieldErrors(errors),
    )
    .with(
      { ok: false, error: { tag: "Rejected", cause: { tag: "Pricing" } } },
      () => unprocessable(),
    )
    .with({ ok: false, error: { tag: "Unavailable" } }, () => serverError())
    .exhaustive();
```

`ConfirmBookingFailure` wraps the workflow's `ConfirmBookingError` in
`Rejected` and adds `Unavailable` for a store that cannot be reached, so
the three failures are three arms. This is the aggregated error handling
from
[functional-defining-errors-out-of-existence](../functional-defining-errors-out-of-existence/SKILL.md),
at the edge, with the compiler proving every case is covered.

## Red flags

- `.otherwise()` on a match over one domain union
- `.run()`, `.exhaustive()` or `.otherwise()` missing, leaving the match
  unevaluated
- A match on a raw string status rather than a choice type
- `P._` used as a catch-all in a domain match
- A `P.when` guard containing a multi-line business rule
- An arm of ten lines that calls no named function

## Common mistakes

- **Reaching for `.otherwise()` to silence a compile error.** The error
  is the list of places a new case must be handled.
- **Matching on values that should be types.** If the match is on a
  string field, fix the type first.
- **Very deep patterns.** Beyond two levels the pattern is harder to read
  than the code it replaces; destructure and match on the part.
- **Using `P.when` for the main dispatch.** Guards are for conditions,
  not for the primary branch; the structure should carry that.
- **Forgetting pattern order.** A general pattern above a specific one
  silently shadows it.

## Related skills

- [functional-typescript](../functional-typescript/SKILL.md)
- [functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md)
- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)

## Further reading

- [patterns.md](references/patterns.md) covers the pattern vocabulary,
  selection, guards, and the exhaustiveness guarantee in detail.
