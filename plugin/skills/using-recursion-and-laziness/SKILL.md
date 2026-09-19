---
name: using-recursion-and-laziness
description: Use when a stack overflows, when data is too large to hold in memory, when an expensive result is recomputed, or when writing recursive functions.
---

# Using Recursion and Laziness

## Overview

Recursion replaces the loop when a computation is defined in terms of
itself, and it is the natural way to consume the recursive types a domain
model produces. Laziness delays a computation until its result is needed,
which turns infinite sequences into ordinary values and lets a pipeline
process more data than fits in memory.

Both are mechanics rather than design principles, but getting them wrong
produces the two most common runtime failures in functional code: a stack
that overflows on real data, and a computation repeated a thousand times
because nobody noticed it was not cached.

## When to use

- Consuming a tree, an expression, or any recursive type
- A stack overflow on input larger than the test data
- The same pure computation runs repeatedly with the same arguments
- A collection is too large to hold in memory
- Generating a sequence with no natural end

Not for: reducing a collection to a value, which is
[folding-over-data](../folding-over-data/SKILL.md).

## Core rules

1. **Write the base case first.** Then the recursive case, and check that
   it always moves towards the base.
2. **Make the recursive call the last thing.** A tail call can be turned
   into a loop; a call whose result is then modified cannot.
3. **Know whether your language eliminates tail calls.** If it does not,
   bound the depth, use an explicit accumulator loop, or trampoline.
4. **Prefer an existing traversal.** Fold, map, and unfold cover most
   cases; hand-written recursion is for shapes they do not fit.
5. **Memoise only pure functions**, and own the cache in one place.
6. **Use laziness for size, not for style.** An unevaluated computation
   holding a reference to a large structure is a leak with a nice name.
7. **Force at the boundary.** A lazy value crossing into the shell should
   be evaluated where its cost and failures are visible.

## Recursion shapes

```text
-- not tail recursive: the multiply happens after the call returns
factorial n = if n <= 1 then 1 else n * factorial (n - 1)

-- tail recursive: nothing happens after the call
factorial n = go n 1
  where go n acc = if n <= 1 then acc else go (n - 1) (n * acc)
```

The second form runs in constant stack space where the language
eliminates tail calls, and is a plain loop where it does not.

| Situation               | Approach                           |
| ----------------------- | ---------------------------------- |
| Reducing a list         | fold, not recursion                |
| Generating a list       | unfold, or a lazy sequence         |
| Walking a tree          | The type's fold                    |
| Depth bounded and small | Direct recursion is fine           |
| Depth unbounded         | Tail call, loop, or explicit stack |
| Mutual recursion, deep  | Trampoline                         |

More in
[recursion-recipes.md](references/recursion-recipes.md).

## Laziness

A lazy value is a computation that has not run yet, and runs at most
once. Two uses justify it:

**Unbounded sequences.** Describe the whole sequence, take what is
needed.

```text
naturals = iterate (+1) 0
firstTen = take 10 naturals
```

**Avoiding work that may not be needed.** A fallback that is expensive to
compute, an error message that is rarely rendered, a branch of a decision
tree not taken.

```text
orElseLazy : (Unit -> A) -> Option<A> -> A
```

In a strict language, the delay is expressed by passing a function of no
arguments, which is the same idea without the syntax.

## Streaming

The practical payoff of laziness is processing data larger than memory,
one element at a time, through a pipeline that reads like a list
operation.

```text
readLines path
  |> map parseRow
  |> filter isRelevant
  |> take 1000
  |> toList
```

Nothing is read until the last step asks, and only a thousand relevant
rows are ever materialised. See
[laziness.md](references/laziness.md).

## Memoisation

Caching the result of a pure function keyed by its arguments. Correct
only when the function is genuinely pure, and safe only when the cache
has one owner and a bound.

```text
memoise : (A -> B) -> (A -> B)
```

Three questions before applying it:

1. Is the function pure? A hidden clock or lookup makes the cache wrong.
2. Is the key space bounded, or is there an eviction policy? Otherwise it
   is a memory leak.
3. Is it actually hot? Measure. See
   [designing-for-performance.md](../programming-strategically/references/designing-for-performance.md).

## Red flags

- A recursive function with no obvious base case
- A recursive call whose result is then modified, on unbounded input
- A stack overflow that appears only in production data volumes
- A pure function called with the same arguments inside a loop
- A lazy value stored in a long-lived structure
- Reading a whole file into memory before processing it
- A memoisation cache with no bound and no owner

## Common mistakes

- **Assuming tail-call elimination.** Most mainstream runtimes do not do
  it. Check, and write a loop if not.
- **Recursing where a fold exists.** The fold is tested, named, and hard
  to get wrong.
- **Leaking through laziness.** An unevaluated computation keeps
  everything it references alive.
- **Memoising an impure function.** The first result is returned forever,
  including the failure.
- **Forcing a lazy sequence twice.** In some languages a second traversal
  recomputes everything. Materialise once if it is used twice.
- **Streaming with an effect in the middle.** Ordering and failure become
  hard to reason about; keep effects at the ends.

## Related skills

- [folding-over-data](../folding-over-data/SKILL.md)
- [managing-state-immutably](../managing-state-immutably/SKILL.md)
- [composing-functions](../composing-functions/SKILL.md)
- [programming-strategically](../programming-strategically/SKILL.md)

## Further reading

- [recursion-recipes.md](references/recursion-recipes.md) covers
  accumulators, trampolines, explicit stacks, and mutual recursion.
- [laziness.md](references/laziness.md) covers streams, the leak
  patterns, and when strictness is the better choice.
