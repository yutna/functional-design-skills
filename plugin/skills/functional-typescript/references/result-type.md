# Result in TypeScript

## Contents

- [The type and its helpers](#the-type-and-its-helpers)
- [Piping](#piping)
- [Early return, the TypeScript idiom](#early-return-the-typescript-idiom)
- [Collections](#collections)
- [Async](#async)
- [Converting at the boundary](#converting-at-the-boundary)
- [Error types](#error-types)
- [Should a library be used instead?](#should-a-library-be-used-instead)

## The type and its helpers

```ts
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export const map =
  <T, U>(f: (t: T) => U) =>
  <E>(r: Result<T, E>): Result<U, E> =>
    r.ok ? ok(f(r.value)) : r;

export const bind =
  <T, U, E2>(f: (t: T) => Result<U, E2>) =>
  <E>(r: Result<T, E>): Result<U, E | E2> =>
    r.ok ? f(r.value) : r;

export const mapError =
  <E, E2>(f: (e: E) => E2) =>
  <T>(r: Result<T, E>): Result<T, E2> =>
    r.ok ? r : err(f(r.error));

export const unwrapOr =
  <T>(fallback: T) =>
  <E>(r: Result<T, E>): T =>
    r.ok ? r.value : fallback;
```

`unwrapOr` takes a default that is an ordinary answer for the operation.
A default that hides a failure is the defect rule 6 of
[functional-defining-errors-out-of-existence](../../functional-defining-errors-out-of-existence/SKILL.md)
names.

`Result<T, never>` from `ok` and `Result<never, E>` from `err` let the
compiler infer the union precisely at each call site.

## Piping

```ts
export function pipe<A, B>(a: A, ab: (a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
export function pipe<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
  de: (d: D) => E,
): E;
export function pipe(a: unknown, ...fns: Array<(x: unknown) => unknown>) {
  return fns.reduce((acc, f) => f(acc), a);
}
```

```ts
const validation = (
  cause: NonEmptyArray<ValidationError>,
): ConfirmBookingError => ({ tag: "Validation", cause });
const pricing = (cause: PricingError): ConfirmBookingError => ({
  tag: "Pricing",
  cause,
});

const confirmBooking = (
  catalogue: Catalogue,
  now: Instant,
  raw: UnvalidatedBooking,
): Result<readonly ConfirmBookingEvent[], ConfirmBookingError> =>
  pipe(
    validateBooking(catalogue)(raw),
    mapError(validation),
    bind((booking) =>
      pipe(priceBooking(catalogue)(booking), mapError(pricing)),
    ),
    map(issueConfirmation(now)),
    map((booking): readonly ConfirmBookingEvent[] => [
      { tag: "BookingConfirmed", booking },
    ]),
  );
```

Each step keeps its own narrow error, and `mapError` lifts it into its
case of `ConfirmBookingError`, so the signature carries one error type.
Without the two `mapError` calls the error would be inferred as
`NonEmptyArray<ValidationError> | PricingError`, because `bind` widens
as it goes: a union that a caller can tell apart only by shape.

The overloads shown stop at four functions. Add one for each further
step; beyond about six, name intermediate values instead.

## Early return, the TypeScript idiom

Narrowing makes early return read well, and many teams prefer it.

```ts
const confirmBooking = (
  catalogue: Catalogue,
  now: Instant,
  raw: UnvalidatedBooking,
): Result<readonly ConfirmBookingEvent[], ConfirmBookingError> => {
  const validated = validateBooking(catalogue)(raw);
  if (!validated.ok) return err({ tag: "Validation", cause: validated.error });

  const priced = priceBooking(catalogue)(validated.value);
  if (!priced.ok) return err({ tag: "Pricing", cause: priced.error });

  const booking = issueConfirmation(now)(priced.value);
  return ok([{ tag: "BookingConfirmed", booking }]);
};
```

Both styles are correct. Pick one per codebase. See
[consistency.md](../../functional-programming-strategically/references/consistency.md).

## Collections

```ts
export const traverse =
  <T, U, E>(f: (t: T) => Result<U, E>) =>
  (xs: readonly T[]): Result<readonly U[], E> => {
    const out: U[] = [];
    for (const x of xs) {
      const r = f(x);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return ok(out);
  };

export const traverseAll =
  <T, U, E>(f: (t: T) => Result<U, E>) =>
  (xs: readonly T[]): Result<readonly U[], NonEmptyArray<E>> => {
    const out: U[] = [];
    const errors: E[] = [];
    for (const x of xs) {
      const r = f(x);
      if (r.ok) out.push(r.value);
      else errors.push(r.error);
    }
    return errors.length ? err(errors as unknown as NonEmptyArray<E>) : ok(out);
  };
```

## Async

```ts
export type AsyncResult<T, E> = Promise<Result<T, E>>;

export const bindAsync =
  <T, U, E2>(f: (t: T) => AsyncResult<U, E2>) =>
  async <E>(pr: AsyncResult<T, E>): AsyncResult<U, E | E2> => {
    const r = await pr;
    return r.ok ? f(r.value) : r;
  };
```

Do not use promise rejection for expected failures. Rejections are
untyped, invisible in the signature, and easy to forget, which is the
problem `Result` exists to solve.

## Converting at the boundary

```ts
export type InsertError =
  | { readonly tag: "DuplicateBooking" }
  | { readonly tag: "Transient"; readonly retryAfter: Seconds | undefined }
  | { readonly tag: "Unexpected"; readonly cause: unknown };

export const insertBooking = async (
  pool: Pool,
  booking: Booking,
): AsyncResult<void, InsertError> => {
  try {
    await pool.query(INSERT, toRow(booking));
    return ok(undefined);
  } catch (e: unknown) {
    return err(classify(e));
  }
};

const classify = (e: unknown): InsertError => {
  if (isPgError(e) && e.code === "23505") return { tag: "DuplicateBooking" };
  if (isPgError(e) && e.code === "57014") {
    return { tag: "Transient", retryAfter: seconds(1) };
  }
  return { tag: "Unexpected", cause: e };
};
```

`catch (e: unknown)` is the honest type; narrow it with a type guard
rather than casting. An exception `classify` does not recognise is the
opaque `Unexpected`: its `cause` stays `unknown`, so no caller can
branch on a driver detail. A save that checks a version has two cases
of its own, `Conflict` and `Failed`, in
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md).
See
[error-taxonomy.md](../../functional-handling-errors-with-results/references/error-taxonomy.md).

## Error types

```ts
export type ConfirmBookingError =
  | {
      readonly tag: "Validation";
      readonly cause: NonEmptyArray<ValidationError>;
    }
  | { readonly tag: "Pricing"; readonly cause: PricingError };
```

One union per workflow, each case wrapping a step's narrow error. Callers
match once, and the compiler lists every case.

```ts
export type ConfirmBookingFailure =
  | { readonly tag: "Rejected"; readonly cause: ConfirmBookingError }
  | { readonly tag: "Unavailable"; readonly cause: StoreError };
```

`ConfirmBookingFailure` is the handler's type and not the workflow's: the
workflow knows only that the rules refused, and the handler adds that
storage could not be reached.

## Should a library be used instead?

The code above is under a hundred lines and has no dependency. A library
buys more operators and a shared vocabulary; it costs a dependency and a
learning curve for everyone who reads the code. For a project that wants
the full toolkit, including typed dependency injection and resource
scopes, see
[functional-typescript-effect](../../functional-typescript-effect/SKILL.md).
