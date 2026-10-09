// The names functional-typescript defines in its own fences and other packs'
// examples use without defining. Each is declared with the signature the
// fence gives it, so a prelude imports what it needs from here and there is
// one copy to change when a fence changes. functional-typescript's own claims
// files check that the copy here still says what the fences say.

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export declare const ok: <T>(value: T) => Result<T, never>;
export declare const err: <E>(error: E) => Result<never, E>;

export declare const map: <T, U>(
  f: (t: T) => U,
) => <E>(r: Result<T, E>) => Result<U, E>;

export declare const bind: <T, U, E2>(
  f: (t: T) => Result<U, E2>,
) => <E>(r: Result<T, E>) => Result<U, E | E2>;

export declare const mapError: <E, E2>(
  f: (e: E) => E2,
) => <T>(r: Result<T, E>) => Result<T, E2>;

export declare function pipe<A, B>(a: A, ab: (a: A) => B): B;
export declare function pipe<A, B, C>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
): C;
export declare function pipe<A, B, C, D>(
  a: A,
  ab: (a: A) => B,
  bc: (b: B) => C,
  cd: (c: C) => D,
): D;

export type AsyncResult<T, E> = Promise<Result<T, E>>;

export type NonEmptyArray<T> = readonly [T, ...T[]];
export type EmptyError = { readonly tag: "Empty" };
export declare const nonEmpty: <T>(
  xs: readonly T[],
) => Result<NonEmptyArray<T>, EmptyError>;

export declare const assertNever: (x: never) => never;
