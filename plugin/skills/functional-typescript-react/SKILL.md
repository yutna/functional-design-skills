---
name: functional-typescript-react
description: Use when a React component's props grow, when deciding if a value belongs in state or is derived during render, or when an effect computes what render could.
license: MIT
metadata:
  pack: functional-design-skills
  version: 2.0.1
---

# Functional React

## Overview

React is already a functional architecture: a component is a pure
function from props and state to a description of the interface, and the
framework performs the effects. The design rules in this pack apply
directly, and the common React problems are the same problems they
describe: state that duplicates a fact, effects tangled with decisions,
and components whose interface is as complicated as their body.

This pack covers React itself. The TypeScript it is written in is in
[functional-typescript](../functional-typescript/SKILL.md), and the
server and client split a meta-framework adds is in
[functional-typescript-react-nextjs](../functional-typescript-react-nextjs/SKILL.md).

## When to use

- Designing a component, a hook, or a custom hook's interface
- Deciding whether a value belongs in state or is derived
- Modelling what a screen can be showing
- Keeping a business rule out of an event handler
- Reviewing React code against the design rules

Not for: visual design, framework configuration, or the server and
client boundary.

## Core rules

1. Rule. **Render is a pure function.** Same props and state, same output. No
   fetching, no writing, no mutation during render.
2. Default. **Do not store what you can derive.** Duplicated state is duplicated
   knowledge, and it goes stale.
3. Default. **`useEffect` is for synchronising with something outside React**,
   not for reacting to your own state. Most effects in a codebase should not
   exist.
4. Default. **Model interface state as a choice type**, not as several booleans.
   `isLoading`, `error`, and `data` together permit states no screen has.
5. Default. **Keep the decision pure and let the framework act.** A reducer, or
   a plain function, decides; the component or the action performs.
6. Default. **Push data fetching to the edge**: a loader, a route, or a query
   layer, not into the middle of a component tree.
7. Judgement. **A component's props are its interface.** Deep components take
   few props and hide a lot; shallow ones take twenty and hide nothing.

## Pattern

Booleans that permit impossible screens:

```tsx
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [bookings, setBookings] = useState<Booking[]>([]);
// loading and error at once? data with an error? empty and not loaded?
```

A choice type with one state at a time:

```tsx
type ScreenState =
  | { tag: "Loading" }
  | { tag: "Failed"; error: LoadError }
  | { tag: "Loaded"; bookings: readonly Booking[] }
  | { tag: "Empty" };

const view = (s: ScreenState) => {
  switch (s.tag) {
    case "Loading":
      return <Spinner />;
    case "Failed":
      return <ErrorPanel error={s.error} />;
    case "Loaded":
      return <BookingTable bookings={s.bookings} />;
    case "Empty":
      return <EmptyState />;
    default:
      return assertNever(s);
  }
};
```

Four states, each with exactly its own data, and a compile error when a
fifth is added. This is
[functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
applied to a screen.

## Derived, not stored

```tsx
// stored: two facts that can disagree
const [items, setItems] = useState<Item[]>([]);
const [total, setTotal] = useState(0);

// derived: one fact
const [items, setItems] = useState<readonly Item[]>([]);
const total = items.reduce((sum, i) => sum + i.price, 0);
```

Store the minimum from which everything else follows. Reach for
memoisation only when a measurement says the derivation is expensive; the
correctness argument comes first, and the performance argument rarely
does. See
[state-and-derivation.md](references/state-and-derivation.md).

## Red flags

- `useEffect` that sets state derived from other state
- Three booleans describing one screen state
- A component with more than about seven props
- Fetching inside a component several levels deep
- A `useEffect` with a dependency array the author had to fight
- Mutating props, state, or an array from a hook
- Business rules inside a component or an event handler
- `any` in a props type

## Common mistakes

- **Effects as data flow.** An effect that watches state to compute other
  state is a derivation written the hard way, and it renders twice.
- **Lifting state too high.** State that only one subtree uses, held at
  the root, makes every change re-render everything and couples unrelated
  components.
- **Prop drilling a value nobody in between reads.** That is the
  pass-through variable smell. See
  [functional-hiding-information](../functional-hiding-information/SKILL.md).
- **Putting rules in handlers.** A discount calculated in `onClick`
  cannot be tested or reused. Move it to a pure function.
- **Reaching for a global store first.** Most state is either server data
  or local to one subtree.

## Related skills

- [functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-designing-deep-modules](../functional-designing-deep-modules/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)
- [functional-typescript-react-nextjs](../functional-typescript-react-nextjs/SKILL.md)

## Further reading

- [state-and-derivation.md](references/state-and-derivation.md) covers
  what to store, reducers as state machines, where a query library
  belongs, and when an effect is right.
