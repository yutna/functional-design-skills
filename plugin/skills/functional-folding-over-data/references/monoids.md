# Monoids

A monoid is a type with two things: a way to combine two values, and an
identity value that changes nothing. Combination must be associative, so
the grouping does not matter.

```text
combine : A -> A -> A
identity : A

-- laws
combine a identity == a
combine identity a == a
combine a (combine b c) == combine (combine a b) c
```

Nothing about this is abstract nonsense; it is the precise condition
under which a fold can be split, reordered, and run in parallel.

## Contents

- [Familiar examples](#familiar-examples)
- [What it buys](#what-it-buys)
- [Checking your own](#checking-your-own)
- [Semigroups](#semigroups)
- [Where it shows up in domain code](#where-it-shows-up-in-domain-code)

## Familiar examples

| Type        | Combine           | Identity |
| ----------- | ----------------- | -------- |
| Integer     | addition          | 0        |
| Integer     | multiplication    | 1        |
| Text        | concatenation     | empty    |
| List        | append            | empty    |
| Set         | union             | empty    |
| Map         | merge, right wins | empty    |
| Boolean     | and               | true     |
| Boolean     | or                | false    |
| `Option<A>` | first present     | None     |
| A -> A      | composition       | identity |

A type can be a monoid in several ways, which is why the combination is
named rather than assumed: "sum" and "product" are different monoids over
the same numbers.

## What it buys

**No empty special case.** The identity is the answer for an empty
collection, so `totalOf []` is zero rather than an error or a `None`.

**Parallelism for free.** Associativity means the collection can be split
anywhere, each part folded independently, and the results combined.

```text
total = parts |> parallelMap (fold combine identity)
              |> fold combine identity
```

**Composable summaries.** If two summary types are monoids, a record of
them is a monoid too, combined field by field. That is how one pass
produces several statistics without interleaving their logic.

```text
type Summary = { count: Integer, total: Money, currencies: Set<Currency> }
-- combine field-wise; identity is the identity of each field
```

## Checking your own

When defining a combination over a domain type, check the laws with three
property tests: left identity, right identity, and associativity. Failing
associativity is the common one, and it usually means the operation is
really "apply an update", which is a fold's step function rather than a
monoid. The general move -- write the claim as an equation over arbitrary
values, then let the property test be that equation -- is in
[functional-testing-functional-code](../../functional-testing-functional-code/SKILL.md).

```text
-- not associative: averaging two values at a time
combine a b = (a + b) / 2
-- combine (combine 1 2) 3 == 2.25
-- combine 1 (combine 2 3) == 1.75
```

The repair is almost always the same: accumulate what the operation
needs and derive the answer at the end. A running total and a count are
each a monoid, so the pair is one too, and the average comes out of the
final value.

```text
type Running = { total: Number, count: Integer }
combine a b = { total: a.total + b.total, count: a.count + b.count }
identity   = { total: 0, count: 0 }
average r  = if r.count == 0 then None else Some (r.total / r.count)
```

Last-write-wins is the case people expect to fail and it does not:
`if a.updatedAt > b.updatedAt then a else b` is a maximum, so it is
associative, and it is a valid semigroup. It becomes a monoid as soon as
there is a value older than every real one to act as the identity.

## Semigroups

Some useful combinations have no identity: `NonEmptyList`, "the maximum",
"the first element". These are semigroups, and they still support
splitting and parallel folding; they just cannot fold an empty
collection, which is why the result is an `Option` or the input must be
non-empty.

## Where it shows up in domain code

- Accumulating validation errors: `NonEmptyList` concatenation
- Merging configuration layers: map merge, later wins
- Combining permissions: set union
- Totalling money: addition, with the currency fixed
- Building a query: predicate conjunction, identity is "match all"
- Composing middleware: function composition, identity is `identity`

Recognising these as the same shape means one fold, one test of the laws,
and no bespoke traversal for each.
