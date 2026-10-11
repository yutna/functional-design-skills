---
name: functional-making-illegal-states-unrepresentable
description: Use when a type can hold combinations the business forbids, when booleans, flags, or nullable fields encode state like loading and failed, or when code guards impossible values.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.0
---

# Making Illegal States Unrepresentable

## Overview

Every state a type can hold is a state somebody must handle. If the type
permits combinations the business forbids, then every consumer either
checks for them, or is wrong for inputs that will eventually arrive.

The alternative is to design the type so the forbidden combination cannot
be built. Then the check is not skipped, forgotten, or duplicated: it does
not exist, because there is nothing to check. This is the single highest
leverage rule in domain modelling, and it composes with everything else.

## When to use

- A record holds fields that are only meaningful together
- Code checks a condition that "should never happen"
- A function begins with three guard clauses about its own input
- A bug report says a value was in an impossible state
- Reviewing any domain type before code is written against it

Not for: input that genuinely arrives malformed from outside, which is
parsed at the boundary. See
[functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md).

Also not for a shape whose field set is decided outside the code, by
config, by a tenant, or by an admin. There is no closed set of cases to
design against, and modelling one produces a type with everything
optional, which is the defect this skill exists to remove. See
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md).

## Core rules

1. Default. **Count the states.** List what the type can hold and what the
   business allows. Every extra state is a defect waiting for an input.
2. Default. **Prefer construction over validation.** A value that exists is
   already valid. Push the check into the only place a value can be made.
3. Default. **Give each state its own case, with its own data.** Correlated
   optional fields become cases of a choice type.
4. Rule. **Make the constructor the only door.** If a record can be built field
   by field from anywhere, its invariants are advisory.
5. Default. **Encode the phase in the type.** `UnvalidatedBooking`,
   `ValidatedBooking` and `PricedBooking` are different types, so a function
   cannot receive the wrong phase.
6. Rule. **Never write a guard for a state the type forbids.** If you feel the
   need, either the type is wrong or the guard is dead code pretending to be
   safety. Where the type cannot express an invariant, an assertion that
   crashes is correct; see
   [functional-defining-errors-out-of-existence](../functional-defining-errors-out-of-existence/SKILL.md).
   This rule is about the states the type does forbid.
7. Rule. **Accept representable-but-invalid only at the edge**, where data
   really does arrive that way, and convert immediately.

## Pattern

Representable and illegal:

```text
type Appointment = {
  slot: Instant,
  status: String,       -- "scheduled" | "checked-in" | "completed"
                        --   | "missed"
  checkedInAt: Option<Instant>,
  completedAt: Option<Instant>,
  summary: Option<VisitSummary>,
  missedAt: Option<Instant>,
}
```

This permits a completed appointment with no check-in time, a scheduled
one with a completion time, and a checked-in one marked missed. Every
report, every screen, and every downstream service must decide what to do
with each of those.

Unrepresentable:

```text
type Scheduled = { slot: Instant }
type CheckedIn = { slot: Instant, checkedInAt: Instant }
type Completed = { slot: Instant, checkedInAt: Instant,
                   completedAt: Instant, summary: VisitSummary }
type Missed = { slot: Instant, missedAt: Instant }

type Appointment =
  | IsScheduled of Scheduled
  | IsCheckedIn of CheckedIn
  | IsCompleted of Completed
  | IsMissed of Missed
```

A completed appointment always has a check-in time, a completion time
and a summary, because there is no way to construct one without them.
No consumer checks anything; each simply handles four cases. A state
that a transition takes gets its own named record and the case wraps it,
as
[functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
explains.

## Technique index

| Illegal thing to prevent      | Technique                   |
| ----------------------------- | --------------------------- |
| Correlated optional fields    | Choice type with payloads   |
| Empty list where one required | `NonEmptyList`              |
| Out-of-range number           | Wrapper with a constructor  |
| Wrong string format           | Wrapper with a parser       |
| Two ids swapped               | Distinct types per id       |
| Wrong pipeline phase          | One type per phase          |
| Missing required field        | No default; require it      |
| Two fields must agree         | One field, derive the other |
| A state with no data          | Case with no payload        |
| Money in mixed currencies     | Currency inside the type    |
| Optional with two meanings    | Remove one meaning          |

Each is expanded in
[techniques-catalog.md](references/techniques-catalog.md).

## Where validation still belongs

Designing states away does not remove validation; it relocates it. Input
from a form, a queue, or another system arrives in whatever shape it
arrives. The pattern is:

```text
-- edge: everything is possible here
parseAppointmentUpdate :
  Payload -> Result<AppointmentUpdate, ParseError>

-- inside: nothing is possible except what the domain allows
applyUpdate :
  AppointmentUpdate -> Appointment -> Result<Appointment, UpdateError>
```

One place converts the possible into the legal. Everything past it is
written against types that cannot be wrong. When you find yourself
wanting a partially filled domain type, model the partial thing as its
own type instead: a `DraftBooking` is a real business concept, not a broken
`Booking`. See
[when-to-validate-instead.md](references/when-to-validate-instead.md).

## Red flags

- A comment saying which fields are set in which case
- `if (x == null) throw new Error("cannot happen")`
- Two optional fields that are always set or unset together
- A `status` string compared to literals in more than one module
- A test asserting behaviour for a state the business does not have
- Defensive checks repeated in several functions on the same value

## Common mistakes

- **Validating everywhere instead of constructing once.** Ten checks that
  agree today will not agree in a year.
- **Building the type from the database schema.** Nullable columns become
  optional fields become illegal states.
- **Treating a draft as an incomplete final value.** Give the draft its
  own type with its own rules.
- **Going too far.** Types that encode every arithmetic property make
  simple code unreadable. Encode the rules the business names, and let
  tests cover the rest.
- **Leaving a public constructor beside the smart one.** The unsafe door
  will be used, usually in a hurry.

## Related skills

- [functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md)
- [functional-constraining-primitive-values](../functional-constraining-primitive-values/SKILL.md)
- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)
- [functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md)

## Further reading

- [techniques-catalog.md](references/techniques-catalog.md) expands each
  row of the index with a worked before and after.
- [when-to-validate-instead.md](references/when-to-validate-instead.md)
  covers drafts, partial input, and the cases where a check is the right
  answer.
