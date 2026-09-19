---
name: folding-over-data
description: Use when a loop accumulates into a variable, when combining a collection into one value, or when traversing a tree or other recursive structure.
---

# Folding Over Data

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

1. **Name the accumulator type first.** What is being built determines
   the fold's shape more than the elements do.
2. **The combining function is pure and total.** Same accumulator and
   element, same result, no effect.
3. **Prefer the specific operation when one exists.** `sum`, `maximum`,
   `groupBy` and `count` say more than a fold with a lambda.
4. **Fold from the left for accumulation, from the right to build a
   structure.** Left folds are iterative and constant in stack; right
   folds build lazily and suit infinite sequences.
5. **One fold per pass, unless the passes are independent.** Combining
   three folds into one obscures all three; profile before merging.
6. **Give a recursive type its fold.** Write it once beside the type, and
   consume the type through it everywhere else.

## Pattern

Loop with accumulators:

```text
total = 0
count = 0
for line in lines:
  if line.taxable:
    total = total + line.amount
    count = count + 1
```

Three mutable variables, an implicit booking, and a shape that cannot be
reused or run in parallel.

Fold:

```text
type Summary = { total: Money, count: Integer }

addLine : Summary -> Line -> Summary
addLine s line =
  if line.taxable
  then { total: add s.total line.amount, count: s.count + 1 }
  else s

summarise : List<Line> -> Summary
summarise = fold addLine { total: zero, count: 0 }
```

`addLine` is a pure function that can be tested with two values, and
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
  | Lit of Number
  | Add of Expr * Expr
  | Mul of Expr * Expr

foldExpr :
  (Number -> R) -> (R -> R -> R) -> (R -> R -> R) -> Expr -> R
foldExpr lit add mul e =
  match e with
  | Lit n -> lit n
  | Add a b -> add (go a) (go b)
  | Mul a b -> mul (go a) (go b)
  where go = foldExpr lit add mul

evaluate = foldExpr identity (+) (*)
depth = foldExpr (const 1) (\a b -> 1 + max a b) (\a b -> 1 + max a b)
```

One traversal, written once. Every operation over `Expr` is then three
small functions rather than a new recursive walk with its own chance of
missing a case. This is the visitor pattern with the scaffolding removed.

## Combining with a monoid

When the combining operation has an identity and is associative, folding
becomes reorderable and parallelisable, and empty collections stop being
a special case.

```text
-- (add, zero) is a monoid over Money
totalOf = fold add zero
```

Associativity is what allows a fold to be split across workers and the
partial results combined. See
[monoids.md](references/monoids.md).

## Red flags

- A mutable accumulator declared above a loop
- The same traversal of a tree written in three places
- A recursive helper whose only job is to walk a structure
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

- [using-recursion-and-laziness](../using-recursion-and-laziness/SKILL.md)
- [composing-functions](../composing-functions/SKILL.md)
- [translating-gof-patterns](../translating-gof-patterns/SKILL.md)
- [managing-state-immutably](../managing-state-immutably/SKILL.md)

## Further reading

- [fold-recipes.md](references/fold-recipes.md) gives the fold for the
  common accumulation shapes, including fallible and early-exit folds.
- [monoids.md](references/monoids.md) explains identity and
  associativity, and what they buy.
