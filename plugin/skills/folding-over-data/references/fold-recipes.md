# Fold Recipes

The accumulator type for each common shape, and the combining function.

## Sum, count, average

```text
-- accumulator: a pair, so one pass yields both
type Stats = { sum: Money, count: Integer }
step s x = { sum: add s.sum x, count: s.count + 1 }
average = fold step { sum: zero, count: 0 } >> toAverage
```

Compute the average from the pair at the end, not during, so the fold
stays associative.

## Maximum by a key

```text
maxBy : (A -> K) -> List<A> -> Option<A>
maxBy key =
  fold (\best x ->
         match best with
         | None -> Some x
         | Some b -> if key x > key b then Some x else Some b)
       None
```

The `Option` accumulator handles the empty case without a special branch.

## Grouping

```text
groupBy : (A -> K) -> List<A> -> Map<K, NonEmptyList<A>>
groupBy key =
  fold (\acc x -> upsert (key x) (prepend x) (single x) acc) empty
```

Prepending builds each group in reverse; reverse once at the end if order
matters, rather than appending inside the fold.

## Deduplicating while preserving order

```text
type Acc = { seen: Set<K>, out: List<A> }
step key acc x =
  if member (key x) acc.seen then acc
  else { seen: insert (key x) acc.seen, out: cons x acc.out }
```

The accumulator carries two things: the answer, and what is needed to
compute it. That pattern covers most "loop with two variables" cases.

## Folding with failure

When a step can fail, the accumulator is a `Result` and the fold stops at
the first failure.

```text
foldResult :
  (S -> A -> Result<S, E>) -> S -> List<A> -> Result<S, E>
```

Prefer `traverse` when each element is validated independently and the
accumulator is just the list of outputs. See
[composition-toolkit.md](../../composing-functions/references/composition-toolkit.md).

## Accumulating every failure

```text
type Partial = { ok: List<B>, failed: List<E> }
```

Use this when a batch should report everything wrong rather than stopping.
Model the outcome explicitly: "three of five imported" is a report type,
not a `Result`.

## Early exit

A plain fold visits every element. When the answer is known early, use a
fold whose accumulator carries a stop flag, or the language's own
short-circuiting operation.

```text
type Search = Looking of S | Found of R

step acc x =
  match acc with
  | Found r -> Found r          -- ignore the rest
  | Looking s -> examine s x
```

This is correct but still traverses. Where the collection is large,
prefer a lazy sequence, where the traversal genuinely stops. See
[using-recursion-and-laziness](../../using-recursion-and-laziness/SKILL.md).

## Folding events into state

```text
applyEvent : Booking -> BookingEvent -> Booking
current : List<BookingEvent> -> Booking
current = fold applyEvent emptyBooking
```

`applyEvent` is the whole business logic of the projection, and it is a
pure two-argument function that can be tested as a table of cases. Adding
a new event type is one new case.

## Building a structure

To build a list in original booking without repeated appending:

```text
-- prepend then reverse: two linear passes, no quadratic append
result = fold (\acc x -> cons (f x) acc) [] xs |> reverse
```

Or fold from the right, which builds in order directly and, in a lazy
language, works on infinite sequences.

## Folding a map or a tree

The same shape: one function per case, applied bottom-up. Write the
type's fold once beside the type, then express every operation through
it.

```text
foldTree : (A -> R) -> (R -> R -> R) -> Tree<A> -> R
sumTree = foldTree identity (+)
heightTree = foldTree (const 1) (\l r -> 1 + max l r)
flattenTree = foldTree single append
```

Three operations, no new recursion, and no chance of forgetting a case.
