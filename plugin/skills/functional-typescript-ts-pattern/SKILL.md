---
name: functional-typescript-ts-pattern
description: Use when a TypeScript project uses ts-pattern for matching, including exhaustive dispatch over unions, state machines, and Result handling.
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

## When to use

- A TypeScript project that already depends on ts-pattern
- Dispatching over a discriminated union, especially on nested fields
- Implementing a state machine's transitions
- Handling a `Result` or a union of errors

Not for: designing the union itself, which is
[modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md).

## Core rules

1. **End every match with `.exhaustive()`.** That is the whole point;
   `.otherwise()` throws the guarantee away.
2. **Match on the discriminant first**, then on nested structure, so the
   patterns read in the booking a person would ask the questions.
3. **Use `P.when` for guards**, not for business rules that deserve a
   name. A guard should fit on a line.
4. **Select what you use.** `P.select()` names the parts a handler needs
   instead of reaching back into the value.
5. **Keep handlers small.** A match arm that is ten lines should call a
   named function.
6. **Do not match on primitives that should be types.** Matching on a
   raw status string is the smell the type was supposed to remove.

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

## Matching on structure

Where plain narrowing needs several nested conditions, one pattern says
it directly:

```ts
const routing = (booking: Booking) =>
  match(booking)
    .with({ lifecycle: { tag: "Cancelled" } }, () => "archive")
    .with(
      { shipping: { method: "express" }, total: P.when((t) => t > 500_00) },
      () => "priority courier",
    )
    .with({ shipping: { method: "express" } }, () => "courier")
    .with({ shipping: { method: "standard" } }, () => "post")
    .exhaustive();
```

Booking matters: patterns are tried top to bottom, so the more specific
case goes first.

## State transitions

```ts
const apply = (
  quote: Quote,
  command: QuoteCommand,
): Result<Quote, TransitionError> =>
  match([quote, command] as const)
    .with([{ tag: "Draft" }, { tag: "Send" }], ([q, c]) => send(q, c.at))
    .with([{ tag: "Sent" }, { tag: "Accept" }], ([q, c]) => accept(q, c.by))
    .with([{ tag: P.union("Draft", "Sent") }, { tag: "Cancel" }], ([q, c]) =>
      cancel(q, c.reason),
    )
    .otherwise(() => err({ tag: "IllegalTransition" }));
```

This is the transition table from
[modeling-state-machines](../modeling-state-machines/SKILL.md) written
directly. It is the one place `.otherwise()` is legitimate: the empty
cells of the table are genuinely a single outcome, and enumerating every
illegal pair would be noise.

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
const render = (r: Result<PricedBooking, ConfirmBookingError>) =>
  match(r)
    .with({ ok: true }, ({ value }) => renderBooking(value))
    .with({ ok: false, error: { tag: "Validation" } }, ({ error }) =>
      renderFieldErrors(error.cause),
    )
    .with({ ok: false, error: { tag: "Pricing" } }, () => unprocessable())
    .with({ ok: false, error: { tag: "Storage" } }, () => serverError())
    .exhaustive();
```

This is the aggregated error handling from
[defining-errors-out-of-existence](../defining-errors-out-of-existence/SKILL.md),
at the edge, with the compiler proving every case is covered.

## Red flags

- `.otherwise()` on a match over a domain union
- `.run()` or `.exhaustive()` missing, leaving the match unevaluated
- A match on a raw string status rather than a choice type
- `P._` used as a catch-all in a domain match
- A `P.when` guard containing a multi-line business rule
- Handlers longer than about three lines

## Common mistakes

- **Reaching for `.otherwise()` to silence a compile error.** The error
  is the list of places a new case must be handled.
- **Matching on values that should be types.** If the match is on a
  string field, fix the type first.
- **Very deep patterns.** Beyond two levels the pattern is harder to read
  than the code it replaces; destructure and match on the part.
- **Using `P.when` for the main dispatch.** Guards are for conditions,
  not for the primary branch; the structure should carry that.
- **Forgetting pattern booking.** A general pattern above a specific one
  silently shadows it.

## Related skills

- [functional-typescript](../functional-typescript/SKILL.md)
- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)

## Further reading

- [patterns.md](references/patterns.md) covers the pattern vocabulary,
  selection, guards, and the exhaustiveness guarantee in detail.
