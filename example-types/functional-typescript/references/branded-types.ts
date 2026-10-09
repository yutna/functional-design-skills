import { err, ok, type Result } from "../../_shared/result";

// Names the fences use without defining.
type Currency = "THB" | "USD" | "EUR";
type CurrencyMismatch = {
  readonly tag: "CurrencyMismatch";
  readonly a: Currency;
  readonly b: Currency;
};
type TransferError = { readonly tag: "NotPermitted" };

// The test runner the last fence uses. Its `toBe` takes the type of what is
// being checked, so a wrong expected value is a type error here too.
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;
declare function test(name: string, run: () => void): void;
declare function expect<T>(actual: T): {
  toBe(expected: T): void;
  toMatchObject(expected: DeepPartial<T>): void;
};
