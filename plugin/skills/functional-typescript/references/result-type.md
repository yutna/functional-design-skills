# Result in TypeScript

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
export function pipe(a: unknown, ...fns: Array<(x: unknown) => unknown>) {
  return fns.reduce((acc, f) => f(acc), a);
}
```

```ts
const confirmBooking = (raw: UnvalidatedBooking) =>
  pipe(validate(raw), bind(price(catalogue)), bind(acknowledge), map(toEvents));
```

Overloads up to about six arguments cover every real pipeline. Beyond
that, name intermediate values instead.

## Early return, the TypeScript idiom

Narrowing makes early return read well, and many teams prefer it.

```ts
const confirmBooking = (
  raw: UnvalidatedBooking,
): Result<readonly BookingEvent[], ConfirmBookingError> => {
  const validated = validate(raw);
  if (!validated.ok) return err({ tag: "Validation", cause: validated.error });

  const priced = price(catalogue)(validated.value);
  if (!priced.ok) return err({ tag: "Pricing", cause: priced.error });

  return ok(toEvents(acknowledge(priced.value)));
};
```

Both styles are correct. Pick one per codebase. See
[consistency.md](../../programming-strategically/references/consistency.md).

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
export const saveBooking = async (
  pool: Pool,
  booking: Booking,
): AsyncResult<void, SaveError> => {
  try {
    await pool.query(INSERT, toRow(booking));
    return ok(undefined);
  } catch (e: unknown) {
    return err(classify(e));
  }
};

const classify = (e: unknown): SaveError => {
  if (isPgError(e) && e.code === "23505") return { tag: "Duplicate" };
  if (isPgError(e) && e.code === "57014") {
    return { tag: "Transient", retryAfterMs: 1000 };
  }
  return { tag: "Unexpected", cause: e };
};
```

`catch (e: unknown)` is the honest type; narrow it with a type guard
rather than casting. Keep `cause` as `unknown` so callers cannot branch
on a driver detail. See
[error-taxonomy.md](../../handling-errors-with-results/references/error-taxonomy.md).

## Error types

```ts
export type ConfirmBookingError =
  | { readonly tag: "Validation"; readonly cause: ValidationError }
  | { readonly tag: "Pricing"; readonly cause: PricingError }
  | { readonly tag: "Storage"; readonly cause: SaveError };
```

One union per workflow, each case wrapping a step's narrow error. Callers
match once, and the compiler lists every case.

## Should a library be used instead?

The code above is under a hundred lines and has no dependency. A library
buys more operators and a shared vocabulary; it costs a dependency and a
learning curve for everyone who reads the code. For a project that wants
the full toolkit, including typed dependency injection and resource
scopes, see
[functional-typescript-effect](../../functional-typescript-effect/SKILL.md).
