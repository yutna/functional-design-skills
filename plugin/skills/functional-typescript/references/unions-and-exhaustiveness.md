# Discriminated Unions and Exhaustiveness

## The shape

A union of object types sharing a literal-typed field. Use one field name
across the codebase; `tag`, `kind`, and `type` all work, but mixing them
costs more than choosing badly.

```ts
export type Shipment =
  | { readonly tag: "Pending"; readonly requestedAt: Date }
  | {
      readonly tag: "Shipped";
      readonly tracking: TrackingNumber;
      readonly shippedAt: Date;
    }
  | {
      readonly tag: "Delivered";
      readonly tracking: TrackingNumber;
      readonly shippedAt: Date;
      readonly deliveredAt: Date;
    }
  | { readonly tag: "Failed"; readonly reason: FailureReason };
```

Each case carries only its own data, so a delivered shipment always has
both timestamps and a pending one cannot have a tracking number.

## Narrowing

```ts
const trackingOf = (s: Shipment): TrackingNumber | undefined =>
  s.tag === "Shipped" || s.tag === "Delivered" ? s.tracking : undefined;
```

The compiler narrows on the discriminant in `switch`, `if`, ternaries,
and after an early return. Narrowing does not survive being passed into a
callback that the compiler cannot prove runs immediately, so narrow
first, then call.

## Exhaustiveness

```ts
const assertNever = (x: never): never => {
  throw new Error(`unhandled case: ${JSON.stringify(x)}`);
};

export const describe = (s: Shipment): string => {
  switch (s.tag) {
    case "Pending":
      return "awaiting dispatch";
    case "Shipped":
      return `in transit: ${s.tracking}`;
    case "Delivered":
      return `delivered ${s.deliveredAt.toISOString()}`;
    case "Failed":
      return `failed: ${s.reason}`;
    default:
      return assertNever(s);
  }
};
```

Adding a fifth case makes `assertNever(s)` a compile error here and at
every other site that must change. That list is the value; a permissive
`default` throws it away.

An expression form, when the function is a single mapping:

```ts
const label: Record<Shipment["tag"], string> = {
  Pending: "Awaiting",
  Shipped: "In transit",
  Delivered: "Delivered",
  Failed: "Failed",
};
```

`Record<Shipment["tag"], string>` requires every key, so a new case is
again a compile error.

## Extracting one case

```ts
type Extract_<T, K extends string> = Extract<T, { tag: K }>;
type Shipped = Extract_<Shipment, "Shipped">;

export const deliver = (
  s: Shipped,
  deliveredAt: Date,
): Result<Delivered, DeliverError> => { ... };
```

Transition functions take the specific case, not the union, so an illegal
transition does not compile. See
[modeling-state-machines](../../modeling-state-machines/SKILL.md).

## Constructors

Export a constructor per case and keep the object literals inside the
module.

```ts
export const pending = (requestedAt: Date): Shipment => ({
  tag: "Pending",
  requestedAt,
});
```

For cases with rules, the constructor returns `Result`.

## Unions of primitives

For a closed set of labels with no payload, a union of string literals is
better than an `enum`: it needs no runtime value, works with
`Record`-based exhaustiveness, and serialises as itself.

```ts
export type Currency = "THB" | "USD" | "EUR";

export const ALL_CURRENCIES = ["THB", "USD", "EUR"] as const;
// typeof ALL_CURRENCIES[number] is Currency
```

Deriving one from the other keeps the runtime list and the type in step:

```ts
export const ALL_CURRENCIES = ["THB", "USD", "EUR"] as const;
export type Currency = (typeof ALL_CURRENCIES)[number];
```

Prefer this direction: the array is the single source, and the type
follows.

## Parsing a union from outside

```ts
export const parseCurrency = (raw: unknown): Result<Currency, ParseError> =>
  typeof raw === "string" && (ALL_CURRENCIES as readonly string[]).includes(raw)
    ? ok(raw as Currency)
    : err({ tag: "UnknownCurrency", raw });
```

An unknown value is an error, never a default. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Non-empty lists

```ts
export type NonEmptyArray<T> = readonly [T, ...T[]];

export const nonEmpty = <T>(
  xs: readonly T[],
): Result<NonEmptyArray<T>, EmptyError> =>
  xs.length > 0 ? ok(xs as unknown as NonEmptyArray<T>) : err({ tag: "Empty" });

export const head = <T>(xs: NonEmptyArray<T>): T => xs[0];
```

`head` is total, with no `!` and no `undefined` in its type. That is the
payoff, and it removes a check from every consumer.
