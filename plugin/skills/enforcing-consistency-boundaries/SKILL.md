---
name: enforcing-consistency-boundaries
description: Use when deciding what one transaction must cover, when two entities have to stay in step, or when identity and equality of domain values are unclear.
---

# Enforcing Consistency Boundaries

## Overview

Some rules must hold at every instant: a booking's total equals the sum of
its treatments; a booking never double-books a room. Others may lag: a
customer's loyalty points can catch up with their purchases a second
later. Deciding which is which, and drawing a boundary around each set of
rules that must hold together, is what makes a system both correct and
able to scale.

The unit is the **aggregate**: a cluster of data with one entry point,
whose invariants hold whenever a change to it completes. One aggregate is
one transaction. Between aggregates, consistency is eventual, and that is
a design decision to be made explicitly rather than a compromise.

## When to use

- Deciding what a single database transaction covers
- Two records must stay in agreement and sometimes do not
- Designing an update that touches several entities
- A rule spans entities and nobody owns it
- Deciding whether a type has identity or is a plain value

Not for: drawing boundaries between subsystems, which is
[capturing-the-domain](../capturing-the-domain/SKILL.md).

## Identity and equality

Two different kinds of domain type, with different equality:

| Kind   | Equality                       | Example               |
| ------ | ------------------------------ | --------------------- |
| Entity | Same identifier, whatever else | `Booking`, `Customer` |
| Value  | Same contents, no identifier   | `Money`, `Address`    |

Consequences worth acting on:

- An entity's identifier is assigned once and never changes. Two bookings
  with the same contents are still two bookings.
- A value is replaced, never mutated. Changing a customer's address means
  a new `Address` value, not an edit to the old one.
- Do not give a value an identifier because storage wants a primary key.
  That is a storage concern; map it at the edge.

## Core rules

1. **List the invariants first.** Write each rule as a sentence. "An
   booking's total equals the sum of its treatments."
2. **Group by invariant, not by relationship.** Data that must be
   consistent together lives in the same aggregate. A foreign key is not
   a reason to group.
3. **One entry point per aggregate.** All changes go through the root;
   nothing reaches inside to modify a part.
4. **One aggregate, one transaction.** If an operation must change two
   aggregates atomically, either the boundary is wrong or the rule is
   eventual.
5. **Reference other aggregates by identifier**, never by holding their
   value. Holding it invites updating it.
6. **Keep aggregates small.** The smallest cluster that keeps its
   invariants is the right one; large aggregates serialise unrelated
   work.
7. **Say what happens between aggregates.** An event, a retry, a
   reconciliation. "Eventually consistent" without a mechanism is a bug
   with a name.

## Pattern

Boundary drawn around a relationship:

```text
-- one aggregate holding a customer and every booking they ever made
type Customer = { id: CustomerId, profile: Profile,
                  bookings: List<Booking> }
```

Confirming one booking now loads and rewrites every booking. Two bookings confirmed
at once conflict, though they share no rule. Nothing here needs to be
consistent across bookings.

Boundary drawn around invariants:

```text
-- aggregate: a booking and its treatments, because the total rule spans them
type Booking = { id: BookingId, customer: CustomerId,
               treatments: NonEmptyList<BookedTreatment> }
total : Booking -> Money

-- separate aggregate: the customer, referenced by identifier
type Customer = { id: CustomerId, profile: Profile,
                  credit: CreditLimit }
```

The booking's rule holds inside its own transaction. Concurrent bookings do
not conflict. The credit-limit rule spans both aggregates, so it becomes
an explicit step in the workflow, with an explicit answer for what
happens when it is violated after the fact.

## Rules that span aggregates

When a rule involves two aggregates, choose one and record why:

| Option               | When it fits                             |
| -------------------- | ---------------------------------------- |
| Merge the aggregates | The rule is truly instantaneous and the  |
|                      | combined size stays small                |
| Check then act       | A stale read is acceptable; the risk is  |
|                      | small and correctable                    |
| Reserve then confirm | Double-booking must not happen; take a   |
|                      | short-lived claim first                  |
| Compensate after     | Violations are rare and reversible       |
| Move the rule        | The rule belongs to a third concept that |
|                      | should own both sides                    |

Whichever is chosen, write it down where the workflow is defined. An
undocumented choice here reads as an oversight to the next developer, who
will then "fix" it.

## Red flags

- A transaction that writes three tables from unrelated concepts
- An aggregate loaded in full to change one field
- Two aggregates that always change together
- A domain type holding another entity's whole value, not its identifier
- An invariant enforced in a service rather than by the type that owns it
- Concurrent operations conflicting although they share no rule
- A value type with an identifier field that no rule uses

## Common mistakes

- **Aggregates that follow the schema.** Foreign keys describe storage,
  not invariants.
- **One giant aggregate for safety.** It guarantees consistency and
  destroys concurrency, and it still cannot span services.
- **Eventual consistency by accident.** If nobody chose it, nobody built
  the reconciliation either.
- **Enforcing an invariant in a caller.** If a rule is not enforced by
  the aggregate's own functions, it is optional.
- **Confusing an aggregate with a bounded context.** A context holds many
  aggregates; an aggregate is a transaction boundary inside one.

## Related skills

- [capturing-the-domain](../capturing-the-domain/SKILL.md)
- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)

## Further reading

- [aggregates.md](references/aggregates.md) gives the procedure for
  finding a boundary, sizing it, and handling rules that cross it.
