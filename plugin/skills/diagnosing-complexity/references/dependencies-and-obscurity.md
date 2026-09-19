# Where Dependencies Hide in Functional Code

A dependency exists when a piece of code cannot be understood or changed
in isolation. Purity removes some kinds outright; the rest simply move.
This is the catalogue, with the removal for each.

## Ordering dependencies

Two functions must be called in a particular order, and nothing enforces
it.

```text
validate : Booking -> Booking
price    : Booking -> Booking        -- crashes unless validate ran first
```

**Remove it** by making the output type of one step the input type of the
next, so the wrong order will not compile or will fail an obvious test.

```text
validate : UnvalidatedBooking -> Result<ValidatedBooking, ValidationError>
price    : ValidatedBooking -> PricedBooking
```

Related: [modeling-state-machines](../../modeling-state-machines/SKILL.md).

## Hidden input dependencies

The result depends on something not passed in: a clock, an environment
variable, module-level state, a random source, the current locale.

**Remove it** by passing the value or the capability as a parameter. A
function that takes `now: Instant` is testable and honest; one that calls
the clock is neither.

Related: [parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

## Shared mutable state

Two call sites read and write the same cell, so each one's behaviour
depends on the other's history.

**Remove it** by returning new values instead of mutating, and by keeping
whatever state genuinely must persist in one place at the edge.

Related: [managing-state-immutably](../../managing-state-immutably/SKILL.md).

## Structural type overlap

Two concepts have the same shape, so a caller can pass one where the
other is meant and nothing objects.

```text
alias CustomerId = String
alias BookingId = String
lookup : CustomerId -> BookingId -> Result<Booking, Error>   -- swappable
```

**Remove it** with distinct types, even in dynamically typed languages,
where a one-field wrapper or a tag field does the same job at runtime.

Related: [constraining-primitive-values](../../constraining-primitive-values/SKILL.md).

## Duplicated invariants

The same business rule is enforced in two modules, so they can drift.

**Remove it** by giving the rule one owner: a smart constructor, a
parser, or a single validation step that everyone downstream trusts.

## Shape dependencies across a boundary

An internal type is serialised directly, so the storage or wire format
now constrains the domain model.

**Remove it** with an explicit mapping at the boundary.

Related: [crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Obscurity: the multiplier

Obscurity is not a dependency; it is what stops you seeing one. The same
dependency is cheap when visible and lethal when hidden.

| Obscurity                        | What it hides              |
| -------------------------------- | -------------------------- |
| Generic name (`data`, `handle`)  | What the value means       |
| `String` for a constrained value | The legal values           |
| Exception thrown, not in type    | A branch the caller needs  |
| Optional field with no comment   | When it is absent, and why |
| Boolean parameter at a call site | Which behaviour was chosen |
| Result ignored by convention     | That failure is possible   |

The test for obscurity: could a competent developer who has never seen
this code make a correct change using only what is visible from the call
site? If not, the missing information belongs in the name, the type, or a
comment, in that order of preference.
