# Services and Layers

The code on this page is Effect 3, and [effect-4.md](effect-4.md) has
what differs on 4.

A service is a declared dependency; a layer is how one is built. Together
they are dependency parameterization with the compiler tracking which
dependencies each piece of code needs.

## Contents

- [Declaring a service](#declaring-a-service)
- [Using a service](#using-a-service)
- [Building a layer](#building-a-layer)
- [Composing layers](#composing-layers)
- [Providing, once, at the edge](#providing-once-at-the-edge)
- [Testing without mocks](#testing-without-mocks)
- [Configuration](#configuration)
- [When a service is too much](#when-a-service-is-too-much)

## Declaring a service

```ts
class Slots extends Context.Tag("Slots")<
  Slots,
  {
    readonly hold: (slot: SlotId) => Effect.Effect<SlotHold, SlotUnavailable>;
    readonly release: (hold: SlotHold) => Effect.Effect<void>;
  }
>() {}
```

Two rules from the core skills apply unchanged:

1. **Declare it beside the handler that uses it, in the domain's
   words.** `Slots`, not `SlotRepository`. The handler says what it
   needs; the composition root satisfies it.
2. **Keep it narrow.** Two or three related operations. A service with
   twenty members forces every consumer to depend on all twenty. See
   [lsp-isp-dip.md](../../functional-applying-solid-functionally/references/lsp-isp-dip.md).

Where a dependency is a single operation, a plain function parameter is
still the simplest thing and needs no service at all.

## Using a service

The handler below also uses `Patients`, a second service declared the
same way, whose one operation, `find`, fails with `PatientNotFound`.

```ts
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

The requirements channel accumulates automatically as more services are
used, so the signature always states the full dependency set. That is
the check plain TypeScript cannot perform.

## Building a layer

```ts
// from a value
const ClockTest = Layer.succeed(Clock, {
  now: Effect.succeed(fixedInstant),
});

// from an effect that itself needs services
const SlotsLive = Layer.effect(
  Slots,
  Effect.gen(function* () {
    const db = yield* Database;
    return {
      hold: (slot) => holdInDb(db, slot),
      release: (hold) => releaseInDb(db, hold),
    };
  }),
);

// from a resource that must be released
const DatabaseLive = Layer.scoped(
  Database,
  Effect.acquireRelease(openPool, closePool),
);
```

A handler yields `Clock` once for the command it carries out and passes
the instant on. No function that decides asks for the time.

## Composing layers

```ts
const AppLive = Layer.mergeAll(
  SlotsLive.pipe(Layer.provide(DatabaseLive)),
  PatientsLive.pipe(Layer.provide(DatabaseLive)),
  ClockLive,
);
```

`Layer.provide` satisfies one layer's requirements with another. Layers
are memoised, so `DatabaseLive` appearing twice builds one pool.

The composed layer is the composition root: reading it tells you the
system's whole dependency graph in one place, which is exactly what the
core skill asks for. See
[strategies.md](../../functional-parameterizing-dependencies/references/strategies.md).

## Providing, once, at the edge

```ts
const main = handleRequest(req).pipe(
  Effect.provide(AppLive),
  Effect.runPromise,
);
```

`Effect.provide` inside a domain module defeats the requirements channel:
the dependency disappears from the signature and can no longer be varied
by a caller or a test.

## Testing without mocks

A test layer is a plain value.

```ts
const SlotsTest = Layer.succeed(Slots, {
  hold: (slot) =>
    slot === takenSlot
      ? Effect.fail(new SlotUnavailable({ slot }))
      : Effect.succeed(testHold),
  release: () => Effect.void,
});

const PatientsTest = Layer.succeed(Patients, {
  find: () => Effect.succeed(testPatient),
});

it("fails with SlotUnavailable when the slot is taken", () =>
  handleBookAppointment(cmdForTakenSlot).pipe(
    Effect.provide(Layer.mergeAll(PatientsTest, SlotsTest)),
    Effect.flip,
    Effect.map((e) => expect(e._tag).toBe("SlotUnavailable")),
    Effect.runPromise,
  ));
```

No mocking framework, no verification of calls, and the compiler checks
that the test layer implements the service completely. That is the
payoff described in
[functional-testing-functional-code](../../functional-testing-functional-code/SKILL.md).

Keep one shared test layer per service, maintained as real code, and
consider a contract test that runs the same assertions against both the
test layer and the live one. See
[testing-the-shell.md](../../functional-testing-functional-code/references/testing-the-shell.md).

## Configuration

```ts
const ServerConfig = Config.all({
  port: Config.integer("PORT").pipe(Config.withDefault(3000)),
  timeout: Config.duration("TIMEOUT"),
});
```

Read configuration once, at the edge, into typed values, and pass those
into the layers. A domain module that reads an environment variable has
an invisible input.

## When a service is too much

What a decision needs is usually a value, and then nothing is injected at
all: the handler reads the catalogue and passes it.

```ts
const priceBooking =
  (catalogue: Catalogue) =>
  (booking: ValidatedBooking): Either.Either<PricedBooking, PricingError> => {
    const fee = catalogue.prices.get(booking.treatmentCode);
    return fee === undefined
      ? Either.left({
          _tag: "TreatmentNotFound",
          code: booking.treatmentCode,
        })
      : Either.right({ ...booking, fee });
  };
```

No `Effect`, no service, no layer, and the function stays pure. Reach for
a service when several handlers share the capability, when a path needs
a stub, or when what it holds has to be released.

A handler that reads once and writes once has no path worth a stub, and
rule 2 of
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md)
gives it no capability of its own: it yields `Database` and calls its
adapters by name. `handleBookAppointment` on this page is that small. It
declares `Patients` and `Slots` to show the form a service takes, and a
handler earns that form when another handler shares the service or a
path of its own needs a stub.
