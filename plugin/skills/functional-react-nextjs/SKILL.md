---
name: functional-react-nextjs
description: Use when building React or Next.js interfaces functionally, deciding between derived and stored state, or placing logic across the server and client boundary.
---

# Functional React and Next.js

## Overview

React is already a functional architecture: a component is a pure
function from props and state to a description of the interface, and the
framework performs the effects. The design rules in this pack apply
directly, and the common React problems are the same problems they
describe: state that duplicates a fact, effects tangled with decisions,
and components whose interface is as complicated as their body.

Next.js adds a second boundary, between server and client, which maps
onto the pure core and shell split almost exactly.

## When to use

- Designing a component, a hook, or a page
- Deciding whether a value belongs in state
- Placing logic across server and client components
- Writing a Server Action or a form
- Reviewing React code against the design rules

Not for: visual design, or framework configuration.

## Core rules

1. **Render is a pure function.** Same props and state, same output. No
   fetching, no writing, no mutation during render.
2. **Do not store what you can derive.** Duplicated state is duplicated
   knowledge, and it goes stale.
3. **`useEffect` is for synchronising with something outside React**,
   not for reacting to your own state. Most effects in a codebase should
   not exist.
4. **Model interface state as a choice type**, not as several booleans.
   `isLoading`, `error`, and `data` together permit states no screen has.
5. **Keep the decision pure and let the framework act.** A reducer, or a
   plain function, decides; the component or the action performs.
6. **Push data fetching to the edge**: server components, loaders, or a
   query layer, not into the middle of a component tree.
7. **A component's props are its interface.** Deep components take few
   props and hide a lot; shallow ones take twenty and hide nothing.

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
[making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
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

## The server boundary

In Next.js the server and client split is the pure core and shell split
with a network in between.

| Belongs on the server      | Belongs on the client       |
| -------------------------- | --------------------------- |
| Data access and secrets    | Interaction state           |
| Business rules and pricing | Optimistic updates          |
| Authorisation decisions    | Animation and focus         |
| Composing the page's data  | Local, ephemeral form state |

A Server Action is a workflow: a command arrives, the pure core decides,
the shell performs, and the result is returned as data.

```tsx
"use server";

export async function confirmBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseBookingForm(formData);
  if (!parsed.ok) return { tag: "Invalid", errors: parsed.error };

  const result = await runConfirmBooking(deps)(parsed.value);
  return result.ok
    ? { tag: "Placed", ref: result.value.reference }
    : { tag: "Rejected", reason: result.error };
}
```

Parse at the boundary, decide purely, return a value the form can render.
See [server-boundary.md](references/server-boundary.md).

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
  [hiding-information](../hiding-information/SKILL.md).
- **Putting rules in handlers.** A discount calculated in `onClick`
  cannot be tested or reused. Move it to a pure function.
- **Client components by default.** Marking a component as client-side
  pulls its whole subtree across the boundary.
- **Reaching for a global store first.** Most state is either server data
  or local to one subtree.

## Related skills

- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)

## Further reading

- [state-and-derivation.md](references/state-and-derivation.md) covers
  what to store, reducers as state machines, and when an effect is right.
- [server-boundary.md](references/server-boundary.md) covers server
  components, actions, forms, and where each kind of logic belongs.
