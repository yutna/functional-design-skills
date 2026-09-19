# Tagged Unions in JavaScript

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
```

Each case carries only its own data, which is what removes the illegal
combinations. See
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md).

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
  [SHIPMENT.pending]: (s) => ...,
  [SHIPMENT.shipped]: (s) => ...,
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
 * @param {Shipment} s
 * @returns {string}
 */
export const describe = (s) => { ... };
```

With `checkJs` enabled, the checker narrows on `s.tag` exactly as it does
in TypeScript, and reports a missing case. Where a project can afford
this, it removes most of the reason for the exhaustiveness test, though
the test is still worth keeping for values that arrive at runtime.

## Serialising

The tag value is part of the wire contract. Renaming a case in code is
free; changing the stored or transmitted string is a breaking change.

```js
export const toDto = (s) => ({ ...s, kind: s.tag.toLowerCase() });

export const fromDto = (d) => {
  const tag = ALL_SHIPMENT_TAGS.find((t) => t.toLowerCase() === d.kind);
  return tag ? ok({ ...d, tag }) : err({ tag: "UnknownKind", kind: d.kind });
};
```

An unknown tag from outside is an error, never a default. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).
