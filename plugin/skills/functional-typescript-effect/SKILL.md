---
name: functional-typescript-effect
description: Use when applying functional design in a TypeScript project built on the Effect library, including services, layers, schema boundaries, and tagged errors.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
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

**Check the installed version before writing code.** Read the major of
`effect` from the lock file or from `node_modules/effect/package.json`.
The examples in this file hold on Effect 3 and on Effect 4. The three
references are written for Effect 3. On Effect 4, read
[effect-4.md](references/effect-4.md) first, and then the package's own
`AGENTS.md`.

## When to use

- A TypeScript project that already depends on Effect
- Deciding how to express a handler, a service, or an error in Effect
- Reviewing Effect code against the core design rules

Not for: TypeScript without Effect, which has
[functional-typescript](../functional-typescript/SKILL.md).

## Notation mapping

| Neutral notation      | Effect                                           |
| --------------------- | ------------------------------------------------ |
| `A -> B`              | A plain function; keep it plain                  |
| `Result<T, E>`        | `Either` on 3, `Result` on 4                     |
| `Option<T>`           | `Option<T>`                                      |
| `AsyncResult<T, E>`   | `Effect<T, E>`                                   |
| A declared dependency | A service class, provided by a `Layer`           |
| Choice type           | Discriminated union, or `Data.TaggedEnum`        |
| Single-case wrapper   | `Schema.brand`                                   |
| `>=>` composition     | `Effect.flatMap` in a `pipe`, or `Effect.gen`    |
| Boundary parse        | `decodeUnknown` on 3, `decodeUnknownEffect` on 4 |
| Exhaustive match      | `Match.exhaustive`                               |

## Core rules

1. Rule. **Keep pure functions pure.** A calculation that needs nothing from the
   world is a plain function, not an `Effect`. Wrapping it hides that it is free
   of effects.
2. Rule. **Put every expected failure in the error channel**, as a tagged error,
   never as a thrown exception. A pure function that can refuse has no error
   channel: it returns `Either` on 3 or `Result` on 4, and rule 1 keeps it
   plain.
3. Default. **Declare dependencies as services**; let the requirements channel
   accumulate them, and provide layers only at the edge. Services are for
   handlers: a handler yields one to read or to write, and hands what it read to
   plain functions as values. A service is narrow, two or three related
   operations, which is this library's form of one function type for each
   capability. A single capability that one handler uses is simpler still as a
   plain function parameter, with no service and no layer.
4. Rule. **Parse at the boundary with a schema**, producing branded domain
   types, and never let the encoded shape inward.
5. Default. **One error union per handler**, built from tagged errors, handled
   with `catchTag` or `catchTags`. It is the handler's failure type. A pure
   workflow that the handler calls has one choice type of its own for its
   errors, returned in the `Either` or `Result` of rule 2 and discriminated by
   `_tag`, as every union in an Effect codebase is.
6. Rule. **Acquire resources with a scope**, so release happens on every path.
7. Rule. **Run the effect once, at the edge.** `runPromise` belongs in the
   composition root, not in domain code. A test is a program of its own and
   runs its own.

## Pattern

```ts
import { Data, Effect, Layer, Schema } from "effect";

// errors: tagged, matchable, in the signature
class SlotUnavailable extends Data.TaggedError("SlotUnavailable")<{
  readonly slot: SlotId;
}> {}

class PatientNotFound extends Data.TaggedError("PatientNotFound")<{
  readonly patient: PatientId;
}> {}

// dependencies the handler declares in the domain's words: `Patients`,
// a service that finds a patient, and `Slots`, a service that holds and
// releases slots; `find` fails with `PatientNotFound` and `hold` with
// `SlotUnavailable`

// the handler: success, failure, and requirements are all in the type
const handleBookAppointment = (
  cmd: BookAppointment,
): Effect.Effect<
  Appointment,
  PatientNotFound | SlotUnavailable,
  Patients | Slots
> =>
  Effect.gen(function* () {
    const patients = yield* Patients;
    const slots = yield* Slots;
    const patient = yield* patients.find(cmd.patient); // read
    const fee = feeFor(patient.category); // decide: plain, stays plain
    const hold = yield* slots.hold(cmd.slot); // write
    return confirm(hold, fee);
  });
```

The signature states the whole contract: what it produces, how it fails,
and what it needs. It reads the patient, works out the fee with a plain
function, and writes by holding the slot; the appointment it returns is
built from that hold. That is the handler of
[functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
with the compiler checking what it needs. The decisions it calls are
plain functions, and stay plain. Two services are declared here to show
the form a service takes;
[layers-and-services.md](references/layers-and-services.md) says when a
handler this small does without them.

Declaring a service is the one part of this example that differs by
major. [layers-and-services.md](references/layers-and-services.md) shows
`Slots` on Effect 3, and [effect-4.md](references/effect-4.md) shows it
on Effect 4; `Patients` is declared the same way.

## Providing dependencies

```ts
const SlotsLive = Layer.effect(
  Slots,
  Effect.gen(function* () {
    const pool = yield* Database;
    return {
      hold: (slot) => holdInDb(pool, slot),
      release: (hold) => releaseInDb(pool, hold),
    };
  }),
);

// the composition root, at the edge
const main = handleBookAppointment(cmd).pipe(
  Effect.provide(
    Layer.mergeAll(PatientsLive, SlotsLive).pipe(
      Layer.provide(DatabaseLive),
    ),
  ),
  Effect.runPromise,
);
```

A test provides a different layer built from plain values, with no
mocking framework. See
[layers-and-services.md](references/layers-and-services.md).

## Handling errors

```ts
handleBookAppointment(cmd).pipe(
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
outside the code — config, tenant, admin — reach for a `Schema.Record`
keyed by `FieldKey`, with `Schema.Unknown` values, behind a branded
wrapper, rather than generating a union of every field. On Effect 3
that is `Schema.Record({ key: FieldKey, value: Schema.Unknown })`, and
[effect-4.md](references/effect-4.md) has the Effect 4 form. The envelope
stays fully modelled either way. See
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md).

## Red flags

- `Effect.runSync` or `runPromise` outside the composition root or a
  test
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
- **Losing the error type.** `Effect.orDie`, and a catch-all handler that
  returns a generic error, erase the information the channel exists to
  carry.
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

- [functional-parameterizing-dependencies](../functional-parameterizing-dependencies/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)
- [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)

## Further reading

- [effect-basics.md](references/effect-basics.md) covers the effect type,
  composition, tagged errors, and running at the edge.
- [layers-and-services.md](references/layers-and-services.md) covers
  services, layers, and testing without mocks.
- [schema-boundaries.md](references/schema-boundaries.md) covers parsing,
  branding, and keeping encoded shapes outside.
- [effect-4.md](references/effect-4.md) covers what differs on Effect 4:
  the names that changed, and the shapes that moved with them.
