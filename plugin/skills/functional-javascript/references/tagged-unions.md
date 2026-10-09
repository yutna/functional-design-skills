# Tagged Unions in JavaScript

## Contents

- [The convention](#the-convention)
- [Constructors](#constructors)
- [Dispatch](#dispatch)
- [The exhaustiveness test](#the-exhaustiveness-test)
- [JSDoc types](#jsdoc-types)
- [Serialising](#serialising)

## The convention

One tag key for the whole codebase, and tag values defined as frozen
constants next to the constructors.

```js
// shipment.js
export const SHIPMENT = Object.freeze({
  pending: "Pending",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Failed",
});

export const ALL_SHIPMENT_TAGS = Object.freeze(Object.values(SHIPMENT));
```

`ALL_SHIPMENT_TAGS` is what makes the exhaustiveness test possible, so
export it even though application code never uses it.

## Constructors

Each case gets a constructor. Cases with rules return a `Result`.

```js
export const pending = (requestedAt) =>
  Object.freeze({ tag: SHIPMENT.pending, requestedAt });

export const shipped = (tracking, shippedAt) =>
  Object.freeze({ tag: SHIPMENT.shipped, tracking, shippedAt });

export const delivered = (shipped, deliveredAt) =>
  deliveredAt >= shipped.shippedAt
    ? ok(
        Object.freeze({
          tag: SHIPMENT.delivered,
          tracking: shipped.tracking,
          shippedAt: shipped.shippedAt,
          deliveredAt,
        }),
      )
    : err({ tag: "DeliveredBeforeShipped" });

export const failed = (reason) =>
  Object.freeze({ tag: SHIPMENT.failed, reason });
```

Each case carries only its own data, which is what removes the illegal
combinations. See
[functional-making-illegal-states-unrepresentable](../../functional-making-illegal-states-unrepresentable/SKILL.md).

## Dispatch

```js
export const describe = (s) => {
  switch (s.tag) {
    case SHIPMENT.pending:
      return "awaiting dispatch";
    case SHIPMENT.shipped:
      return `in transit: ${s.tracking}`;
    case SHIPMENT.delivered:
      return `delivered ${formatDate(s.deliveredAt)}`;
    case SHIPMENT.failed:
      return `failed: ${s.reason}`;
    default:
      throw new Error(`unhandled shipment tag: ${s.tag}`);
  }
};
```

The `default` throw is deliberate. It converts "a case was added and this
function was not updated" from a silent wrong answer into a test failure.

A dispatch table is an alternative when the cases have no shared
structure:

```js
const HANDLERS = Object.freeze({
  [SHIPMENT.pending]: () => "awaiting dispatch",
  [SHIPMENT.shipped]: (s) => `in transit: ${s.tracking}`,
  [SHIPMENT.delivered]: (s) => `delivered ${formatDate(s.deliveredAt)}`,
  [SHIPMENT.failed]: (s) => `failed: ${s.reason}`,
});

const describe = (s) => {
  const handler = HANDLERS[s.tag];
  if (!handler) throw new Error(`unhandled: ${s.tag}`);
  return handler(s);
};
```

## The exhaustiveness test

One test per dispatch site, driven by the tag list.

```js
import { ALL_SHIPMENT_TAGS, describe } from "./shipment.js";
import { sampleFor } from "./shipment.samples.js";

test("describe handles every shipment tag", () => {
  for (const tag of ALL_SHIPMENT_TAGS) {
    expect(() => describe(sampleFor(tag))).not.toThrow();
  }
});
```

`sampleFor` lives beside the constructors and must produce a value for
every tag, so adding a case forces it to grow. That one file is what
replaces the compiler's exhaustiveness check.

## JSDoc types

A type checker over JSDoc gives most of the benefit for the cost of a
comment.

```js
/**
 * @typedef {{ tag: "Pending", requestedAt: Date }} Pending
 * @typedef {{ tag: "Shipped", tracking: string, shippedAt: Date }} Shipped
 * @typedef {Pending | Shipped} Shipment
 */

/**
 * @param {never} s
 * @returns {never}
 */
const unhandled = (s) => {
  throw new Error(`unhandled shipment: ${JSON.stringify(s)}`);
};

/**
 * @param {Shipment} s
 * @returns {string}
 */
export const describe = (s) => {
  switch (s.tag) {
    case SHIPMENT.pending:
      return "awaiting dispatch";
    case SHIPMENT.shipped:
      return `in transit: ${s.tracking}`;
    default:
      return unhandled(s);
  }
};
```

With `checkJs` enabled, the checker narrows on `s.tag` exactly as it does
in TypeScript. It reports a missing case only when the `default` branch
hands the value to a parameter typed `never`, as `unhandled` does; a
`default` that simply throws satisfies the checker whatever is missing.
Where a project can afford this, it removes most of the reason for the
exhaustiveness test, though the test is still worth keeping for values
that arrive at runtime.

## Serialising

The wire name of a case is a contract with whoever stores or reads it,
so it has its own constants. Renaming a case in code is then free, and
changing the transmitted string is a breaking change someone has to
choose.

```js
const KIND = Object.freeze({ pending: "pending", shipped: "shipped" });

export const toDto = (s) => {
  switch (s.tag) {
    case SHIPMENT.pending:
      return { kind: KIND.pending, requestedAt: s.requestedAt.toISOString() };
    case SHIPMENT.shipped:
      return {
        kind: KIND.shipped,
        tracking: s.tracking,
        shippedAt: s.shippedAt.toISOString(),
      };
    // delivered and failed follow the same shape
    default:
      throw new Error(`unhandled shipment tag: ${s.tag}`);
  }
};

export const fromDto = (d) => {
  switch (d.kind) {
    case KIND.pending:
      return map(pending)(parseInstant(d.requestedAt));
    case KIND.shipped: {
      const tracking = parseTracking(d.tracking);
      const shippedAt = parseInstant(d.shippedAt);
      if (!tracking.ok) return tracking;
      if (!shippedAt.ok) return shippedAt;
      return ok(shipped(tracking.value, shippedAt.value));
    }
    // delivered and failed follow the same shape
    default:
      return err({ tag: "UnknownKind", kind: d.kind });
  }
};
```

Each direction names its fields. `toDto` never spreads the value, so a
field added to the domain does not leak onto the wire. `fromDto` never
spreads what arrived, so nothing from outside reaches the domain except
through a parser and the case's own constructor. An unknown kind from
outside is an error, never a default. See
[functional-crossing-io-boundaries](../../functional-crossing-io-boundaries/SKILL.md).
