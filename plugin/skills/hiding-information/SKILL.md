---
name: hiding-information
description: Use when callers know how a module works inside, when one data format appears in several modules, or when each step of a process became a module.
---

# Hiding Information

## Overview

Each module should encapsulate knowledge that its callers do not have and
do not need. That knowledge is a design decision: a storage format, a
protocol, an algorithm, a business rule's exact thresholds. Hiding it
means a change to the decision cannot reach a caller.

Information leakage is the opposite: the same knowledge appears in more
than one module, or appears in an interface when it belongs in an
implementation. Leakage is the single most damaging structural problem,
because it turns one decision into many, silently.

## When to use

- Two modules both know a date format, a status code, or a field layout
- A change to one internal detail forced edits elsewhere
- Deciding what to export from a new module
- Modules named after steps of a process rather than kinds of knowledge
- A value is threaded through five functions that never look at it

Not for: judging whether a module is worth its interface, which is
[designing-deep-modules](../designing-deep-modules/SKILL.md).

## Core rules

1. **Name the knowledge each module owns.** Write one line per module:
   "this module is the only place that knows X". If two modules claim the
   same X, that is leakage, and one of them must stop.
2. **Decompose by knowledge, not by time.** Modules named `parse`,
   `enrich`, `send` follow the booking things happen. Booking changes;
   knowledge does not. See
   [temporal-decomposition.md](references/temporal-decomposition.md).
3. **Export the least that still serves callers.** Every exported name is
   a promise. Removing one later breaks people.
4. **Do not leak through types.** An exported type whose fields mirror a
   database row leaks the schema even if no function does.
5. **Do not leak through errors.** An error carrying a driver-specific
   code makes every caller depend on the driver.
6. **Do not thread values that nobody in between reads.** A pass-through
   value in five signatures is five modules knowing about it. See
   [leakage-catalog.md](references/leakage-catalog.md).

## Pattern

Leaked: two modules know how a status is spelled and what it implies.

```text
-- bookings module
type Booking = { ..., status: String }        -- "new" | "paid" | "void"

-- reporting module
isRevenue o = o.status == "paid"            -- knows the spelling
                                            -- and the meaning
```

Change the spelling, or add a "refunded" status that is still revenue,
and reporting is silently wrong. Nothing connects the two modules but a
string literal.

Hidden: the bookings module owns both the spelling and the meaning.

```text
-- bookings module
type BookingStatus = New | Paid of PaidAt | Void of Reason
type Booking = { ..., status: BookingStatus }

countsAsRevenue : Booking -> Boolean          -- the meaning lives here

-- reporting module
isRevenue = countsAsRevenue                 -- knows nothing else
```

Now adding a status is a change in one module, and the type system lists
every place that must be reconsidered.

## Forms of leakage

| Form                 | What escapes               | Typical fix           |
| -------------------- | -------------------------- | --------------------- |
| Shared format        | A layout two modules parse | One owner parses      |
| Exposed record shape | Storage or wire structure  | Map at the boundary   |
| Status strings       | Spelling plus meaning      | Choice type plus rule |
| Leaked error type    | The library underneath     | Own error type        |
| Pass-through value   | That the value exists      | Context at the edge   |
| Exported helper      | How the work is done       | Stop exporting it     |
| Temporal modules     | The order of the steps     | Split by knowledge    |

## Overexposure

An interface forces callers to learn about a feature that most of them
never use. A common case: a general entry point whose first parameter
selects a mode, so every caller must decide about modes.

```text
-- overexposed: every caller learns about caching
fetchUser : CacheMode -> UserId -> AsyncResult<User, Error>

-- exposed only where it matters
fetchUser : UserId -> AsyncResult<User, Error>
fetchUserUncached : UserId -> AsyncResult<User, Error>
```

The rule: the common case should not pay for the rare one.

## Red flags

- The same literal string appears in two modules
- A type exported from a module has fields no caller reads
- A parameter is passed through functions that never use it
- Two modules must be changed together, always
- A module is named after a verb in a sequence
- Errors from a library reach code that never imported it

## Common mistakes

- **Hiding what callers need.** Information hiding is about design
  decisions, not about making the interface mysterious. Failure modes and
  required inputs must be visible.
- **Adding a getter for every field.** Exposing a field through a
  function still exposes the field.
- **Confusing privacy with hiding.** A private function in a module whose
  behaviour is described in the module's public doc is still leaked.
- **Passing a context object to avoid pass-through parameters.** A grab
  bag threaded everywhere leaks more than the parameters did.

## Related skills

- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [separating-layers](../separating-layers/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)

## Further reading

- [leakage-catalog.md](references/leakage-catalog.md) lists each form of
  leakage with a detection test and a repair.
- [temporal-decomposition.md](references/temporal-decomposition.md)
  explains why splitting by execution order is so tempting and so
  damaging, and what to split by instead.
