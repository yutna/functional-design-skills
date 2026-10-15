# Effect 4: What Differs

Targets Effect 4, checked against 4.0.2. The other three references are
written for Effect 3 and carry the design guidance. This page carries
only what changes on 4, and links to them for the reasoning. Verify
against the installed version before writing code.

## Contents

- [Names that changed](#names-that-changed)
- [Declaring a service and building its layer](#declaring-a-service-and-building-its-layer)
- [A layer for a resource that must be released](#a-layer-for-a-resource-that-must-be-released)
- [A schema with branding and constraints](#a-schema-with-branding-and-constraints)
- [Decoding and encoding](#decoding-and-encoding)
- [Unions](#unions)
- [Custom transformations](#custom-transformations)
- [A round-trip property test](#a-round-trip-property-test)
- [The synchronous result type](#the-synchronous-result-type)
- [Retry with a schedule](#retry-with-a-schedule)
- [Configuration](#configuration)
- [The package's own documentation](#the-packages-own-documentation)

## Names that changed

Each entry gives an Effect 3 name, then what replaces it. All but the
catch-all handler appear on the other pages, and every other name those
pages use is still there on 4.0.2.

```text
Context.Tag("X")<X, S>()       Context.Service<X, S>()("X")
Layer.scoped(tag, effect)      Layer.effect(tag, effect)
Effect.catchAll                Effect.catch
Either.Either<A, E>            Result.Result<A, E>
Either.right(a)                Result.succeed(a)
Either.left(e)                 Result.fail(e)
s.pipe(Schedule.compose(t))    Schedule.max([s, t])
Config.integer("N")            Config.Int("N")
Config.duration("N")           Config.Duration("N")
Schema.decodeUnknown(S)        Schema.decodeUnknownEffect(S)
Schema.decodeUnknownEither(S)  Schema.decodeUnknownResult(S)
Schema.encode(S)               Schema.encodeEffect(S)
ParseError                     Schema.SchemaError
Schema.Schema.Encoded<S>       typeof S["Encoded"]
Schema.pattern(re)             Schema.check(Schema.isPattern(re))
Schema.between(a, b)           Schema.check(Schema.isBetween({
                                 minimum: a, maximum: b }))
Schema.nonNegative()           Schema.check(
                                 Schema.isGreaterThanOrEqualTo(0))
Schema.trimmed()               Schema.isTrimmed()
Schema.compose(T)              Schema.decodeTo(T)
Schema.Uppercase               Schema.decode with a SchemaGetter
Schema.transformOrFail(        Schema.decodeTo(to, { decode, encode })
  to, { decode, encode })        with getters from SchemaGetter
ParseResult                    SchemaGetter and SchemaIssue
Schema.Union(a, b)             Schema.Union([a, b])
Schema.Record({ key, value })  Schema.Record(key, value)
Arbitrary.make(S)              Arbitrary.schema(S)
FastCheck                      no replacement; not re-exported
```

`Schema.encode` and `Schema.decode` are still there and mean something
else: they take a transformation, so a schema passed to either does not
compile.

## Declaring a service and building its layer

A service is a class that extends `Context.Service`. The first type
argument is the class itself, the second is its interface, and the
string is the key the service is stored under. The package's own
examples write the key as a path, such as `myapp/db/Database`, because
two services with one key occupy one slot. What a service should declare
is in [layers-and-services.md](layers-and-services.md) and does not
change. `yield* Slots` reads the service as before, and `Slots.of`
checks an object against the interface.

```ts
import { Context, Data, Effect, Layer } from "effect";

class SlotUnavailable extends Data.TaggedError("SlotUnavailable")<{
  readonly slot: SlotId;
}> {}

class Slots extends Context.Service<Slots, {
  readonly hold: (slot: SlotId) => Effect.Effect<SlotHold, SlotUnavailable>;
  readonly release: (hold: SlotHold) => Effect.Effect<void>;
}>()("clinic/Slots") {}

const SlotsLive = Layer.effect(
  Slots,
  Effect.gen(function* () {
    const db = yield* Database;
    return Slots.of({
      hold: (slot) => holdInDb(db, slot),
      release: (hold) => releaseInDb(db, hold),
    });
  }),
);
```

## A layer for a resource that must be released

There is no separate constructor for a scoped layer. `Layer.effect`
takes an effect that needs a `Scope`, removes `Scope` from the layer's
requirements, and closes the scope when the layer is torn down. The pool
below is opened when the layer is built and closed when it is torn down,
and `DatabaseLive` needs nothing.

```ts
const DatabaseLive = Layer.effect(
  Database,
  Effect.acquireRelease(openPool, closePool),
);
```

## A schema with branding and constraints

A constraint is a check passed to `Schema.check`, and the checks are
named `is...`: `Schema.isPattern`, `Schema.isBetween`, and
`Schema.isTrimmed`. `Schema.check` is also a method, as in
`Schema.String.check(Schema.isTrimmed())`. A check rejects a value and
never changes it. `Schema.Trim` changes it, and `Schema.isTrimmed` only
rejects a padded string, as on 3. There is no uppercase schema, so the
code below normalises with `Schema.decode` and two getters from
`SchemaGetter`. The decoded and encoded types are `typeof Booking["Type"]`
and `typeof Booking["Encoded"]`, and the encoded one stays out of the
domain, as [schema-boundaries.md](schema-boundaries.md) says.

```ts
import { Schema, SchemaGetter } from "effect";

const TreatmentCode = Schema.Trim.pipe(
  Schema.decode({
    decode: SchemaGetter.toUpperCase(),
    encode: SchemaGetter.passthrough(),
  }),
  Schema.check(Schema.isPattern(/^[WG]\d{4}$/)),
  Schema.brand("TreatmentCode"),
);
type TreatmentCode = typeof TreatmentCode["Type"];

const Quantity = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 1000 })),
  Schema.brand("Quantity"),
);
type Quantity = typeof Quantity["Type"];

const BookedTreatment = Schema.Struct({
  code: TreatmentCode,
  quantity: Quantity,
});

const Booking = Schema.Struct({
  id: BookingId,
  treatments: Schema.NonEmptyArray(BookedTreatment),
});
type Booking = typeof Booking["Type"];
type BookingEncoded = typeof Booking["Encoded"];
```

## Decoding and encoding

`Schema.decodeUnknownEffect` and `Schema.encodeEffect` return an
`Effect` that fails with a `Schema.SchemaError`. The options argument
takes `errors: "all"` to report every problem and not the first, as on 3.

```ts
const parseBooking = Schema.decodeUnknownEffect(Booking);
// (input: unknown) => Effect<Booking, Schema.SchemaError>

const toWire = Schema.encodeEffect(Booking);
// (booking: Booking) => Effect<BookingEncoded, Schema.SchemaError>

Schema.decodeUnknownEffect(Booking)(input, { errors: "all" });
```

The same parse, returning the pure result type:

```ts
const parseBookingPure = Schema.decodeUnknownResult(Booking);
// (input: unknown) => Result<Booking, Schema.SchemaError>
```

The pure form is for edge code that has no effect type; the `Effect`
form is for a handler that already has one. Either way the parse is done
at the edge, before a workflow sees the value.

## Unions

`Schema.Union` takes an array of members. `Schema.TaggedStruct` is
unchanged, and an unknown tag from outside is still a parse error and
never a default.

```ts
const Payment = Schema.Union([
  Schema.TaggedStruct("Cash", {}),
  Schema.TaggedStruct("Card", { number: CardNumber }),
  Schema.TaggedStruct("Transfer", { bank: BankCode }),
]);
```

## Custom transformations

A transformation is `Schema.decodeTo(to, { decode, encode })`, applied to
the wire schema. Both halves are getters from `SchemaGetter`.
`SchemaGetter.transform` takes a plain function, and
`SchemaGetter.transformEffect` takes one that returns an `Effect` and may
fail with a `SchemaIssue`. Decoding is the half that reads input from
outside, so it is the half that fails on bad input. Encoding a valid
domain value does not fail.

```ts
import { Effect, Schema, SchemaGetter, SchemaIssue } from "effect";

const Satang = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.brand("Satang"),
);

// "12.50" on the wire, 1250 in the domain.
const SatangFromBaht = Schema.String.pipe(
  Schema.decodeTo(Satang, {
    decode: SchemaGetter.transformEffect((text) => {
      const parts = /^(\d+)\.(\d{2})$/.exec(text);
      return parts
        ? Effect.succeed(Number(parts[1]) * 100 + Number(parts[2]))
        : Effect.fail(
          new SchemaIssue.InvalidValue({ message: "expected 0.00" }, text),
        );
    }),
    encode: SchemaGetter.transform((satang) => (satang / 100).toFixed(2)),
  }),
);
```

## A round-trip property test

`Arbitrary.schema` derives a generator from the decoded type, and
`Arbitrary.checkEffect` runs a property over it. Compare with
`Schema.toEquivalence`, which compares by structure. There is no
`FastCheck` to take a generator from, and `Arbitrary` is marked unstable
in 4.0.2.

```ts
import { Arbitrary, Effect, Schema } from "effect";

const sameBooking = Schema.toEquivalence(Booking);

it("round-trips", () =>
  Arbitrary.checkEffect(Arbitrary.schema(Booking), (booking) =>
    Schema.encodeEffect(Booking)(booking).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Booking)),
      Effect.map((back) => sameBooking(back, booking)),
    ),
  ).pipe(
    Effect.map((result) =>
      expect(Arbitrary.formatCheckFailure(result)).toBe(undefined),
    ),
    Effect.runPromise,
  ));
```

The package ships its own helper for this property,
`TestSchema.Asserts#verifyRoundTrip` in `effect/testing`. On 4.0.2 it
fails for a plain struct schema, because the generators sometimes make
an object with no prototype and its comparison tells that from a plain
object. Prefer the property above.

## The synchronous result type

`Either` is now `Result`, and its success type is still the first
parameter. Use it for validation that needs no dependencies, and
`Effect` once the world is involved, as
[effect-basics.md](effect-basics.md) says.

```ts
import { Data, Result } from "effect";

class NotAQuantity extends Data.TaggedError("NotAQuantity")<{
  readonly value: number;
}> {}

const parseQuantity = (n: number): Result.Result<Quantity, NotAQuantity> =>
  Number.isInteger(n) && n > 0
    ? Result.succeed(n as Quantity)
    : Result.fail(new NotAQuantity({ value: n }));
```

## Retry with a schedule

A backoff and a limit are combined with `Schedule.max`, not by composing
one into the other. It continues only while every schedule in the array
continues, and waits as long as the slowest of them asks. Against a
query that always fails, the schedule below makes four attempts and
waits about 700 milliseconds between them in all, each wait varied by up
to a fifth either way so that clients do not retry in step.

```ts
import { Effect, Schedule } from "effect";

const resilient = query(pool, sql).pipe(
  Effect.retry(
    Schedule.max([
      Schedule.jittered(Schedule.exponential("100 millis")),
      Schedule.recurs(3),
    ]),
  ),
  Effect.timeout("5 seconds"),
);
```

Retry only a transient fault, and only a read or a write that is
idempotent on its key: rule 5 of
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

## Configuration

The constructors are capitalised and named for the type they read:
`Config.Int`, `Config.Duration`, `Config.String`, `Config.Boolean`.
`Config.all` and `Config.withDefault` are unchanged.

```ts
import { Config } from "effect";

const ServerConfig = Config.all({
  port: Config.Int("PORT").pipe(Config.withDefault(3000)),
  timeout: Config.Duration("TIMEOUT"),
});
```

## The package's own documentation

The package documents itself for agents. `node_modules/effect/AGENTS.md`
is the entry point, and `node_modules/effect/ai-docs/src/` holds worked
examples by topic, among them services, schemas, errors, resources,
schedules, and tests. They come with the version that is installed, so
where this page and they disagree, they are right.
