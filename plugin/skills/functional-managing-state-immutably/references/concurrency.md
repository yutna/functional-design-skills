# Concurrency Without Locks

Immutability removes data races: a value that cannot change cannot be
observed half-changed. What remains is coordinating updates to the few
cells that do change, and the failure modes that immutability does not
address.

## Contents

- [The update cycle](#the-update-cycle)
- [Choosing the coordination primitive](#choosing-the-coordination-primitive)
- [Idempotency](#idempotency)
- [Reading two sequences against each other](#reading-two-sequences-against-each-other)
- [What immutability does not fix](#what-immutability-does-not-fix)
- [Parallelism as a free gain](#parallelism-as-a-free-gain)
- [Testing concurrent state](#testing-concurrent-state)

## The update cycle

Every state change, whether in memory or in a database, has the same
shape:

1. Read the current value, with a version.
2. Compute the new value with a pure function.
3. Install it, conditional on the version being unchanged.
4. On conflict, go to step 1.

```text
updateAtomically ref f =
  loop:
    let (current, version) = read ref
    let next = f current
    if compareAndSet ref version next then next else loop
```

Properties worth noticing: the pure function is unchanged and untested by
concurrency; the retry is in one place; and no reader is blocked at any
point.

## Choosing the coordination primitive

| Primitive              | Suits                                    |
| ---------------------- | ---------------------------------------- |
| Atomic reference       | One in-process value, short computations |
| Optimistic row version | Database aggregates                      |
| Actor or process       | State with a lifecycle and a mailbox     |
| Queue plus one writer  | High contention, ordering matters        |
| Immutable snapshot     | Many readers, rare writers               |

Locks are still appropriate for genuine resources: a file handle, a
device, a connection. They are not needed for data.

## Idempotency

Retries mean an operation may run twice. Under concurrency that is not an
edge case, it is the normal path.

- A pure computation is naturally idempotent; running it twice costs
  time and nothing else.
- An effect is not. Charging a card twice is two charges.

The repair is at the shell: give each command an identifier, record that
it was performed, and make the write conditional on that record. The core
stays unaware, which is right, because idempotency is a property of the
effect, not of the decision.

## Reading two sequences against each other

The failures immutability does not remove are all the same shape: two
sequences of effects running at once, interleaving in a way nobody
wrote down. They are hard to reason about in prose and easy to see
drawn, so draw them.

One column per thing that runs independently — a request, a worker, a
tab, a retry of something already in flight. One row per step, in the
order that column performs them. Only effects and shared reads go on
it; pure computation cannot interleave with anything and is noise on
the diagram.

```text
  request A              request B
  ---------              ---------
  read balance 100
                         read balance 100
  write balance 90
                         write balance 80
```

Ten lost. Both columns are correct on their own, which is why reading
either one alone never finds it.

Three questions to ask of any such drawing:

1. **Which rows touch the same cell?** Only those can interact. If two
   columns share nothing, they are independent and need no
   coordination at all — the common case, and worth confirming rather
   than assuming.
2. **Can any row here be repeated?** A retry duplicates a column from
   some point onward. Draw the retry as a third column starting
   mid-way; if that changes the outcome, the effect needs an identity.
3. **Does the order between two columns matter?** If any interleaving
   is acceptable, nothing more is needed. If one specific order is
   required, the diagram is now a requirement and something must
   enforce it — a sequence number, a single writer, or a queue.

Three repairs, in order of preference:

- **Delete a column.** Make the work independent, so there is nothing
  to interleave. Splitting the shared cell so unrelated work stops
  contending is this, and it is why small aggregates help.
- **Make the rows commute.** An operation whose outcome does not depend
  on the order it lands in needs no coordination.
  `setStatus(confirmed)` commutes with a retry of itself;
  `addPayment(amount)` does not.
- **Join the columns.** Where neither works, one writer or one atomic
  swap forces a single order, and the update cycle above is that.

Keep the drawing. A comment beside the shared cell saying which columns
reach it, and which of the three repairs was chosen, is the kind of
fact no type states and the next reader cannot recover. See
[functional-writing-useful-comments](../../functional-writing-useful-comments/SKILL.md).

## What immutability does not fix

**Lost updates across aggregates.** Two operations that each change a
different aggregate consistently can still produce a combined state the
business forbids. That is a boundary question. See
[functional-enforcing-consistency-boundaries](../../functional-enforcing-consistency-boundaries/SKILL.md).

**Ordering.** Immutable values say nothing about which change happened
first. If order matters, make it explicit: a sequence number, a queue, or
a single writer.

**Contention.** If every request updates the same cell, immutability does
not help; the retries pile up. Split the state so unrelated work does not
share a cell.

**External effects.** Two concurrent workflows can both send an email.
Coordination for effects lives in the shell.

**Liveness.** A retry loop under heavy contention can starve. Bound the
retries, back off, and report a conflict to the caller rather than
looping forever.

## Parallelism as a free gain

Pure functions can be run in parallel with no coordination at all,
because there is nothing to coordinate. Wherever a pipeline maps a pure
function over a collection, parallelising it is a scheduling decision
with no correctness consequences.

```text
treatments |> parallelMap priceTreatment |> sum
```

Two cautions: the parallel version is only faster when the work per
element is substantial, and the function must genuinely be pure. A hidden
cache or counter inside it reintroduces every problem this skill removes.

## Testing concurrent state

- Test the pure transition exhaustively; it carries the business rules.
- Test the update cycle by simulating a conflict: force the version to
  change between read and install, and assert the retry produced a
  correct result.
- Test idempotency by performing the same command twice and asserting one
  effect.

None of these needs real threads, which is why they are worth writing.
