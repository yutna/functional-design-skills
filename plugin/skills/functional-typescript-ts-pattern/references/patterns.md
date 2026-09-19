# Pattern Vocabulary

## The shape of a match

```ts
match(value).with(pattern, handler).with(pattern, handler).exhaustive();
```

Patterns are tried in order. `.exhaustive()` fails to compile if any
possible value of the input type is unmatched, and throws at runtime if
one arrives anyway, which covers values that came from outside the type
system.

`.otherwise(handler)` and `.run()` end a match without the check. Reserve
them for the cases described below.

## Literal and structural patterns

```ts
.with({ tag: "Shipped" }, handler)          // discriminant
.with({ tag: "Shipped", tracking: "X1" }, handler)  // and a literal
.with({ shipping: { method: "express" } }, handler) // nested
.with([{ tag: "Draft" }, { tag: "Send" }], handler) // tuple
```

An object pattern matches partially: keys not mentioned are unconstrained.
That is what makes matching on a discriminant plus one nested field read
well.

## Wildcards

| Pattern     | Matches                  |
| ----------- | ------------------------ |
| `P._`       | Anything, of any type    |
| `P.string`  | Any string               |
| `P.number`  | Any number               |
| `P.bigint`  | Any bigint               |
| `P.boolean` | Any boolean              |
| `P.symbol`  | Any symbol               |
| `P.nullish` | `null` or `undefined`    |
| `P.any`     | Anything, typed as `any` |

In domain code, `P._` as a final catch-all is the same mistake as a
permissive `default`. It is useful inside a larger pattern, to say "this
field can be anything".

## Combinators

```ts
.with({ tag: P.union("Draft", "Sent") }, handler)
.with({ status: P.not("cancelled") }, handler)
.with({ treatments: P.array({ quantity: P.number }) }, handler)
.with({ note: P.optional(P.string) }, handler)
```

`P.array(p)` matches when every element matches `p`. To match on the
array's length or on specific positions, use a tuple pattern or a guard.

## Guards

```ts
.with({ total: P.when((t) => t > LARGE_ORDER) }, handler)
.when((booking) => isAfterCutoff(booking.confirmedAt), handler)
```

Two forms: `P.when` inside a pattern, and `.when` as a whole-value guard.
Keep both to one line. A guard containing a real rule should be a named
predicate defined beside the domain type, so it can be tested and reused.

Guards do not participate in the exhaustiveness check: a match made only
of guarded patterns cannot be proven exhaustive, and will need
`.otherwise()`. Dispatch on structure first, and use guards only to
refine within a case.

## Selection

```ts
.with({ tag: "Failed", reason: P.select() }, (reason) => `failed: ${reason}`)

.with(
  { tag: "Delivered", tracking: P.select("t"), deliveredAt: P.select("at") },
  ({ t, at }) => `${t} arrived ${format(at)}`,
)
```

An unnamed `P.select()` passes the matched part as the handler's
argument; named selects arrive as an object. Selecting is clearer than
destructuring the whole value when the handler needs one or two fields
from deep inside.

## Typing the result

```ts
match(shipment)
  .returnType<string>()
  .with({ tag: "Pending" }, () => "awaiting")
  ...
```

`.returnType<T>()` fixes the result type up front, so a handler returning
the wrong type is an error at that handler rather than a confusing union
at the end. Worth using whenever the arms are non-trivial.

## Where `.otherwise()` is legitimate

1. **A transition table**, where every unlisted pair is one outcome:
   an illegal transition. Enumerating them would be noise.
2. **Matching a value from outside the type system**, such as a parsed
   payload, where the fallback is a named parse error.
3. **A genuinely open set**, such as a dispatch table loaded from
   configuration, where a coverage test replaces the compiler's check.

Everywhere else, `.otherwise()` is a silenced compile error. See
[applying-solid-functionally](../../applying-solid-functionally/SKILL.md)
for choosing between a closed union and an open dispatch.

## Interaction with the design rules

- **Exhaustiveness is the reason to model with choice types.** Reaching
  for `.otherwise()` removes the benefit that justified the modelling
  work.
- **Match on types, not on strings.** If the pattern is a string
  literal from a `status` field, the type is wrong. See
  [modeling-state-machines](../../modeling-state-machines/SKILL.md).
- **One match per decision.** Two matches over the same value in one
  function usually means the second belongs in the first's handlers.
- **Handlers call named functions.** A match is a dispatch table; the
  work belongs in functions with names a domain expert would recognise.
