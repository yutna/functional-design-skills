# Branded Types

TypeScript is structurally typed: two types with the same shape are
interchangeable. A brand adds a phantom property that exists only at
compile time, making the type nominal.

## The brand helper

```ts
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };
```

`declare const` emits no runtime code, and `unique symbol` means no other
module can produce the property by accident.

## A branded type with a parser

```ts
// treatment-code.ts
export type TreatmentCode = Brand<string, "TreatmentCode">;

export type TreatmentCodeError =
  | { readonly tag: "WrongLength"; readonly length: number }
  | { readonly tag: "BadPrefix"; readonly prefix: string }
  | { readonly tag: "NotDigits" };

const PATTERN = /^[WG]\d{4}$/;

export const parseTreatmentCode = (
  raw: string,
): Result<TreatmentCode, TreatmentCodeError> => {
  const s = raw.trim().toUpperCase();
  if (s.length !== 5) return err({ tag: "WrongLength", length: s.length });
  if (!"WG".includes(s[0] ?? "")) {
    return err({ tag: "BadPrefix", prefix: s[0] ?? "" });
  }
  if (!PATTERN.test(s)) return err({ tag: "NotDigits" });
  return ok(s as TreatmentCode);
};

export const treatmentCodeValue = (c: TreatmentCode): string => c;
```

Three exports: the type, the parser, and the unwrapper. The `as` cast
appears exactly once, inside the module, after the rules have been
checked. That is the whole discipline.

## Normalise before validating

Trimming and upper-casing at construction means plain `===` is correct
everywhere afterwards, and no consumer needs to remember to normalise.
Do not normalise away anything the domain considers significant.

## Branding numbers and dates

```ts
export type Quantity = Brand<number, "Quantity">;
export type Percent = Brand<number, "Percent">; // 0..100
export type Fraction = Brand<number, "Fraction">; // 0..1
export type Millis = Brand<number, "Millis">;
export type Seconds = Brand<number, "Seconds">;
```

Branded numbers still support arithmetic operators, which is a real
limitation: `quantity + percent` compiles. Two mitigations:

1. Export the operations you want and no others: `addQuantity`,
   `applyPercent`. Arithmetic then happens inside the module.
2. Where mixing would be costly, use a wrapper object rather than a
   brand, accepting the allocation.

```ts
export type Money = {
  readonly minorUnits: number;
  readonly currency: Currency;
};
export const addMoney = (
  a: Money,
  b: Money,
): Result<Money, CurrencyMismatch> =>
  a.currency === b.currency
    ? ok({ minorUnits: a.minorUnits + b.minorUnits, currency: a.currency })
    : err({ tag: "CurrencyMismatch", a: a.currency, b: b.currency });
```

## Identifiers

One brand per entity, so identifiers cannot be transposed.

```ts
export type CustomerId = Brand<string, "CustomerId">;
export type BookingId = Brand<string, "BookingId">;

// transfer(bookingId, customerId) is now a compile error
export const transfer = (
  customer: CustomerId,
  booking: BookingId,
): Result<void, TransferError> => { ... };
```

## Rehydrating from a trusted store

Values read back from a database were validated when written. Re-parsing
is the safe default; where it is genuinely too expensive, keep an unsafe
constructor internal to the module and name it so nobody reaches for it
by accident.

```ts
/** Only for rows this service wrote. Prefer parseTreatmentCode. */
export const unsafeTreatmentCodeFromStorage = (s: string) => s as TreatmentCode;
```

Storage does drift, so treat this as a measured optimisation, not a
default.

## Where brands do not help

- **Runtime checks.** A brand disappears at compile time; nothing at
  runtime distinguishes a `TreatmentCode` from a `string`. The parser is
  what guarantees the value, not the type.
- **`JSON.parse` results.** They arrive as `unknown` or `any`. Parse into
  branded types at the boundary. See
  [crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).
- **Library boundaries.** A library taking `string` accepts a branded
  string, which is usually what you want; unwrap explicitly where the
  intent matters.

## Testing a branded type

```ts
test("round-trips a valid code", () => {
  const r = parseTreatmentCode(" w1234 ");
  expect(r.ok && treatmentCodeValue(r.value)).toBe("W1234");
});

test("rejects each failure case", () => {
  expect(parseTreatmentCode("W12")).toMatchObject({
    error: { tag: "WrongLength" },
  });
});
```

Add a property test that arbitrary strings never crash the parser and
never produce a value violating the pattern. See
[property-testing.md](../../testing-functional-code/references/property-testing.md).
