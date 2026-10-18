---
name: functional-folding-over-data
description: Use when a loop accumulates into a variable, when combining a collection into one value, when the same tree walk keeps being written again, or when a combining law matters.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.3.0
---

# Folding Over Data

**In this pack:** [how much design a task warrants](../functional-design/references/calibration.md),
[the notation](../functional-design/references/notation.md), and
[syntax per language](../functional-design/SKILL.md#language-packs).

## Overview

A fold reduces a structure to a value by combining its elements with a
function. Almost every loop that builds up a result is a fold in
disguise, and rewriting it as one removes the mutable accumulator, the
index, and the off-by-one errors, leaving only the combining step, which
is the part that carries meaning.

The same operation generalises past lists. Any recursive type has a fold:
one function per case, applied bottom-up. That is what replaces the
visitor pattern and most manual tree recursion.

## When to use

- A loop with an accumulator variable
- Summing, counting, grouping, or finding a maximum
- Walking a tree, an expression, or a nested document
- Deriving current state from a list of events
- Replacing a visitor or a recursive helper with an explicit shape

Not for: transforming each element independently, which is a map; or
selecting elements, which is a filter.

## Core rules

1. Default. **Name the accumulator type first.** What is being built determines
   the fold's shape more than the elements do. Naming it is not always declaring
   it: a fold that carries one value of a type that exists, such as a total in
   `Satang`, has its accumulator named already, and a record is declared only
   where the fold carries more than one value.
2. Rule. **The combining function is pure and total.** Same accumulator and
   element, same result, no effect.
3. Default. **Prefer the specific operation when one exists.** `sum`, `maximum`,
   `groupBy` and `count` say more than a fold with a lambda. One exists only for
   the type it was written for: a total of `Satang` is a fold with that type's
   own `add` and `zero`, because `sum` adds plain numbers. Totals per key,
   such as fees per clinician per week, are a `groupBy` and then a fold over
   each bucket. A single fold into a map is for a language or runtime with no
   `groupBy`.
4. Default. **Fold from the left, and reverse once when a list is built.** A
   left fold with a forced accumulator is iterative and constant in stack; see
   the accumulator rule in
   [laziness.md](../functional-using-recursion-and-laziness/references/laziness.md).
   Use a right fold only in a lazy language, or when the consumer takes the
   result a piece at a time. The reverse is for a linked list, whose cheap end
   is the front; a vector or an array that grows at its end is built in order
   and needs none.
5. Default. **Merge two folds into one pass only when they share a predicate or
   an accumulator.** The total and the count of the same treatments are one
   fold. Folds with nothing in common stay as separate passes, because combining
   them obscures all of them. A measurement showing that the extra pass costs is
   the one thing that joins them.
6. Default. **Give a recursive type its fold.** Write it once beside the type,
   and consume the type through it everywhere else. A recursive type that only
   one function walks is matched in that function; its fold is written when the
   walk would otherwise be written a second time.

## Pattern

Loop with accumulators:

```text
total = 0
count = 0
for t in booking.treatments:
  if t.billable:
    total = total + t.price
    count = count + 1
```

Two mutable accumulators, an implicit order, and a shape that cannot be
reused or run in parallel.

Fold:

```text
type Summary = { total: Satang, count: Integer }

addTreatment : Summary -> BookedTreatment -> Summary
addTreatment s t =
  if t.billable
  then { total: add s.total t.price, count: s.count + 1 }
  else s

summarise : List<BookedTreatment> -> Summary
summarise = fold addTreatment { total: zero, count: 0 }
```

`addTreatment` is a pure function that can be tested with two values, and
`summarise` has no mechanism left to get wrong.

## Recognising a fold

| Loop shape                                | Operation      |
| ----------------------------------------- | -------------- |
| Accumulate a single value                 | fold           |
| Build a new collection element-wise       | map            |
| Keep some elements                        | filter         |
| Accumulate, may fail                      | fold + Result  |
| Accumulate while a condition holds        | fold with stop |
| Produce a value per element and one total | fold on a pair |
| Group into buckets                        | groupBy        |
| Find the first match                      | find           |

The signal is the accumulator: any variable declared before the loop and
updated inside it is a fold's accumulator.

## Folding a recursive type

```text
type Expr =
  | Lit of Integer
  | Add of (Expr, Expr)
  | Mul of (Expr, Expr)

foldExpr :
  (Integer -> R) -> (R -> R -> R) -> (R -> R -> R) -> Expr -> R
foldExpr lit add mul e =
  match e with
  | Lit n -> lit n
  | Add (a, b) -> add (go a) (go b)
  | Mul (a, b) -> mul (go a) (go b)
  where go = foldExpr lit add mul

evaluate = foldExpr identity (+) (*)
depth = foldExpr (const 1) (\a b -> 1 + max a b) (\a b -> 1 + max a b)
```

One traversal, written once. Every operation over `Expr` is then three
small functions rather than a new recursive walk with its own chance of
missing a case. This is the visitor pattern with the scaffolding removed.

## Combining with a monoid

When the combining operation has an identity and is associative, folding
becomes splittable and parallelisable, with the parts combined in their
original order, and empty collections stop being a special case.
Reordering the parts needs one more law, commutativity.

```text
-- (add, zero) is a monoid over Satang, which is one currency
totalOf = fold add zero
```

Associativity is what allows a fold to be split across workers and the
partial results combined. See
[monoids.md](references/monoids.md).

## Fold in each language

- **JavaScript and TypeScript.** A fold is `Array.prototype.reduce`,
  and `reduceRight` folds from the right. Always pass the initial value:
  without one, `reduce` on an empty array throws a `TypeError`. An early
  exit is `some`, which stops at the first truthy result. Grouping is
  `Object.groupBy`, or `Map.groupBy` for keys that are not strings.
- **Elixir.** A fold is `Enum.reduce/3`. An early exit is
  `Enum.reduce_while/3`, whose function returns `{:cont, acc}` or
  `{:halt, acc}`. Grouping is `Enum.group_by`, and counting each distinct
  value is `Enum.frequencies`. `Stream` is the lazy counterpart of
  `Enum`.

## Red flags

- A mutable accumulator declared above a loop
- The same traversal of a tree written in three places
- A second recursive helper whose only job is to walk the same structure
- An index variable used only to step through a collection
- Nested loops building a map that a `groupBy` would produce
- A fold whose combining function performs I/O

## Common mistakes

- **Folding when a specific operation exists.** `fold (+) 0` is `sum`
  with more moving parts.
- **Putting effects in the combining function.** The fold then cannot be
  reordered, parallelised, or tested with values. Fold to a description,
  then perform it.
- **Using a right fold on a huge strict list.** In a strict language that
  builds a deep call stack; use a left fold.
- **Merging unrelated folds for speed.** Three clear passes beat one
  clever one unless a measurement says otherwise.
- **Reimplementing the walk each time.** Write the type's fold once.

## Related skills

- [functional-using-recursion-and-laziness](../functional-using-recursion-and-laziness/SKILL.md)
- [functional-composing-functions](../functional-composing-functions/SKILL.md)
- [functional-translating-gof-patterns](../functional-translating-gof-patterns/SKILL.md)
- [functional-managing-state-immutably](../functional-managing-state-immutably/SKILL.md)

## Further reading

- [fold-recipes.md](references/fold-recipes.md) gives the fold for the
  common accumulation shapes, including fallible and early-exit folds.
- [monoids.md](references/monoids.md) explains identity and
  associativity, what they buy, and how to repair an operation that
  fails associativity.
