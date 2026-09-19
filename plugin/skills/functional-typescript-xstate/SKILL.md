---
name: functional-typescript-xstate
description: Use when a lifecycle needs nested states, regions active at the same time, delayed transitions, or an actor per row, and whether a statechart beats a plain reducer.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.0.0
---

# Functional Statecharts with XState

## Overview

A statechart is a state machine plus three things a plain union does
not have: states inside states, regions that are active at once, and
time as a first-class trigger. Each is a real capability and each costs
the same thing — the lifecycle stops being a function you can call with
two arguments and becomes a library value.

So this pack is mostly about the second half of that trade. The
modelling itself is unchanged and lives in
[functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md);
the TypeScript is in
[functional-typescript](../functional-typescript/SKILL.md).

## When to use

- A lifecycle with states inside states
- Two parts of one lifecycle that are active at the same time
- A transition that fires because time passed, not because something
  happened
- One machine per row, each with its own lifetime
- Deciding whether any of that is true yet

Not for: a lifecycle a discriminated union and a transition function
already describe. That is most of them.

## When a union is still the answer

Ask which of the four the lifecycle actually has. If the answer is
none, a union plus a pure `(state, event) => state` is smaller, needs
no library, and can be called from a test with two arguments.

The cost of reaching too early is specific: the states become strings
inside a config object rather than cases of a type, so the compiler
stops telling you about a state you forgot to handle. You have traded
an exhaustiveness check for features you are not using.

## Notation mapping

| Neutral notation   | XState                                   |
| ------------------ | ---------------------------------------- |
| Choice of states   | `states` in the machine config           |
| Transition         | `on: { EVENT: { target } }`              |
| Guard              | `guard` naming a predicate in `setup`    |
| Emitted event      | An action, performed by the interpreter  |
| Substates          | Nested `states` under a parent state     |
| Concurrent regions | `type: 'parallel'`                       |
| Time as a trigger  | `after: { 5000: { target } }`            |
| Child workflow     | `invoke` with `src`, `onDone`, `onError` |

## Core rules

1. Rule. **The machine owns the lifecycle.** Nothing outside it decides
   what state something is in, and no component keeps a second copy of
   the state value to make rendering easier.
2. Default. **Reach for a statechart only when a union falls short.**
   Hierarchy, parallel regions, delays, or an actor per item. Without
   one of those you have taken on a library and lost exhaustiveness.
3. Rule. **Guards are pure predicates over context and event.** A guard
   that reads a clock, a store, or the network is a transition
   pretending not to be one.
4. Rule. **Actions describe; the interpreter performs.** Keep the effect
   in the actor or at the edge, so the machine stays a value that can be
   stepped in a test.
5. Default. **`invoke` for work with a lifetime, an action for work
   without one.** An invoked actor is cancelled when its state is left,
   which is the whole reason to prefer it for anything that can outlive
   a keystroke.
6. Rule. **Context is replaced, not mutated.** `assign` returns the new
   value; writing through the draft is the mutation this pack exists to
   remove.
7. Default. **Test by stepping, not by running.** `transition` and
   `initialTransition` give the next state and the actions without an
   interpreter, timers, or waiting.

## Pattern

```ts
import { setup, assign, fromPromise } from "xstate";

const bookingMachine = setup({
  types: {
    context: {} as { slot: SlotId | null; error: BookingError | null },
    events: {} as { type: "HOLD"; slot: SlotId } | { type: "CONFIRM" },
  },
  actors: {
    confirmBooking: fromPromise(
      async ({ input }: { input: { slot: SlotId } }) => confirm(input.slot),
    ),
  },
  guards: {
    hasSlot: ({ context }) => context.slot !== null,
  },
}).createMachine({
  id: "booking",
  initial: "browsing",
  context: { slot: null, error: null },
  states: {
    browsing: {
      on: {
        HOLD: {
          target: "held",
          actions: assign({ slot: ({ event }) => event.slot }),
        },
      },
    },
    held: {
      after: { 120000: { target: "browsing", actions: assign({ slot: null }) } },
      on: { CONFIRM: { target: "confirming", guard: "hasSlot" } },
    },
    confirming: {
      invoke: {
        src: "confirmBooking",
        input: ({ context }) => ({ slot: context.slot as SlotId }),
        onDone: { target: "confirmed" },
        onError: { target: "held" },
      },
    },
    confirmed: { type: "final" },
  },
});
```

The hold expiring is `after`, not a `setTimeout` somebody has to
remember to clear. The confirmation is `invoke`, so leaving
`confirming` cancels it. Both are the features that justified the
library; without them this is a union with extra ceremony.

## Testing

```ts
import { transition, initialTransition } from "xstate";

const [start] = initialTransition(bookingMachine);
const [held] = transition(bookingMachine, start, { type: "HOLD", slot: s1 });

expect(held.value).toBe("held");
expect(held.context.slot).toBe(s1);
```

No interpreter and no clock. A delayed transition is tested by
asserting the machine scheduled it, not by waiting for it.

## Red flags

- A machine with no hierarchy, no parallel region, no delay and no
  invoked actor
- A component holding a boolean that mirrors the machine's state
- A guard that reads anything but its own arguments
- An action that performs an effect rather than describing one
- `setTimeout` beside a machine that has `after`
- A test that sleeps

## Common mistakes

- **Adopting it for one screen.** A statechart is a shared vocabulary;
  one machine in a codebase of reducers is a second idiom.
- **Strings where a union would do.** State names in a config are not
  checked against a type unless you give the machine one.
- **Putting the domain in the machine.** Pricing, eligibility and
  validation are pure functions the machine calls, not actions.
- **An actor per row without a lifetime.** If nothing cancels it and
  nothing waits for it, it is a promise with more machinery. See
  [functional-making-effects-reliable](../functional-making-effects-reliable/SKILL.md).
- **Storing derived data in context.** It goes stale exactly the way
  stored derived state always does.

## Related skills

- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)
- [functional-managing-state-immutably](../functional-managing-state-immutably/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)

## Further reading

- [machines.md](references/machines.md) covers hierarchy and parallel
  regions, actors and their lifetimes, delays, and how a machine is
  persisted and restored.
