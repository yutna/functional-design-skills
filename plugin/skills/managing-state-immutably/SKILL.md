---
name: managing-state-immutably
description: Use when code mutates shared data or updates a record in place, when a concurrent update is lost or races, or when deciding how state changes over time.
---

# Managing State Immutably

## Overview

Assignment is the source of most of the hard problems in software: a
value that changes cannot be reasoned about locally, cannot be shared
safely between threads, and cannot be replayed. Functional programming's
central move is to stop assigning: a transformation produces a new value
and leaves the old one alone.

State does not disappear. It becomes explicit: a value, transformed by
pure functions, held in exactly one place, and replaced under a
controlled swap. That is what makes concurrency safe by construction
rather than by discipline.

## When to use

- Data is mutated in place and read from several places
- A race condition, or a lock protecting shared data
- Deciding how an entity changes over time
- History, undo, or audit is needed
- A cache, counter, or connection pool needs a home

Not for: deciding which effects the system performs, which is
[separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md).

## Core rules

1. **Transform, do not mutate.** A function that changes a value returns
   a new one. The caller decides what to keep.
2. **State transitions are pure functions.** `State -> Event -> State`.
   No I/O inside, no clock, no randomness.
3. **Keep mutable state in one place, at the edge.** One reference cell,
   one database row, one actor. Not a field on ten objects.
4. **Swap, do not edit.** Replace the whole value atomically; never
   partially update a shared structure.
5. **Share structure instead of copying.** Persistent data structures
   make "a new version" cheap. See
   [persistent-structures.md](references/persistent-structures.md).
6. **Local mutation is acceptable when invisible.** Inside one function,
   never escaping, with a measurement that justified it.
7. **Do not defend with copies.** If values are immutable, defensive
   copying is dead code.

## Pattern

Mutation shared across readers:

```text
cart.items.push(item)         -- who else holds this cart?
cart.total = recalculate cart -- two steps: readers can see between them
```

Any code holding `cart` sees the change, possibly halfway through. Under
concurrency, two pushes can lose one. Under test, the previous state is
gone.

Transformation:

```text
addItem : Item -> Cart -> Cart
addItem item cart =
  { cart | items = cons item cart.items }

total : Cart -> Money         -- derived, never stored
```

The old cart still exists and is still valid. Concurrency is handled once
where the cart is stored, not at every mutation site.

## Where the mutable cell lives

Every system has state that outlives a request. Put it in exactly one
kind of place, chosen deliberately:

| Holder              | Suits                                     |
| ------------------- | ----------------------------------------- |
| Database row        | State that must survive a restart         |
| One reference cell  | In-process state: cache, registry, config |
| An actor or process | State with its own lifecycle and mailbox  |
| The caller's stack  | State that lives for one operation        |

Whichever is chosen, the update follows the same shape: read the current
value, compute a new one with a pure function, install it atomically.

```text
update : Reference<S> -> (S -> S) -> S
```

If the installation can fail because someone else changed it first, the
retry is a loop around the pure function, and the pure function is
unchanged. See
[concurrency.md](references/concurrency.md).

## Modelling change over time

Three representations, in increasing order of what they preserve:

**Current value.** The state as it is now. Cheapest, and enough when
history has no business meaning.

**Value plus version.** The state and a monotonically increasing number.
Enables safe concurrent updates and detects lost updates.

**Events, folded into a value.** Store what happened; derive the current
state by folding. Preserves history, enables audit and replay, and costs
storage and a projection step. See
[folding-over-data](../folding-over-data/SKILL.md).

Choose by what the business asks for. If someone will ever ask "how did
it get into this state", the answer must be stored, not reconstructed
from logs.

## Concurrency

Immutable values cannot be corrupted by concurrent readers, so the entire
class of data races disappears. What remains is the coordination of
updates to the one mutable cell, and that is a small, isolated problem:

- Readers need no locks, ever.
- Writers use an atomic swap with a version or compare-and-set.
- Contention is proportional to how much unrelated state shares one cell,
  which is an argument for small aggregates.

## Red flags

- A function that returns nothing but changes its argument
- A lock protecting a data structure rather than a resource
- Defensive copying on the way in or out of a function
- A field updated in two steps, with readers in between
- Global or module-level mutable state
- A cached value stored beside the data it is derived from
- Two threads calling the same "add" and one result disappearing

## Common mistakes

- **Copying everything.** Immutability without structural sharing is slow
  for large structures. Use the language's persistent collections.
- **Freezing shallowly.** A frozen record holding a mutable list is
  mutable.
- **Storing derived values.** Recompute, unless it must be frozen for a
  business reason, in which case it is a different concept with its own
  name.
- **Mutating inside a "pure" function.** A hidden accumulator makes the
  function untestable in parallel and unsafe to memoise.
- **Using a lock instead of a swap.** Locks compose badly and the value
  is already immutable; the swap is enough.

## Related skills

- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)
- [folding-over-data](../folding-over-data/SKILL.md)

## Further reading

- [persistent-structures.md](references/persistent-structures.md)
  explains structural sharing and when copying costs matter.
- [concurrency.md](references/concurrency.md) covers atomic updates,
  retries, idempotency, and the failure modes immutability does not fix.

Worth noting for confidence rather than for new content: the data-first
school arrives independently at the same advice — one state reference,
updated by comparing and swapping on a version, with all logic reading
immutable snapshots. It is the one principle both schools of functional
design state identically. See
[two-schools.md](../choosing-types-or-plain-data/references/two-schools.md).
