---
name: functional-typescript
description: Use when applying functional design in TypeScript without a functional library, including branded types, discriminated unions, and hand-rolled Result.
---

# Functional TypeScript

## Overview

TypeScript's type system can express nearly everything the core skills
ask for: discriminated unions give choice types, branded types give
single-case wrappers, and exhaustiveness checking through `never` turns a
missed case into a compile error.

What it does not do by default is stop you opting out. The value of this
pack depends on a strict configuration and on a few habits that keep the
escape hatches closed.

## When to use

- A TypeScript project using the standard library only
- Deciding how to express a domain type, a Result, or a pipeline
- Reviewing TypeScript against the core design rules

Not for: projects built on Effect, which have
[functional-typescript-effect](../functional-typescript-effect/SKILL.md);
or ts-pattern matching, which has
[functional-typescript-ts-pattern](../functional-typescript-ts-pattern/SKILL.md).

## Notation mapping

| Neutral notation    | TypeScript                                          |
| ------------------- | --------------------------------------------------- |
| Record type         | `type X = { readonly a: A }`                        |
| Choice type         | Discriminated union on a literal field              |
| Single-case wrapper | Branded type plus a parser                          |
| `Option<T>`         | `T \| undefined`, or a `Maybe` union                |
| `Result<T, E>`      | `{ ok: true; value: T } \| { ok: false; error: E }` |
| `NonEmptyList<T>`   | `readonly [T, ...T[]]`                              |
| `A -> B -> C`       | `(a: A) => (b: B) => C`                             |
| `Async<T>`          | `Promise<T>`                                        |
| Exhaustive match    | `switch` with a `never` check                       |

## Configuration first

None of this works without these compiler options:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "erasableSyntaxOnly": true
}
```

`strict` is the minimum. `noUncheckedIndexedAccess` is what stops
`array[0]` claiming to be defined, which is the most common source of
runtime undefined in otherwise well-typed code.

## Core rules

1. **`readonly` everywhere in domain types**, including array fields:
   `readonly BookedTreatment[]`.
2. **Brand every domain primitive**, and export only the parser.
3. **Discriminate unions on a literal field**, one field name across the
   codebase.
4. **Exhaust with `never`**, never with a permissive `default`.
5. **No `any`, no non-null `!`, no unchecked `as`.** Each is a hole in
   every guarantee above it.
6. **Return `Result`, do not throw**, for expected failures.
7. **Type the boundary separately.** DTO types are their own types, with
   a parse step between them and the domain.

## Pattern

```ts
// money.ts
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type Satang = Brand<number, "Satang">;

export const satang = (n: number): Result<Satang, RangeError> =>
  Number.isInteger(n) && n >= 0
    ? ok(n as Satang)
    : err({ tag: "NotSatang", value: n });
```

```ts
// payment.ts
export type Payment =
  | { readonly tag: "Cash" }
  | { readonly tag: "Card"; readonly number: CardNumber }
  | { readonly tag: "Transfer"; readonly bank: BankCode };

export const describe = (p: Payment): string => {
  switch (p.tag) {
    case "Cash":
      return "cash";
    case "Card":
      return maskCard(p.number);
    case "Transfer":
      return p.bank;
    default:
      return assertNever(p);
  }
};

const assertNever = (x: never): never => {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
};
```

Adding a case to `Payment` makes `assertNever` a compile error at every
site that must be updated. That is the mechanism the core skills rely on;
protect it by never writing a permissive `default`.

## Result

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map =
  <T, U>(f: (t: T) => U) =>
  <E>(r: Result<T, E>): Result<U, E> =>
    r.ok ? ok(f(r.value)) : r;

export const bind =
  <T, U, E2>(f: (t: T) => Result<U, E2>) =>
  <E>(r: Result<T, E>): Result<U, E | E2> =>
    r.ok ? f(r.value) : r;
```

`bind` widening the error to `E | E2` is what lets a pipeline accumulate
its failure type honestly. More in
[result-type.md](references/result-type.md).

## Parsing at the boundary

Hand-written parsers are fine for a handful of types. Past that, a schema
library is the usual answer, and the rule that matters is which type it
produces.

```ts
// the schema's inferred type is the DTO, not the domain type
const BookingDto = z.object({
  id: z.string().uuid(),
  treatments: z.array(BookedTreatmentDto).nonempty(),
  status: z.enum(["draft", "placed", "cancelled"]),
});

// one mapping into the domain, where the guarantees live
const toBooking = (dto: z.infer<typeof BookingDto>): Result<Booking, MapError> =>
  ...;
```

Letting the inferred type _be_ the domain model reintroduces every wire
compromise: nullable fields, string enums, plain arrays. Some libraries
can brand and constrain enough to close most of that gap; see
[schema-libraries.md](references/schema-libraries.md) for which, and for
how the four common choices compare.

## When not to model a shape

TypeScript's type system is good enough that the default is unambiguous:
model the shape. The exception is narrow and worth knowing, because
getting it wrong produces the worst kind of type — one with every field
optional.

When the field set comes from config, varies per tenant, or is decided by
an admin, there is no compile-time set of cases to model. Use
`Record<FieldKey, JsonValue>` behind a parsed wrapper, keep the envelope
around it fully typed, and pay the costs listed in
[choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md).
Reach for `z.record()` rather than a generated union of every field any
customer has ever added.

## Red flags

- `any`, `as any`, `@ts-ignore`, or `@ts-expect-error` in domain code
- The non-null assertion `!`
- `as` used to construct a branded value outside its module
- A `default` branch that returns a value instead of `assertNever`
- `enum` used where a union of string literals would do
- Mutable array or object fields in a domain type
- `interface` for a domain value, which is open to declaration merging
- A DTO type reused as a domain type

## Common mistakes

- **Branding without a parser.** A brand you can cast into is
  documentation, not a guarantee. Export the parser, not the cast.
- **`Partial<T>` for a draft.** Give the draft its own type with its own
  rules. See
  [when-to-validate-instead.md](../making-illegal-states-unrepresentable/references/when-to-validate-instead.md).
- **`unknown` left unnarrowed at the boundary.** Parse it into a domain
  type immediately.
- **Structural typing collisions.** Two unbranded types with the same
  shape are the same type to the compiler.
- **`readonly` only at the top level.** `readonly treatments: BookedTreatment[]`
  still allows `treatments.push`.
- **Using exceptions for expected failures**, then catching `unknown` and
  guessing.

## Related skills

- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [constraining-primitive-values](../constraining-primitive-values/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)

## Further reading

- [branded-types.md](references/branded-types.md) covers brands, parsers,
  and keeping the cast private.
- [unions-and-exhaustiveness.md](references/unions-and-exhaustiveness.md)
  covers discriminated unions, narrowing, and state machines.
- [result-type.md](references/result-type.md) covers the Result helpers,
  async, and boundary conversion.
- [schema-libraries.md](references/schema-libraries.md) compares Zod,
  Valibot, ArkType and TypeBox for boundary parsing.
