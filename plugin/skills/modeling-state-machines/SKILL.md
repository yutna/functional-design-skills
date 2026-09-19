---
name: modeling-state-machines
description: Use when an entity has a lifecycle, when a status field drives branching, or when a function must ask what state a value is in before acting on it.
---

# Modeling State Machines

## Overview

Most domain entities have a lifecycle: a quote is drafted, sent,
accepted, or expires; a shipment is pending, dispatched, delivered. The
usual representation is one record with a status field and a scattering
of optional fields, which permits every combination of status and data
and forces every function to check.

Model the lifecycle as a choice type instead: one case per state, each
carrying exactly the data that exists in that state, and one function per
legal transition. Illegal states disappear, and so do illegal
transitions.

## When to use

- A record has a `status`, `state`, `stage` or `phase` field
- Functions begin by branching on that field
- Optional fields are meaningful only in some states
- The business describes something as being "in" a state
- A bug allowed an entity to skip a step, or to go backwards

Not for: a value with no lifecycle, or a workflow's internal steps, which
are [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md).

## Core rules

1. **One case per state.** Named as the business names it.
2. **Each case carries only its own data.** A tracking number belongs to
   the shipped and delivered cases, not to the type.
3. **One function per transition**, taking the specific source state, not
   the whole union.
4. **Transitions return the target state**, or a `Result` when the
   transition can be refused.
5. **Make illegal transitions unwriteable.** If `deliver` takes a
   `Shipped`, nothing can deliver a `Pending`.
6. **Keep the union for storage and dispatch only.** Business functions
   take the specific case they operate on.
7. **Draw the table before writing code.** States down, commands across,
   cells are the outcome. Empty cells are the illegal transitions.

## Pattern

Status field with correlated fields:

```text
type Quote = {
  id: QuoteId,
  status: String,             -- "draft" | "sent" | "accepted"
  sentAt: Option<Instant>,
  acceptedBy: Option<CustomerId>,
  bookingId: Option<BookingId>,
}

accept q =
  if q.status /= "sent" then throw "cannot accept"
  else { ...q, status: "accepted", acceptedBy: Some c }
```

Every function repeats the guard, and the compiler helps with none of it.
A draft with an `bookingId` is representable, and one will appear.

States as cases, transitions as functions:

```text
type Draft = { id: QuoteId, lines: List<QuoteLine> }
type Sent = { id: QuoteId, lines: NonEmptyList<QuoteLine>,
              sentAt: Instant, expires: Instant }
type Accepted = { id: QuoteId, booking: BookingId,
                  acceptedBy: CustomerId, at: Instant }

type Quote = IsDraft of Draft | IsSent of Sent | IsAccepted of Accepted

send : Instant -> Draft -> Result<Sent, SendError>
accept : Instant -> CustomerId -> Sent -> Result<Accepted, AcceptError>
expire : Instant -> Sent -> Result<Expired, NotYetDue>
```

`accept` cannot be handed a draft. `Accepted` always has a booking
identifier. The guards that were repeated in every function now exist
once each, in the transition that owns them.

## The transition table

Draw this before writing types. Rows are states, columns are commands,
cells say what happens.

| State \ Command | Send    | Accept   | Cancel    |
| --------------- | ------- | -------- | --------- |
| Draft           | Sent    | illegal  | Cancelled |
| Sent            | illegal | Accepted | Cancelled |
| Accepted        | illegal | illegal  | illegal   |
| Cancelled       | illegal | illegal  | illegal   |

Each non-illegal cell is one function. Each illegal cell is a function
that does not exist, which is stronger than a function that throws.

Cells that say "sometimes" are guards: `Sent -> Accepted` only if not
expired. Those return `Result`.

## Dispatching from the outside

The union exists so that storage, transport, and user interfaces can hold
"a quote in whatever state it is in". Convert from the union to a
specific state once, at the point a command arrives:

```text
handleAccept : Instant -> CustomerId -> Quote
                 -> Result<Accepted, AcceptError>
handleAccept now who quote =
  match quote with
  | IsSent s -> accept now who s
  | IsDraft _ -> Error QuoteNotSent
  | IsAccepted _ -> Error AlreadyAccepted
```

One place branches on the union, and it is the place whose job is to
decide whether the command applies at all.

## Red flags

- A `status` string compared against literals in more than one module
- The same guard clause at the top of several functions
- Optional fields whose comment says "only when status is X"
- A transition implemented as a field assignment
- A state diagram in a wiki that the types do not match
- An entity that can go backwards through its lifecycle by accident

## Common mistakes

- **One record plus an enum.** The enum names the state but does not
  restrict the data, so nothing improves.
- **Transitions taking the union.** Then every transition re-checks, and
  the type has not bought anything.
- **Modelling every boolean as a state.** A lifecycle is a sequence the
  business talks about. `isArchived` alongside a lifecycle is usually a
  separate concern, not a fifth state.
- **Forgetting the terminal states.** Cancelled and expired are states,
  with their own data, not deletions.
- **Storing the union's shape in the database.** Persist a
  representation, and reconstruct the case on read. See
  [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md).

## Related skills

- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)

## Further reading

- [transitions.md](references/transitions.md) covers guards, terminal
  states, concurrent commands, persistence, and how to evolve a state
  machine without breaking stored data.
