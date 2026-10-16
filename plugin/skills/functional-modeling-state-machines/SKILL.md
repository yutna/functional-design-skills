---
name: functional-modeling-state-machines
description: Use when an entity has a lifecycle, when a status field drives branching, or when a function must ask what state a value is in before acting on it.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
---

# Modeling State Machines

**In this pack:** [how much design a task warrants](../functional-design/references/calibration.md),
[the notation](../functional-design/references/notation.md), and
[syntax per language](../functional-design/SKILL.md#language-packs).

## Overview

Most domain entities have a lifecycle: an appointment is scheduled,
checked in, completed or missed; a quote is drafted, sent, accepted,
cancelled or expired. The
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
are [functional-designing-workflow-pipelines](../functional-designing-workflow-pipelines/SKILL.md).

## Core rules

1. Default. **One case per state.** Named as the business names it. A property
   the entity keeps through every state, such as an archived flag on an entity
   that goes on through its lifecycle, is a field and not a state.
2. Rule. **Each case carries only its own data.** A check-in time belongs to
   the checked-in and completed cases, not to the type.
3. Default. **One function per transition**, taking the specific source state,
   not the whole union. A state worth a transition gets its own named record,
   and the case wraps it (`IsCheckedIn of CheckedIn`), so a function can take
   `CheckedIn` by itself. Where a command does exactly the same from several
   states and reads nothing that only one of them has, a single function may
   take a choice of exactly those states, as rule 5 says; split it the day the
   two differ. A function written as one clause for each source state, the way
   Elixir writes it, keeps this rule: each clause is the function for its state.
4. Rule. **Transitions return the target state**, or a `Result` when the
   transition can be refused.
5. Rule. **Make illegal transitions unwriteable.** If `complete` takes a
   `CheckedIn`, nothing can complete a `Scheduled`. A command that is legal
   from several states takes a choice of exactly those states, never the
   whole union.
6. Default. **Keep the union for storage and dispatch only.** Business functions
   take the specific case they operate on. Storage here is whatever only holds
   or shows a value in whichever state it is in: a row, a message, a list on a
   screen. Dispatch is the one function that takes a state and a command and
   picks the transition: a reducer, a match over the pair, or a function with a
   clause for each state.
7. Default. **Draw the table before writing code.** States down, commands
   across, cells are the outcome. Cells marked illegal are the illegal
   transitions.

## Pattern

Status field with correlated fields:

```text
type Quote = {
  id: QuoteId,
  status: String,             -- "draft" | "sent" | "accepted"
  sentAt: Option<Instant>,
  acceptedBy: Option<PatientId>,
  bookingId: Option<BookingId>,
}

accept q c =
  if q.status /= "sent" then throw "cannot accept"
  else { ...q, status: "accepted", acceptedBy: Some c }
```

Every function repeats the guard, and the compiler helps with none of it.
A draft with a `bookingId` is representable, and one will appear.

States as cases, transitions as functions:

```text
type Draft = { id: QuoteId, lines: List<QuoteLine> }
type Sent = { id: QuoteId, lines: NonEmptyList<QuoteLine>,
              sentAt: Instant, expires: Instant }
type Accepted = { id: QuoteId, booking: BookingId,
                  acceptedBy: PatientId, at: Instant }
type Cancelled = { id: QuoteId, reason: CancelReason,
                   at: Instant, by: UserId }
type Expired = { id: QuoteId, expiredAt: Instant }

type Quote =
  | IsDraft of Draft | IsSent of Sent | IsAccepted of Accepted
  | IsCancelled of Cancelled | IsExpired of Expired

type AcceptError =
  | PastExpiry of Instant | NotAuthorised of PatientId
  | QuoteNotSent | AlreadyAccepted | QuoteClosed

send : Instant -> Draft -> Result<Sent, SendError>
accept :
  Instant -> PatientId -> BookingId -> Sent
    -> Result<Accepted, AcceptError>
expire : Instant -> Sent -> Result<Expired, NotYetDue>
```

`accept` cannot be handed a draft. `Accepted` always has a booking
identifier, which the shell mints and passes in with the instant.
This `Quote` refines the record in
[functional-capturing-the-domain](../functional-capturing-the-domain/SKILL.md),
which has one record with an expiry and no states.

The guards that were repeated in every function now exist once each, in
the transition that owns them.

## The transition table

Draw this first. Rows are states, columns are commands, cells say what
happens.

| State \ Command | Send    | Accept    | Cancel    | Expire    |
| --------------- | ------- | --------- | --------- | --------- |
| Draft           | Sent    | illegal   | Cancelled | illegal   |
| Sent            | illegal | sometimes | Cancelled | sometimes |
| Accepted        | illegal | illegal   | illegal   | illegal   |
| Cancelled       | illegal | illegal   | illegal   | illegal   |
| Expired         | illegal | illegal   | illegal   | illegal   |

Each non-illegal cell is one function, unless rule 3 lets two cells of
one column share one. Each illegal cell is a function that does not
exist, which is stronger than a function that throws.

Cells that say "sometimes" are guards: `Sent -> Accepted` only if not
expired, and `Sent -> Expired` only if due. Those return `Result`.

## Dispatching from the outside

The union exists so that storage, transport, and user interfaces can hold
"a quote in whatever state it is in". Convert from the union to a
specific state once, at the point a command arrives:

```text
dispatchAccept :
  Instant -> PatientId -> BookingId -> Quote
    -> Result<Accepted, AcceptError>
dispatchAccept now who booking quote =
  match quote with
  | IsSent s -> accept now who booking s
  | IsDraft _ -> Error QuoteNotSent
  | IsAccepted _ -> Error AlreadyAccepted
  | IsCancelled _ -> Error QuoteClosed
  | IsExpired _ -> Error QuoteClosed
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
  business talks about. `isArchived` is a state when it has its own data
  and ends the lifecycle, and a flag when the entity continues through its
  lifecycle after it is archived.
- **Forgetting the terminal states.** Cancelled and expired are states,
  with their own data, not deletions.
- **Storing the union's shape in the database.** Persist a
  representation, and reconstruct the case on read. See
  [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md).

## Related skills

- [functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
- [functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md)
- [functional-designing-workflow-pipelines](../functional-designing-workflow-pipelines/SKILL.md)
- [functional-enforcing-consistency-boundaries](../functional-enforcing-consistency-boundaries/SKILL.md)

## Further reading

- [transitions.md](references/transitions.md) covers guards, terminal
  states, concurrent commands, persistence, and how to evolve a state
  machine without breaking stored data.
