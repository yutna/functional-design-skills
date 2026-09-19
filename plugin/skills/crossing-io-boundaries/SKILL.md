---
name: crossing-io-boundaries
description: Use when mapping between domain types and JSON, database rows, or API payloads, or when a storage or wire shape has leaked into the domain model.
---

# Crossing IO Boundaries

## Overview

Domain types are designed for rules; wire and storage types are designed
for transmission and querying. They are different jobs, and letting one
type do both means every schema change is a domain change and every
domain change is a migration.

The boundary is an explicit, deliberate mapping in one place: parse
inward into fully valid domain values, serialise outward into the shape
the outside expects. Everything between those two functions can then
assume its values are correct, and everything outside can evolve on its
own schedule.

## When to use

- Designing an API payload, message, or database schema
- A domain type has nullable fields that only storage needs
- Adding a field to a domain type requires a migration and a version bump
- Deciding where validation happens for incoming data
- An ORM entity is being used as a domain object

Not for: deciding what the domain types should be, which is
[modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md).

## Core rules

1. **Two type families, always.** Domain types inside; transfer types at
   the edge. Even when they look identical today.
2. **Transfer types are dumb.** Primitives, plain records, nullable
   fields, no invariants. Their job is to survive transmission.
3. **Parse inward, serialise outward.** One function each direction, per
   boundary.
4. **Parsing returns `Result`.** The outside can always send something
   the domain forbids.
5. **Serialising is total.** A valid domain value can always be written
   out, so it needs no failure case.
6. **Validate once, at the boundary.** Nothing downstream re-checks.
7. **Version the transfer type, not the domain type.** Add a new transfer
   version and a new mapping; leave the domain alone.
8. **Keep the domain persistence-ignorant.** No annotations, no base
   types, no lazy-loading proxies, no framework attributes.

## Pattern

Domain type doing both jobs:

```text
type Booking = {
  id: String,                  -- because JSON has no Uuid
  status: String,              -- because the column is varchar
  treatments: List<BookedTreatment>,      -- may be empty, because the join may
  cancelledAt: Option<Instant>, -- return nothing
  version: Integer,            -- because the ORM needs it
}
```

Every compromise of two external systems is now permanent in the rules.

Two families and a mapping:

```text
-- domain: designed for rules
type Booking = {
  id: BookingId,
  treatments: NonEmptyList<BookedTreatment>,
  lifecycle: Lifecycle,
}

-- transfer: designed for the wire
type BookingDto = {
  id: String,
  treatments: List<BookedTreatmentDto>,
  status: String,
  cancelledAt: String?,
}

toDto : Booking -> BookingDto
fromDto : BookingDto -> Result<Booking, BookingDtoError>
```

The domain regains `NonEmptyList` and a real lifecycle. The wire keeps
its nullable strings. Neither constrains the other.

## Direction rules

| Direction | Total?             | Where it runs          |
| --------- | ------------------ | ---------------------- |
| Inward    | No, returns Result | Edge, before workflows |
| Outward   | Yes                | Edge, after workflows  |

Inward failure is normal: a payload from an older client, a row written
by an earlier version, a hand-crafted request. Model it, do not crash.

## Field mappings

| Domain              | Transfer                      |
| ------------------- | ----------------------------- |
| Single-case wrapper | The primitive inside          |
| Choice type         | Tag field plus payload fields |
| `NonEmptyList<A>`   | Array, checked on the way in  |
| `Option<A>`         | Nullable, or field absent     |
| `Money`             | Minor units integer plus code |
| `Instant`           | Text in a fixed format, UTC   |
| Aggregate           | One document, or several rows |

Details and worked mappings in
[dto-mapping.md](references/dto-mapping.md).

## Persistence specifically

Storage is a boundary like any other, with three extra concerns:
transactions, identity, and concurrency.

- **The domain does not know it is stored.** No repository interface
  inside the domain; the workflow takes `LoadBooking` and `SaveBooking`
  function types. See
  [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md).
- **One aggregate per transaction.** See
  [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md).
- **Separate commands from queries.** Writes go through the domain;
  read-only views may query storage directly with their own types, and
  need not reconstruct aggregates.

More in
[persistence-patterns.md](references/persistence-patterns.md).

## Red flags

- A domain type with a nullable field that only the database needs
- Framework annotations on a domain type
- JSON field names appearing in business logic
- Validation repeated in the controller and in the service
- A schema migration required by a pure refactor of the domain
- A query returning entities that the domain then mutates
- Serialising a domain type directly to a response

## Common mistakes

- **Skipping the mapping because the types match.** They match today.
  The mapping is what lets them stop matching.
- **Auto-deriving serialisation from domain types.** Convenient, and it
  welds the wire format to the internals; a rename becomes a breaking API
  change.
- **Parsing in several places.** Each copy drifts. One parser per
  boundary.
- **Making serialisation fallible.** If a valid domain value cannot be
  written out, the transfer type is wrong.
- **Using the ORM entity as the aggregate.** Lazy loading, identity maps,
  and change tracking are the opposite of a value with invariants.
- **Reconstructing aggregates for read-only screens.** Query a view type
  instead.

## Related skills

- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [constraining-primitive-values](../constraining-primitive-values/SKILL.md)

## Further reading

- [dto-mapping.md](references/dto-mapping.md) covers the mapping for each
  kind of domain type, plus versioning and evolution.
- [persistence-patterns.md](references/persistence-patterns.md) covers
  transactions, concurrency, queries, and event storage.
