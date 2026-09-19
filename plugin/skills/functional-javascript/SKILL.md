---
name: functional-javascript
description: Use when applying functional design in plain JavaScript, without a type checker, including immutability, tagged unions, and Result-style error handling.
---

# Functional JavaScript

## Overview

JavaScript has first-class functions, closures, and object literals,
which is everything the core skills need. What it lacks is a compiler to
enforce the designs, so the enforcement moves to three places:
constructor functions, freezing, and tests that assert exhaustiveness.

Read the core skill for the rule; read this for how to express it.

## When to use

- A project written in plain JavaScript, with no type checker
- Node services, scripts, or browser code without TypeScript
- Adding JSDoc types to an existing JavaScript codebase

Not for: TypeScript projects, which have
[functional-typescript](../functional-typescript/SKILL.md).

## Notation mapping

| Neutral notation    | JavaScript                                      |
| ------------------- | ----------------------------------------------- |
| Record type         | Frozen object literal                           |
| Choice type         | Object with a `tag` field                       |
| Single-case wrapper | Frozen `{ tag, value }`                         |
| `Result<T, E>`      | `{ ok: true, value }` or `{ ok: false, error }` |
| `Option<T>`         | `undefined`, or a `Maybe` object                |
| `A -> B -> C`       | Arrow function returning a function             |
| `>>` composition    | `pipe` helper, or nested calls                  |
| `Async<T>`          | `Promise<T>`                                    |
| Exhaustive match    | `switch` with a `default` that throws           |

## Core rules

1. **Freeze what you export.** `Object.freeze` at construction turns
   accidental mutation into a visible failure in strict mode.
2. **Construct through functions.** Never build a tagged value with a
   literal outside its module. The constructor is where rules live.
3. **One tag key across the codebase.** Pick `tag` and never mix in
   `type` or `kind`.
4. **Never mutate an argument.** Return a new object; the spread operator
   makes it cheap to read.
5. **Return values for expected failures.** Reserve `throw` for
   programmer errors.
6. **Add JSDoc types and check them.** A type checker over JSDoc costs a
   comment per function and catches most shape mistakes.
7. **Test exhaustiveness.** Every dispatch gets a test driven by the list
   of tags.

## Pattern

```js
// payment.js — the only module that knows these shapes
const TAGS = Object.freeze({
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
});

const cash = () => Object.freeze({ tag: TAGS.cash });

const card = (number, expiry) =>
  isValidCard(number)
    ? ok(Object.freeze({ tag: TAGS.card, number, expiry }))
    : err({ tag: "InvalidCard", number });

const describe = (payment) => {
  switch (payment.tag) {
    case TAGS.cash:
      return "cash";
    case TAGS.card:
      return maskCard(payment.number);
    case TAGS.transfer:
      return payment.bank;
    default:
      throw new Error(`unhandled payment: ${payment.tag}`);
  }
};

export { TAGS, cash, card, describe };
```

The `default` branch is not a fallback; it is an assertion that the tag
set is what this function believes, and it fails loudly in test when a
case is added.

## Result without a library

```js
const ok = (value) => Object.freeze({ ok: true, value });
const err = (error) => Object.freeze({ ok: false, error });

const map = (f) => (r) => (r.ok ? ok(f(r.value)) : r);
const bind = (f) => (r) => (r.ok ? f(r.value) : r);
const mapError = (f) => (r) => (r.ok ? r : err(f(r.error)));

const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, f) => f(acc), x);
```

Thirty lines covers the whole of
[handling-errors-with-results](../handling-errors-with-results/SKILL.md).
More, including async, in
[result-and-async.md](references/result-and-async.md).

## How much of this to type-shape

Without a checker, a wrapper buys a name and a constructor, not an
enforced guarantee. That makes the temptation to skip modelling stronger
here than anywhere else in this pack, and the rule is unchanged: model
the shape, and leave it a plain object only on the observable facts in
[choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md).

What changes in JavaScript is the enforcement, not the decision. A
modelled shape here means a constructor function that is the only place
its object literal appears, a frozen result, and a coverage test where a
compiler would have checked exhaustiveness. When you do take the plain
route, it still owes a boundary parse, key constants, and accessors — a
bare object with none of those is not the data-first school, it is the
absence of any design.

## Red flags

- `Object.assign(target, ...)` where `target` is a parameter
- `array.push`, `sort`, `reverse`, or `splice` on a value from a caller
- A tag compared against a string literal outside its module
- `switch` on a tag with no `default`
- `async` functions that both decide and write
- A class whose methods mutate `this` and return `undefined`
- `null` and `undefined` both used, with different meanings

## Common mistakes

- **Shallow freezing.** `Object.freeze` does not freeze nested objects.
  Freeze at construction, all the way down, or use a persistent
  collection library.
- **`sort` and `reverse` mutating in place.** Copy first:
  `[...xs].sort(cmp)`.
- **Equality on objects.** `===` is reference equality. Compare by a key,
  or write an explicit equality function.
- **Mixing `null` and `undefined`.** Pick one to mean absent; say which
  in the project's instructions.
- **Losing the error type.** `catch (e)` gives you anything. Classify it
  immediately at the boundary.
- **Relying on parameter defaults for domain decisions.** A default
  currency or timezone hides a choice the caller must make.

## Related skills

- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [managing-state-immutably](../managing-state-immutably/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)

## Further reading

- [immutability.md](references/immutability.md) covers freezing, copying,
  and persistent collections.
- [tagged-unions.md](references/tagged-unions.md) covers constructors,
  dispatch, and exhaustiveness tests.
- [result-and-async.md](references/result-and-async.md) covers the
  Result helpers, promises, and boundary conversion.
