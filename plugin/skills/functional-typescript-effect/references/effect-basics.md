# Effect Basics for Design

Targets Effect 3. Verify against the installed version before writing
code; the type parameter order and several module names changed at the
3.0 boundary.

## The type

```ts
Effect.Effect<Success, Error, Requirements>;
```

Three channels, all in the signature. `Effect<Appointment,
SlotUnavailable, Slots>` says: produces an appointment, may fail with
`SlotUnavailable`, needs the `Slots` service. Nothing else can happen,
which is what makes the signature a real contract.

`Effect<A>` with the other channels defaulted is an effect that cannot
fail and needs nothing.

## Keep pure things pure

```ts
// good: no effect, because there is none
const feeFor = (standard: Money, category: PatientCategory): Money => ...

// bad: uniformity for its own sake
const feeFor = (...): Effect.Effect<Money> => Effect.succeed(...)
```

The core skills' split between pure core and shell shows up here as which
functions have `Effect` in their type. Wrapping everything erases the
distinction the library exists to make visible.

## Composition

Two styles, both fine; choose one per module.

```ts
// generator style: reads like sequential code
const book = (cmd: BookAppointment) =>
  Effect.gen(function* () {
    const slots = yield* Slots;
    const hold = yield* slots.hold(cmd.slot);
    const patient = yield* findPatient(cmd.patient);
    return confirm(hold, patient);
  });

// pipe style: point-free composition
const book = (cmd: BookAppointment) =>
  findPatient(cmd.patient).pipe(
    Effect.flatMap((patient) => holdSlot(cmd.slot, patient)),
    Effect.map(confirm),
  );
```

Generator style suits workflows with several dependent steps; pipe style
suits short transformations. Mixing them arbitrarily within one file
costs readability. See
[consistency.md](../../programming-strategically/references/consistency.md).

## Tagged errors

```ts
class SlotUnavailable extends Data.TaggedError("SlotUnavailable")<{
  readonly slot: SlotId;
  readonly nextFree: Option.Option<Instant>;
}> {}
```

The tag drives `catchTag`, the fields carry what the caller needs to act
or explain. Design them the way
[error-taxonomy.md](../../handling-errors-with-results/references/error-taxonomy.md)
describes: named for the business, carrying data, free of driver
details.

Handling narrows the channel:

```ts
const handled = book(cmd).pipe(
  Effect.catchTag("SlotUnavailable", (e) =>
    Effect.succeed(alternatives(e.nextFree)),
  ),
);
// error channel no longer contains SlotUnavailable
```

## Converting foreign failures

```ts
const query = (pool: Pool, sql: string) =>
  Effect.tryPromise({
    try: () => pool.query(sql),
    catch: (cause) => new DatabaseError({ cause }),
  });
```

`Effect.try` for synchronous code, `Effect.tryPromise` for promises.
Never let a raw throw escape into the effect; that becomes a defect
rather than a typed failure.

## Failures and defects

Effect distinguishes an expected failure, in the error channel, from a
defect, which is a bug. That is exactly the taxonomy in the core skill.

- Expected: `Effect.fail(new SlotUnavailable(...))`
- Bug: `Effect.die(...)`, or an unexpected throw

Do not use `Effect.orDie` to make an inconvenient error disappear. It
converts a failure the caller could handle into a crash.

## Retry, timeout, concurrency

```ts
const resilient = query(pool, sql).pipe(
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.compose(Schedule.recurs(3)),
    ),
  ),
  Effect.timeout("5 seconds"),
);
```

These belong at the shell, wrapping the adapter, not inside a domain
step. A domain step that retries hides latency and becomes untestable in
time.

Parallelism is explicit and bounded:

```ts
Effect.all(effects, { concurrency: 10 });
```

## Resources

```ts
const withConnection = Effect.acquireRelease(acquireConnection, (conn) =>
  Effect.promise(() => conn.close()),
);

const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* withConnection;
    return yield* useConnection(conn);
  }),
);
```

Release runs on success, failure, and interruption. This is what the
two-track error model on its own cannot give you, and it is a good reason
to use the library rather than hand-rolled `Result`.

## Running

```ts
// the composition root, once, at the edge
const main = program.pipe(Effect.provide(AppLive), Effect.runPromise);
```

`runPromise` and `runSync` are the boundary between the described program
and the executing one. Every occurrence inside domain or workflow code is
a design error.

## Option and Either

`Option<A>` is the `Option` of the core notation; `Either<R, L>` is
`Result` for synchronous code that is not an effect. Use `Either` for
pure validation that needs no dependencies, and `Effect` once the world
is involved.

```ts
const parseQuantity = (n: number): Either.Either<Quantity, RangeError> =>
  Number.isInteger(n) && n > 0
    ? Either.right(n as Quantity)
    : Either.left(new RangeError({ value: n }));
```

## Matching

```ts
const describe = Match.type<Payment>().pipe(
  Match.tag("Cash", () => "cash"),
  Match.tag("Card", (p) => maskCard(p.number)),
  Match.tag("Transfer", (p) => p.bank),
  Match.exhaustive,
);
```

`Match.exhaustive` is a compile error when a case is added, which is the
guarantee the core skills depend on.
