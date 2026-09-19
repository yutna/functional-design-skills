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

Two better options:

1. **Flatten the model.** Deep nesting in a domain type is usually a
   sign that an inner part should be its own value with its own module
   and its own update functions.
2. **Use a persistent collection library** for genuinely deep or large
   structures, and keep its types inside one module.

## Maps and sets

`Map` and `Set` are mutable. For small collections, copy on write:

```js
const withEntry = (map, key, value) => new Map(map).set(key, value);
```

For large collections updated frequently, that copying is linear per
change and will show up in a profile. Use a persistent map
implementation, and confine it to the module that owns the data. See
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
