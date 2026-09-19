---
name: functional-typescript-effect
description: Use when applying functional design in a TypeScript project built on the Effect library, including services, layers, schema boundaries, and tagged errors.
---

# Functional TypeScript With Effect

## Overview

Effect provides in a library what the core skills describe as design
rules: an effect type that carries success, failure, and requirements in
its signature; a service and layer system that is dependency
parameterization with type checking; schemas that parse boundaries into
domain types; and structured concurrency with scoped resources.

The design rules do not change. What changes is that the compiler now
enforces most of them, including which dependencies a piece of code
needs, which is the one thing plain TypeScript cannot check.

**Check the installed version before writing code.** Effect's API has
changed across major versions; the shapes below target Effect 3.

## When to use

- A TypeScript project that already depends on Effect
- Deciding how to express a workflow, a service, or an error in Effect
- Reviewing Effect code against the core design rules

Not for: TypeScript without Effect, which has
[functional-typescript](../functional-typescript/SKILL.md).

## Notation mapping

| Neutral notation      | Effect                                        |
| --------------------- | --------------------------------------------- |
| `A -> B`              | A plain function; keep it plain               |
| `Result<T, E>`        | `Either<T, E>`, or `Effect<T, E>`             |
| `Option<T>`           | `Option<T>`                                   |
| `AsyncResult<T, E>`   | `Effect<T, E>`                                |
| A declared dependency | `Context.Tag`, provided by a `Layer`          |
| Choice type           | Discriminated union, or `Data.TaggedEnum`     |
| Single-case wrapper   | `Schema.brand`                                |
| `>=>` composition     | `Effect.flatMap` in a `pipe`, or `Effect.gen` |
| Boundary parse        | `Schema.decodeUnknown`                        |
| Exhaustive match      | `Match.exhaustive`                            |

## Core rules

1. **Keep pure functions pure.** A calculation that needs nothing from
   the world is a plain function, not an `Effect`. Wrapping it hides that
   it is free of effects.
2. **Put every failure in the error channel**, as a tagged error, never
   as a thrown exception.
3. **Declare dependencies as services**; let the requirements channel
   accumulate them, and provide layers only at the edge.
4. **Parse at the boundary with a schema**, producing branded domain
   types, and never let the encoded shape inward.
5. **One error union per workflow**, built from tagged errors, handled
   with `catchTag` or `catchTags`.
6. **Acquire resources with a scope**, so release happens on every path.
7. **Run the effect once, at the edge.** `runPromise` belongs in the
   composition root, not in domain code.

## Pattern

```ts
import { Context, Data, Effect, Layer, Schema } from "effect";

// errors: tagged, matchable, in the signature
class SlotUnavailable extends Data.TaggedError("SlotUnavailable")<{
  readonly slot: SlotId;
}> {}

class PatientNotFound extends Data.TaggedError("PatientNotFound")<{
  readonly patient: PatientId;
}> {}

// a dependency, declared by the domain in the domain's words
class Slots extends Context.Tag("Slots")<
  Slots,
  {
    readonly hold: (slot: SlotId) => Effect.Effect<SlotHold, SlotUnavailable>;
  }
>() {}

// the workflow: success, failure, and requirements are all in the type
const bookAppointment = (
  cmd: BookAppointment,
): Effect.Effect<Appointment, SlotUnavailable | PatientNotFound, Slots> =>
  Effect.gen(function* () {
    const slots = yield* Slots;
    const hold = yield* slots.hold(cmd.slot);
    const fee = feeFor(cmd.category); // plain function, stays plain
    return confirm(hold, fee);
  });
```

The signature states the whole contract: what it produces, how it fails,
and what it needs. That is
[designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
with the compiler checking it.

## Providing dependencies

```ts
const SlotsLive = Layer.effect(
  Slots,
  Effect.gen(function* () {
    const pool = yield* Database;
    return { hold: (slot) => holdInDb(pool, slot) };
  }),
);

// the composition root, at the edge
const main = bookAppointment(cmd).pipe(
  Effect.provide(SlotsLive.pipe(Layer.provide(DatabaseLive))),
  Effect.runPromise,
);
```

A test provides a different layer built from plain values, with no
mocking framework. See
[layers-and-services.md](references/layers-and-services.md).

## Handling errors

```ts
booking.pipe(
  Effect.catchTags({
    SlotUnavailable: (e) => Effect.succeed(suggestAlternatives(e.slot)),
    PatientNotFound: () => Effect.fail(new BadRequest()),
  }),
);
```

`catchTags` narrows the error channel, so the remaining type shows
exactly which failures are still possible.

## Schema covers both routes

`Schema` is unusual in giving you both schools from one declaration: it
is a value you can compose, transform, and introspect, and it also
produces a static type. Where other stacks force a choice, here the
schema _is_ the separated schema and the type at once.

The default is still to model the shape. When a field set is decided
outside the code — config, tenant, admin — reach for
`Schema.Record({ key: FieldKey, value: Schema.Unknown })` behind a
branded wrapper rather than generating a union of every field. The
envelope stays fully modelled either way. See
[choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md).

## Red flags

- `Effect.runSync` or `runPromise` outside the composition root
- A pure calculation wrapped in `Effect.succeed` for uniformity
- `Effect.die`, or a thrown exception, for an expected failure
- `any` in an effect's error channel, or errors typed as `Error`
- A service interface with a dozen members
- A schema's encoded type used inside the domain
- `Effect.provide` inside a domain module
- Errors flattened to strings before they reach the edge

## Common mistakes

- **Wrapping everything.** Effect is for what touches the world. A
  pricing calculation with no dependencies should have no `Effect` in its
  type.
- **Losing the error type.** `Effect.orDie` and `catchAll` returning a
  generic error erase the information the channel exists to carry.
- **Providing layers deep inside.** Requirements should accumulate
  upward and be satisfied once.
- **Using `Schema` types as domain types.** The decoded type is a good
  domain type; the encoded one is a DTO. Keep the distinction. See
  [schema-boundaries.md](references/schema-boundaries.md).
- **Mixing `Effect.gen` and long `pipe` chains arbitrarily.** Pick one
  per module.
- **Reimplementing what the library provides.** Retry, timeout,
  concurrency limits, and resource scoping are already there and are
  easy to get wrong by hand.

## Related skills

- [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)

## Further reading

- [effect-basics.md](references/effect-basics.md) covers the effect type,
  composition, tagged errors, and running at the edge.
- [layers-and-services.md](references/layers-and-services.md) covers
  services, layers, and testing without mocks.
- [schema-boundaries.md](references/schema-boundaries.md) covers parsing,
  branding, and keeping encoded shapes outside.
