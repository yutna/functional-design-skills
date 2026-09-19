# Services and Layers

A service is a declared dependency; a layer is how one is built. Together
they are dependency parameterization with the compiler tracking which
dependencies each piece of code needs.

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

1. **Declare it in the domain, in the domain's words.** `Slots`, not
   `SlotRepository`. The domain says what it needs; the shell satisfies
   it.
2. **Keep it narrow.** Two or three related operations. A service with
   twenty members forces every consumer to depend on all twenty. See
   [lsp-isp-dip.md](../../applying-solid-functionally/references/lsp-isp-dip.md).

Where a dependency is a single operation, a plain function parameter is
still the simplest thing and needs no service at all.

## Using a service

```ts
const bookAppointment = (cmd: BookAppointment) =>
  Effect.gen(function* () {
    const slots = yield* Slots;
    const hold = yield* slots.hold(cmd.slot);
    return confirm(hold);
  });
// Effect<Appointment, SlotUnavailable, Slots>
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
[strategies.md](../../parameterizing-dependencies/references/strategies.md).

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

it("suggests alternatives when the slot is taken", () =>
  bookAppointment(cmdForTakenSlot).pipe(
    Effect.provide(SlotsTest),
    Effect.flip,
    Effect.map((e) => expect(e._tag).toBe("SlotUnavailable")),
    Effect.runPromise,
  ));
```

No mocking framework, no verification of calls, and the compiler checks
that the test layer implements the service completely. That is the
payoff described in
[testing-functional-code](../../testing-functional-code/SKILL.md).

Keep one shared test layer per treatment, maintained as real code, and
consider a contract test that runs the same assertions against both the
test layer and the live one. See
[testing-the-shell.md](../../testing-functional-code/references/testing-the-shell.md).

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

A single capability used by one workflow is often better as a plain
function parameter:

```ts
const priceBooking =
  (getPrice: (c: TreatmentCode) => Money) =>
  (booking: ValidatedBooking): PricedBooking => ...
```

No `Effect`, no service, no layer, and the function stays pure. Reach for
a service when the capability is effectful, used in several places, or
needs to be resourceful.
