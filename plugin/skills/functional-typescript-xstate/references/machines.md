# Machine Shapes

The four capabilities that justify a statechart, and what each one
costs. If a lifecycle uses none of them, the machine is a union with a
config file around it.

## Contents

- [Hierarchy](#hierarchy)
- [Parallel regions](#parallel-regions)
- [Delays](#delays)
- [Actors and their lifetimes](#actors-and-their-lifetimes)
- [Persisting and restoring](#persisting-and-restoring)
- [What stays outside the machine](#what-stays-outside-the-machine)

## Hierarchy

Hierarchy earns its place when several states share a transition. A
parent state holds the shared transition and the children stay small.

```ts
const editing = {
  initial: "clean",
  on: { CANCEL: { target: "#form.browsing" } },
  states: {
    clean: { on: { CHANGE: "dirty" } },
    dirty: { on: { SUBMIT: "#form.saving" } },
  },
};
```

`CANCEL` is written once and works from either child. Without
hierarchy it is copied into both, which is the duplication a union
would also have had.

The test: if removing the parent would mean repeating a transition,
the hierarchy is doing work. If not, it is a folder.

## Parallel regions

Parallel regions are for parts of one lifecycle that are genuinely
independent and genuinely simultaneous.

```ts
const appointment = createMachine({
  type: "parallel",
  states: {
    payment: { initial: "unpaid", states: { unpaid: {}, paid: {} } },
    attendance: {
      initial: "expected",
      states: { expected: {}, arrived: {} },
    },
  },
});
```

A patient can pay before or after arriving, and the two orders are
both legal. Modelling that as one flat union needs a case per
combination, which is the multiplication a parallel region removes.

The warning sign is a region nobody transitions independently: two
regions that always move together are one region.

## Delays

`after` makes time a trigger the machine owns, which means the timer
is cancelled when the state is left. That is the part hand-written
timers get wrong.

```ts
// in setup({ ... }): delays: { holdWindow: 120_000 }
const held = {
  after: { holdWindow: { target: "browsing" } },
  on: { CONFIRM: { target: "confirming" } },
};
```

This is the `held` state of the machine in [SKILL.md](../SKILL.md),
without the action that clears the slot when the hold expires.
Confirming leaves `held`, so the expiry cannot fire afterwards. A
`setTimeout` in a component has to be cleared by somebody, and the bug
is always the path where nobody did.

The delay is named in `setup` because the number means something:
`holdWindow` says what it is for, and `120000` would be a magic number.
How long a hold lasts is the server's rule. The machine's copy only
times the screen, and where the two have to agree the server sends how
long is left and the machine uses that as its delay.

## Actors and their lifetimes

An invoked actor lives exactly as long as the state that invoked it.
Leaving the state cancels it, which is the rule about spawned work
having an owner, enforced by the machine rather than remembered. See
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

- **`invoke`** for one actor tied to one state. The common case.
- **`spawn`** for a variable number, one per item, each stored in
  context. Now the lifetime is yours to manage again, so store the
  reference and stop it deliberately.

An actor is also where an effect belongs. The machine decides; the
actor performs; the result comes back as an event.

## Persisting and restoring

A machine's state is a value, so it can be stored and resumed. Two
things do not survive the round trip:

- **A running actor.** It was not part of the state; it was work in
  flight. On restore the invocation is started again with the input
  it had, so it must be safe to repeat. A machine that is persisted
  therefore takes the hold's own identifier from the `HOLD` event,
  beside the slot, keeps it in context, and passes it as the actor's
  input, for the service to answer a second confirmation as it
  answered the first. The slot alone, which the pack's example passes,
  is not a key: a slot can be held again by somebody else.
- **A pending delay.** The timer is not restored, so the delayed
  transition does not fire. If the deadline is a business fact rather
  than a debounce, put the timestamp in context and compute from it,
  instead of relying on the timer.

## What stays outside the machine

- **Domain rules.** Pricing, eligibility, validation. The machine
  calls them; it does not contain them.
- **Derived values.** Compute them where they are read. Context is
  state, and stored derivations go stale here like anywhere else.
- **Presentation.** A machine that knows which component renders each
  state has taken on a second job.
