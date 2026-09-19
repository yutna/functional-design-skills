# Finding and Sizing Aggregates

## Procedure

1. **Write the invariants as sentences.** Each one names the data it
   touches. "A booking's total equals the sum of its treatments." "A room is
   never booked twice for the same night."
2. **Mark which must hold at every instant.** Ask the business, not the
   database. Many rules people assume are instantaneous are not: an
   overbooked flight is handled by a business process, not prevented.
3. **Group the data each instantaneous rule touches.** Overlapping groups
   merge; disjoint groups are separate aggregates.
4. **Name the root of each group** and make it the only entry point.
5. **Check the size.** If a common operation loads far more than it
   changes, the aggregate is too big; look for a rule you assumed was
   instantaneous and is not.
6. **List the rules left over.** Those cross aggregates, and each needs a
   deliberate mechanism.

## Worked example

A conference booking system. Candidate invariants:

- A booking's attendee count matches the number of attendee records.
- A session is never booked beyond its room capacity.
- A speaker is never scheduled in two rooms at the same time.
- An attendee's total fee equals the sum of their session fees.

Step 2, asked of the business: the first must always hold. The second
must always hold, since the fire code depends on it. The third they
resolve manually when it happens. The fourth is recalculated nightly.

Step 3 gives two aggregates: `Booking` with its attendees, and
`SessionSeating` with its allocations for one session. Speaker
scheduling and fee totals fall outside, and each gets a mechanism:
scheduling conflicts raise an alert for a human, and fees are a nightly
recalculation with a report of discrepancies.

## Sizing

Symptoms of an aggregate that is too large:

- Loading it takes an obviously large number of rows
- Two users editing different parts collide
- Its type has fields that no invariant relates
- A change to one part invalidates a cache for the whole

Symptoms of one that is too small:

- Two aggregates are always written in the same transaction
- An invariant is enforced in a service, because no aggregate owns it
- Callers must read three aggregates to make one decision

Prefer too small over too large: an over-small boundary shows itself
quickly as a rule with no owner, while an over-large one degrades
quietly.

## Mechanisms for rules that cross

**Check then act.** Read the other aggregate, decide, write yours. The
read may be stale. Acceptable when the consequence is small and
correctable: a slightly exceeded credit limit that a human reviews.

**Reserve then confirm.** Take a short-lived claim on the scarce
resource, then complete the work, then release or convert the claim.
Correct under concurrency, and the standard answer for seats, stock, and
unique names.

```text
reserve : SeatId -> Instant -> Result<Reservation, AlreadyTaken>
confirm : Reservation -> BookingId -> Result<Booking, Expired>
```

**Compensate after.** Do the work, detect violations later, and reverse
them. Suits money movement, where reversal is a normal operation and
blocking is expensive.

**Move the rule.** Sometimes the rule belongs to a concept that does not
exist yet. "A speaker is never double-booked" belongs to a `Schedule`
aggregate, which owns all assignments for a time slot. Inventing that
concept turns a cross-aggregate rule into an ordinary invariant.

## Aggregates in functional code

An aggregate needs no framework. It is:

- a type whose values always satisfy the invariants
- constructors and transition functions that are the only way to build or
  change one, each returning `Result`
- a module that exports those and nothing that lets a caller reach inside

```text
module Booking
  type Booking                              -- opaque
  create : CustomerId -> NonEmptyList<BookedTreatment> -> Result<Booking, Error>
  addTreatment : BookedTreatment -> Booking -> Result<Booking, Error>
  removeTreatment : TreatmentId -> Booking -> Result<Booking, Error>
  total : Booking -> Money
```

Loading and saving live outside, in the shell, which reads the stored
representation, reconstructs the aggregate, applies a function, and
writes the result under a version check. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Concurrency, concretely

The pure functions above say nothing about concurrency; the shell does:

1. Read the aggregate with its version.
2. Apply the pure transition.
3. Write back conditional on the version being unchanged.
4. On conflict, re-read and re-apply, or return a conflict to the caller.

This gives serialisable behaviour per aggregate without locks, and it is
why small aggregates matter: the conflict rate is proportional to how
much unrelated work shares a boundary.
