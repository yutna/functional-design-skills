// The shapes the Result helpers pass between them.
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Names the fences use without defining.
declare function ok<T>(value: T): { readonly ok: true; readonly value: T };
declare function err<E>(error: E): { readonly ok: false; readonly error: E };
declare function map<T, U>(
  f: (t: T) => U,
): <E>(r: Result<T, E>) => Result<U, E>;
declare function formatDate(d: Date): string;
declare function parseInstant(raw: string): Result<Date, { readonly tag: string }>;
declare function parseTracking(
  raw: string,
): Result<string, { readonly tag: string }>;

// The exhaustiveness test's runner, and the sample builder that lives
// beside the constructors in the module the test imports.
declare function sampleFor(tag: string): { readonly tag: string };
declare function test(name: string, run: () => void): void;
declare function expect(actual: () => unknown): {
  readonly not: { toThrow(): void };
};
