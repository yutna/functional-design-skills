# Immutability in JavaScript

## Freezing

`Object.freeze` is shallow. Freeze at construction, and freeze what you
put inside.

```js
const bookedTreatment = (code, quantity) => Object.freeze({ code, quantity });

const booking = (id, treatments) =>
  Object.freeze({ id, treatments: Object.freeze([...treatments]) });
```

In strict mode, and in every module, assignment to a frozen property
throws. Without strict mode it fails silently, which is worse than not
freezing at all, so make sure modules are ES modules or that files start
with `"use strict"`.

Freezing costs a little at construction and nothing on read. Freeze
exported values and anything stored for longer than a function call;
skip it for short-lived locals in hot code, with a measurement.

## Copying instead of mutating

```js
// records
const withStatus = (booking, status) => Object.freeze({ ...booking, status });

// arrays
const added = Object.freeze([...booking.treatments, treatment]);
const removed = booking.treatments.filter((l) => l.id !== id);
const sorted = [...booking.treatments].sort(byCode);
const reversed = [...booking.treatments].reverse();
```

The methods that mutate in place, and must always be preceded by a copy:
`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`,
`copyWithin`.

Non-mutating alternatives exist in modern runtimes: `toSorted`,
`toReversed`, `toSpliced`, `with`. Prefer them where the runtime supports
them, and be consistent about which set the project uses.

## Nested updates

Spreading deeply gets unreadable fast.

```js
// three levels: already too much
const updated = {
  ...booking,
  customer: {
    ...booking.customer,
    address: { ...booking.customer.address, city },
  },
};
```

Three better options, in order of what they cost:

1. **Flatten the model.** Deep nesting in a domain type is usually a
   sign that an inner part should be its own value with its own module
   and its own update functions. Free, and it usually improves the
   design rather than only the syntax.
2. **Write the update function beside the type it updates.**
   `Address.withCity`, `Customer.withAddress`, one spread each, composed
   at the call site. Three small named functions read better than one
   nested literal and cost nothing to test.
3. **Use `immer`.** Its `produce` takes a mutable-looking draft and
   returns a new frozen value, sharing everything untouched.

```js
import { produce } from "immer";

const withCity = (booking, city) =>
  produce(booking, (draft) => {
    draft.customer.address.city = city;
  });
```

The draft is only valid inside the callback, and what comes out is a
plain frozen object, so nothing about `immer` escapes into the domain
types. That is what makes it a different choice from `immutable`, whose
`Map` and `List` are their own types and must be confined to one
module. See
[persistent-structures.md](../../managing-state-immutably/references/persistent-structures.md).

## Maps and sets

`Map` and `Set` are mutable. For small collections, copy on write:

```js
const withEntry = (map, key, value) => new Map(map).set(key, value);
```

For large collections updated frequently, that copying is linear per
change and will show up in a profile. Reach for `immutable`'s `Map`,
which shares structure, and confine it to the module that owns the
data: its values are not plain objects, so everything crossing that
module's boundary should be converted. Measure first — the copy is
cheaper than the conversion until the collection is genuinely large.
See
[persistent-structures.md](../../managing-state-immutably/references/persistent-structures.md).

## Local mutation that is invisible

Building a large structure inside one function, where the mutable value
never escapes, is acceptable.

```js
const groupByCode = (treatments) => {
  const acc = new Map(); // never escapes
  for (const treatment of treatments) {
    const existing = acc.get(treatment.code) ?? [];
    acc.set(treatment.code, [...existing, treatment]);
  }
  return Object.freeze(
    Object.fromEntries([...acc].map(([k, v]) => [k, Object.freeze(v)])),
  );
};
```

The signature is unchanged, the function is still pure, and the result is
frozen before it leaves. Prefer `reduce` when it reads as well; use the
loop when it reads better.

## Equality

`===` compares references. For value types, either:

- Compare a canonical key: `a.id === b.id` for entities.
- Write an explicit `equals` beside the type for values.
- Normalise at construction so that equal values are structurally
  identical, then compare a serialised form for small objects.

Do not reach for a deep-equality utility in domain code; it hides the
question of what equality means for that concept. See
[enforcing-consistency-boundaries](../../enforcing-consistency-boundaries/SKILL.md).

## Class instances

A class whose methods return new instances is fine and can be a good way
to keep a wrapper type opaque.

```js
class Quantity {
  #value;
  constructor(value) {
    this.#value = value;
    Object.freeze(this);
  }
  static parse(n) {
    return Number.isInteger(n) && n > 0
      ? ok(new Quantity(n))
      : err({ tag: "BadQuantity", n });
  }
  plus(other) {
    return new Quantity(this.#value + other.#value);
  }
  valueOf() {
    return this.#value;
  }
}
```

Private fields give real encapsulation. What to avoid is a class whose
methods mutate `this` and return `undefined`, which is the shape every
core skill argues against.
