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
monoid.

```text
-- not associative: later values overwrite earlier ones asymmetrically
combine a b = if a.updatedAt > b.updatedAt then a else b
-- this one IS associative, and is a valid monoid with a minimal identity
```

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
