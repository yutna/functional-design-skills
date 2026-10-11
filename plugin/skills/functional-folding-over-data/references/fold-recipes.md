# Fold Recipes

The accumulator type for each common shape, and the combining function.

## Contents

- [Sum, count, average](#sum-count-average)
- [Maximum by a key](#maximum-by-a-key)
- [Grouping](#grouping)
- [Deduplicating while preserving order](#deduplicating-while-preserving-order)
- [Folding with failure](#folding-with-failure)
- [Accumulating every failure](#accumulating-every-failure)
- [Early exit](#early-exit)
- [Folding events into state](#folding-events-into-state)
- [Building a structure](#building-a-structure)
- [Folding a tree](#folding-a-tree)

## Sum, count, average

```text
-- accumulator: a pair, so one pass yields both
type Summary = { total: Satang, count: Integer }
step s x = { total: add s.total x, count: s.count + 1 }
combine a b =
  { total: add a.total b.total, count: a.count + b.count }
toAverage : Summary -> Option<Decimal>
toAverage s =
  if s.count == 0 then None else Some (toDecimal s.total / s.count)
average = fold step { total: zero, count: 0 } >> toAverage
```

Compute the average from the pair at the end, not during, so the
combining operation on `Summary` stays associative.

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
  fold (\acc x -> upsert (key x) (cons x) (single x) acc) emptyMap
```

Prepending builds each group in reverse; reverse once at the end if order
matters, rather than appending inside the fold.

## Deduplicating while preserving order

```text
type Acc = { seen: Set<K>, out: List<A> }
step key acc x =
  if member (key x) acc.seen then acc
  else { seen: insert (key x) acc.seen, out: cons x acc.out }

dedupe key =
  fold (step key) { seen: emptySet, out: [] }
    >> (\acc -> reverse acc.out)
```

`cons` builds `out` in reverse, so `dedupe` reverses it once at the end.

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
[composition-toolkit.md](../../functional-composing-functions/references/composition-toolkit.md).

## Accumulating every failure

```text
type Partial = { ok: List<B>, failed: List<E> }

step : Partial -> Result<B, E> -> Partial
step p r =
  match r with
  | Ok b -> { ...p, ok: cons b p.ok }
  | Error e -> { ...p, failed: cons e p.failed }
```

Both lists come out reversed; reverse them once after the fold.

Use this when a batch should report everything wrong rather than stopping.
Model the outcome explicitly: "three of five imported" is a report type,
not a `Result`.

## Early exit

A plain fold visits every element. When the answer is known early, use a
fold whose accumulator carries a stop flag, or the language's own
short-circuiting operation: `Enum.reduce_while/3` in Elixir, `some` in
JavaScript.

```text
type Search = Looking of S | Found of R

step acc x =
  match acc with
  | Found r -> Found r          -- ignore the rest
  | Looking s -> examine s x
```

This is correct but still traverses. Where the collection is large,
prefer a lazy sequence, where the traversal genuinely stops. See
[functional-using-recursion-and-laziness](../../functional-using-recursion-and-laziness/SKILL.md).

## Folding events into state

```text
applyEvent : Option<Booking> -> BookingEvent -> Option<Booking>
current : List<BookingEvent> -> Option<Booking>
current = fold applyEvent None
```

The first event creates the booking, so the seed is "no booking yet",
not an empty booking.

`applyEvent` is the whole business logic of the projection, and it is a
pure two-argument function that can be tested as a table of cases. Adding
a new event type is one new case.

## Building a structure

Where each element yields one element, that is `map`. Where the shape
does not fit, fold from the left, prepend, and reverse once. Running
totals are such a case, because each output depends on the one before:

```text
type Tally = { total: Satang, out: List<Satang> }

step : Tally -> BookedTreatment -> Tally
step acc t =
  let next = add acc.total t.price
  in { total: next, out: cons next acc.out }

runningTotals =
  fold step { total: zero, out: [] } >> (\acc -> reverse acc.out)
```

That is two linear passes and no quadratic append. A right fold builds
in order directly, and is the natural form only in a lazy language,
where it also works on infinite sequences.

## Folding a tree

The same shape: one function per case, applied bottom-up. Write the
type's fold once beside the type, then express every operation through
it.

```text
type Tree<A> =
  | Leaf of A
  | Node of (Tree<A>, Tree<A>)

foldTree : (A -> R) -> (R -> R -> R) -> Tree<A> -> R
foldTree leaf node t =
  match t with
  | Leaf a -> leaf a
  | Node (l, r) -> node (go l) (go r)
  where go = foldTree leaf node

sumTree = foldTree identity (+)
heightTree = foldTree (const 1) (\l r -> 1 + max l r)
flattenTree = foldTree single append
```

Three operations, no new recursion, and no chance of forgetting a case.
