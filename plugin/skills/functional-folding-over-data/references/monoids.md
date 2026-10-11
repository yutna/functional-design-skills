# Monoids

A monoid is a type with two things: a way to combine two values, and an
identity value that changes nothing. In the code below the identity
value is named `unit`, so that `identity` stays the function that
returns its argument. Combination must be associative, so
the grouping does not matter.

```text
combine : A -> A -> A
unit : A

-- laws
combine a unit == a
combine unit a == a
combine a (combine b c) == combine (combine a b) c
```

Nothing about this is abstract nonsense; it is the precise condition
under which a fold can be split, and run in parallel with the parts
combined in their original order. Reordering the parts needs
commutativity as well, which not every monoid has: list append, text
concatenation and a map merge where the right side wins are not
commutative.

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
| String      | concatenation     | empty    |
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
total = parts |> parallelMap (fold combine unit)
              |> fold combine unit
```

**Composable summaries.** If two summary types are monoids, a record of
them is a monoid too, combined field by field. That is how one pass
produces several statistics without interleaving their logic.

```text
type Summary = { total: Satang, count: Integer }
-- combine field-wise; unit is the identity of each field
```

`Satang` is one currency, so its sum has a single total. Amounts in
several currencies have no single total; keep a
`Map<Currency, Satang>` instead, which is a monoid by merging with
addition.

## Checking your own

When defining a combination over a domain type, check the laws with three
property tests: left identity, right identity, and associativity. Failing
associativity is the common one. It usually means the answer is being
computed too early, as with an average, or that the operation is an
update with differently typed arguments, which is a fold's step function
rather than a monoid. The general move -- write the claim as an equation over arbitrary
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
type Summary = { total: Satang, count: Integer }
combine a b =
  { total: add a.total b.total, count: a.count + b.count }
unit = { total: zero, count: 0 }
average r =
  if r.count == 0 then None else Some (toDecimal r.total / r.count)
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
- Totalling money: addition, over one currency
- Building a query: predicate conjunction, identity is "match all"
- Composing middleware: function composition, identity is `identity`

Recognising these as the same shape means one fold, one test of the laws,
and no bespoke traversal for each.
