---
name: functional-managing-state-immutably
description: Use when code mutates shared data or updates a record in place, when a concurrent update is lost or races, or when parallel work needs cancelling together.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.1
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
[functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md).

## Core rules

1. Rule. **Transform, do not mutate.** Never mutate a value that anything
   else can observe. A function that changes such a value returns a new
   one, and the caller decides what to keep. A value built inside one
   function and not yet returned is outside this rule; rule 6 says when
   mutating it is worth it.
2. Rule. **State transitions are pure functions.** No I/O inside, no
   clock, no randomness. The shape depends on the job. A transition is
   one function for each event, takes the specific source state, and
   returns the new state, or a `Result` when it can refuse, as
   [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
   says. `State -> Event -> State` is the fold that replays events
   already accepted, and it cannot refuse.
3. Default. **Keep each piece of mutable state with one owner, at the edge.**
   One reference cell, one database row, one actor, reached through the pure
   update function and owned by one module. Not a field on ten objects.
   Unrelated pieces of state get separate cells. State that lives for one
   operation is not this: it stays on the caller's stack, as a value passed
   along, and needs no cell.
4. Default. **Swap, do not edit.** Replace the whole value atomically; never
   partially update a shared structure.
5. Default. **Share structure instead of copying.** Persistent data structures
   make "a new version" cheap. A small value is simply copied: a record of six
   fields needs no persistent structure. Bring one in when a profile shows that
   copying a large collection costs. See
   [persistent-structures.md](references/persistent-structures.md).
6. Default. **Local mutation is acceptable when invisible.** It applies when the
   value is built inside one function, no reference to it escapes, into a
   closure or a callback included, and a measurement justified it. A transient
   or builder that is frozen before it is returned qualifies. A mutable
   accumulator that survives between calls does not. Where the language has no
   cheap way to add to an immutable collection, as JavaScript has none, building
   locally is the idiom and needs no measurement; the first two conditions still
   hold.
7. Default. **Do not defend with copies.** If values are immutable, defensive
   copying is dead code. Where a value is mutable and cannot be frozen, the copy
   is not dead: hand out a copy or an immutable view, never the internal
   reference.

## Pattern

Mutation shared across readers:

```text
booking.treatments.push(t)   -- who else holds this booking?
booking.total = recalculate booking -- two steps: readers see between
```

Any code holding `booking` sees the change, possibly halfway through.
Under concurrency, two pushes can lose one. Under test, the previous
state is gone.

Transformation:

```text
addTreatment : BookedTreatment -> Booking -> Booking
addTreatment t booking =
  { ...booking, treatments: cons t booking.treatments }

total : Booking -> Satang     -- derived, never stored
```

The old booking still exists and is still valid. Concurrency is handled
once where the booking is stored, not at every mutation site.

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
updateAtomically :
  Integer -> Reference<S> -> (S -> S) -> AsyncResult<S, Conflict>
```

It reads and writes a shared cell, so it has an effect type. If the
installation fails because someone else changed the value first, the
retry is a bounded loop around the pure function, and the pure function
is unchanged. When the bound is spent the caller receives a `Conflict`.
See
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
[functional-folding-over-data](../functional-folding-over-data/SKILL.md).

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
- Work that was spawned has an owner that waits for it or a handle that
  cancels it. Neither one is a leak, and cancellation is a value passed
  in rather than something done to a running computation. See
  [concurrency.md](references/concurrency.md).

## Red flags

- A function that returns nothing but changes its argument
- A lock protecting a data structure rather than a resource
- Defensive copying of values that are already immutable
- A field updated in two steps, with readers in between
- Mutable state reachable from many modules, rather than owned by one
- A cached value stored beside the data it is derived from
- Two threads calling the same "add" and one result disappearing

## Common mistakes

- **Copying everything.** Immutability without structural sharing is slow
  for large structures. Where a profile shows it, use the language's
  persistent collections.
- **Freezing shallowly.** A frozen record holding a mutable list is
  mutable.
- **Storing derived values.** Recompute, unless it must be frozen for a
  business reason, in which case it is a different concept with its own
  name.
- **Mutating inside a "pure" function.** An accumulator that survives
  between calls makes the function untestable in parallel and unsafe to
  memoise. One that is built and frozen inside a single call is rule 6.
- **Using a lock instead of a swap.** Locks compose badly and the value
  is already immutable; the swap is enough.

## Related skills

- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-enforcing-consistency-boundaries](../functional-enforcing-consistency-boundaries/SKILL.md)
- [functional-folding-over-data](../functional-folding-over-data/SKILL.md)

## Further reading

- [persistent-structures.md](references/persistent-structures.md)
  explains structural sharing, when copying costs matter, and where each
  language's implementations come from — including the two that ship
  none.
- [concurrency.md](references/concurrency.md) covers atomic updates,
  retries, idempotency, reading two sequences of effects against each
  other, and the failure modes immutability does not fix.

See
[two-schools.md](../functional-choosing-types-or-plain-data/references/two-schools.md)
for where the two schools of functional design agree, immutable data
among them.
