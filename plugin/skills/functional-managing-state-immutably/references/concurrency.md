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
- [Who owns work that was started](#who-owns-work-that-was-started)
- [Testing concurrent state](#testing-concurrent-state)

## The update cycle

Every state change, whether in memory or in a database, has the same
shape:

1. Read the current value, with a version.
2. Compute the new value with a pure function.
3. Install it, conditional on the version being unchanged.
4. On conflict, go to step 1, up to a bound; then report the conflict.

```text
updateAtomically :
  Integer -> Reference<S> -> (S -> S) -> AsyncResult<S, Conflict>
updateAtomically attempts ref f =
  repeat at most `attempts` times:
    let (current, version) = read ref
    let next = f current
    if compareAndSet ref version next then return Ok next
  return Error Conflict
```

`read` and `compareAndSet` reach shared state, so `updateAtomically` has
an effect type; `f` is the pure function and stays pure. Properties
worth noticing: the pure function is unchanged and untested by
concurrency; the retry is in one place and bounded; and no reader is
blocked at any point.

## Choosing the coordination primitive

| Primitive              | Suits                                    |
| ---------------------- | ---------------------------------------- |
| Atomic reference       | One in-process value, short computations |
| Optimistic row version | Database aggregates                      |
| Actor or process       | State with a lifecycle and a mailbox     |
| Queue plus one writer  | High contention, ordering matters        |
| Immutable snapshot     | Many readers, rare writers               |

In Elixir, an `Agent` runs each update function inside the agent
process, one at a time, so it serves as the atomic reference and as a
small actor; `:atomics` has `compare_exchange` but holds only 64-bit
integers. In JavaScript, a synchronous read-compute-write with no
`await` between the read and the write cannot be interleaved with other
code in the same thread. Across threads, `Atomics.compareExchange` works
on integers in a `SharedArrayBuffer`.

Locks are still appropriate for genuine resources: a file handle, a
device, a connection. They are not needed for data.

## Idempotency

Retries mean an operation may run twice. Under concurrency that is not an
edge case, it is the normal path.

- A pure computation can run twice at no cost but time, because it
  performs nothing.
- An effect is not. Charging a card twice is two charges.

The repair is at the shell: give each command an identifier, record that
it was performed, and make the write conditional on that record. The core
stays unaware, which is right, because idempotency is a property of the
effect, not of the decision.

## Reading two sequences against each other

The failures the diagram below catches are all the same shape: two
sequences of effects running at once, interleaving in a way nobody
wrote down. The other failure modes, listed further down, are outside
that claim. They are hard to reason about in prose and easy to see
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

Four repairs, in order of preference:

- **Delete a column.** Make the work independent, so there is nothing
  to interleave. Splitting the shared cell so unrelated work stops
  contending is this, and it is why small aggregates help.
- **Make the rows commute.** Operations whose outcome does not depend
  on the order they land in need no coordination. Two `addPayment`
  calls give the same sum in either order; two `setStatus` calls with
  different statuses do not, because the last write wins.
- **Make the rows idempotent.** Where a row may be repeated, applying it
  twice must equal applying it once. `setStatus(confirmed)` twice is
  safe. `addPayment(amount)` twice is not, so it needs an identity.
- **Join the columns.** Where neither works, one writer or one atomic
  swap forces a single order, and the update cycle above is that.

Keep the drawing. A comment beside the shared cell saying which columns
reach it, and which of the four repairs was chosen, is the kind of
fact no type states and the next reader cannot recover. See
[functional-writing-useful-comments](../../functional-writing-useful-comments/SKILL.md).

## What immutability does not fix

**Invariants across aggregates.** Two operations that each change a
different aggregate consistently can still produce a combined state the
business forbids. That is a boundary question. See
[functional-enforcing-consistency-boundaries](../../functional-enforcing-consistency-boundaries/SKILL.md).

**Ordering.** Immutable values say nothing about which change happened
first. If order matters, make it explicit: a sequence number, a queue, or
a single writer.

**Contention.** If every request updates the same cell, immutability does
not help; the retries pile up. Split the state so unrelated work does not
share a cell.

**External effects.** Two concurrent handlers can both send an email.
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

## Who owns work that was started

Immutability removes data races. It says nothing about a computation
that is still running after everyone stopped caring about it, and that
is the failure this section is about.

**Every spawned computation has a parent that waits for it, or a handle
that can stop it.** One or the other, chosen deliberately. Work with
neither is a leak, and it fails in four ways that look unrelated until
you notice they share a cause:

- The request that wanted the answer returned without it, so the work
  is now computing something nobody will read.
- Its failure has nowhere to go. There is no caller to return an error
  to, so it is logged at best and swallowed at worst.
- Shutdown cannot drain. A process that does not know what is running
  cannot wait for it, so it either hangs or kills work mid-effect.
- Load is unbounded. Nothing counts what has been started, so nothing
  can refuse to start more.

The shape that fixes all four is the same: the spawn returns something,
and the thing it returns is held.

```text
scope (fun spawn ->
  let catalogue = spawn (loadCatalogue clinic)
  let openSlots = spawn (loadOpenSlots clinic)
  await2 catalogue openSlots)
```

The scope does not return until both children have. If either fails,
the other is cancelled rather than left to finish work whose result is
already useless. Both children here only read. A child that changed the
world, such as one that held a slot, would leave the hold in place when
its sibling failed, and would need a compensation step to release it;
see the cancellation section below.

Runtimes name the scope differently -- a nursery, a task group, a
supervised scope. In Elixir, `Task.Supervisor` supervises the children,
and `Task.async_stream` runs a bounded number of linked tasks and waits
for all of them. In JavaScript and TypeScript, `Promise.all` rejects as
soon as one child rejects but does not cancel the others, so pass each
child the `signal` of one `AbortController` and call `abort()` when
`Promise.all` rejects. A language without a scope is a language where
you write the join by hand and must not forget it.

### Cancellation is cooperative, and it is a value

Almost nowhere can one computation stop another outright. What actually
happens is that a cancellation signal is passed in, and the work checks
it at points where stopping is safe.

That makes cancellation a parameter, which puts it under the same rule
as time and randomness: it is an effect wearing an innocent face. See
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).

Two consequences worth stating:

- **The pure core is not cancellable and does not need to be.** A pure
  function that takes long enough to want cancelling is a chunking
  problem, not a concurrency one: split the input and check between
  chunks.
- **A cancelled effect is not an undone effect.** Cancelling a charge
  that was already sent leaves the charge. Undo is compensation, which
  is a business operation with a business name. See
  [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

### Testing it

Assert that the spawned work stopped, not that cancellation was
requested. A test that checks a flag was set proves the caller tried;
only observing the effect that did not happen proves it worked.

## Testing concurrent state

- Test the pure transition exhaustively; it carries the business rules.
- Test the update cycle by simulating a conflict: force the version to
  change between read and install, and assert the retry produced a
  correct result.
- Test idempotency by performing the same command twice and asserting one
  effect.

None of these needs real threads, which is why they are worth writing.
