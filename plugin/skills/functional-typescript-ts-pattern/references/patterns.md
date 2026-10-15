# Pattern Vocabulary

## Contents

- [The shape of a match](#the-shape-of-a-match)
- [Literal and structural patterns](#literal-and-structural-patterns)
- [Wildcards](#wildcards)
- [Combinators](#combinators)
- [Guards](#guards)
- [Selection](#selection)
- [Typing the result](#typing-the-result)
- [Where `.otherwise()` is legitimate](#where-otherwise-is-legitimate)
- [Interaction with the design rules](#interaction-with-the-design-rules)

## The shape of a match

```text
match(value).with(pattern, arm).with(pattern, arm).exhaustive();
```

Patterns are tried in order. `.exhaustive()` fails to compile if any
possible value of the input type is unmatched, and throws at runtime if
one arrives anyway. That throw is the crash for a bug, a value that
broke its type's promise. A value from outside is parsed before it is
matched as a domain type.

`.otherwise(arm)` and `.run()` end a match without the check. Reserve
them for the cases described below.

The sections that follow show patterns one `.with` at a time and leave
the ending off. A real match always has one.

## Literal and structural patterns

```ts
match(shipment)
  .with({ tag: "Pending" }, arm)                  // discriminant
  .with({ tag: "Failed", reason: "Lost" }, arm);  // and a literal

match(booking)
  .with({ lifecycle: { tag: "Cancelled" } }, arm); // nested

match([quote, command] as const)
  .with([{ tag: "Draft" }, { tag: "Send" }], arm); // tuple
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
| `P.any`     | Anything, same as `P._`  |

In domain code, `P._` as a final catch-all is the same mistake as a
permissive `default`. It is useful inside a larger pattern, to say "this
field can be anything".

## Combinators

```ts
// one match each, so no arm hides the next
match(quote).with({ tag: P.union("Draft", "Sent") }, arm);
match(quote).with({ tag: P.not("Draft") }, arm);
match(booking).with({ treatments: P.array({ minutes: P.number }) }, arm);
match(booking).with({ note: P.optional(P.string) }, arm);
```

`P.array(p)` matches when every element matches `p`. To match on the
array's length or on specific positions, use a tuple pattern or a guard.

## Guards

```ts
match(booking)
  .with({ total: P.when((t) => t > LARGE_BOOKING) }, arm)
  .when((b) => isAfterCutoff(b.confirmedAt), arm)
```

Two forms: `P.when` inside a pattern, and `.when` as a whole-value guard.
Keep both to one line. A guard that applies a rule the business would
state compares with a named constant or calls a named predicate, defined
beside the domain type, so it can be tested and reused.

Guards do not participate in the exhaustiveness check: a match made only
of guarded patterns cannot be proven exhaustive, and will need
`.otherwise()`. Dispatch on structure first, and use guards only to
refine within a case.

## Selection

```ts
match(shipment)
  .with({ tag: "Failed", reason: P.select() }, (r) => `failed: ${r}`)
  .with(
    { tag: "Delivered", tracking: P.select("t"), deliveredAt: P.select("at") },
    ({ t, at }) => `${t} arrived ${format(at)}`,
  )
```

An unnamed `P.select()` passes the matched part as the arm's argument;
named selects arrive as an object. Selecting is clearer than
destructuring the whole value when the arm needs one or two fields from
deep inside.

## Typing the result

```ts
match(shipment)
  .returnType<string>()
  .with({ tag: "Pending" }, () => "awaiting")
  // ... one arm per tag, then .exhaustive()
```

`.returnType<T>()` fixes the result type up front, so an arm returning
the wrong type is an error at that arm rather than a confusing union
at the end. Worth using whenever the arms are non-trivial.

## Where `.otherwise()` is legitimate

1. **A transition table**, where every unlisted pair is one outcome:
   an illegal transition. Enumerating them would be noise.
2. **Parsing a value from outside the type system.** The match is the
   parser, its input is `unknown`, and the fallback is the parser's
   named error.
3. **A genuinely open set**, such as a dispatch table loaded from
   configuration, where a coverage test replaces the compiler's check.

Neither of the last two is a match over a choice type, so rule 4 of
[functional-modeling-with-algebraic-types](../../functional-modeling-with-algebraic-types/SKILL.md)
does not reach them.

Everywhere else, `.otherwise()` is a silenced compile error. See
[functional-applying-solid-functionally](../../functional-applying-solid-functionally/SKILL.md)
for choosing between a closed union and an open dispatch.

## Interaction with the design rules

- **Exhaustiveness is the reason to model with choice types.** Reaching
  for `.otherwise()` removes the benefit that justified the modelling
  work.
- **Match on types, not on strings.** If the pattern is a string
  literal from a `status` field, the type is wrong. See
  [functional-modeling-state-machines](../../functional-modeling-state-machines/SKILL.md).
- **One match per decision.** Two matches over the same value in one
  function usually means the second belongs in the first's arms.
- **Arms call named functions.** A match is a dispatch table; the
  work belongs in functions with names a domain expert would recognise.
