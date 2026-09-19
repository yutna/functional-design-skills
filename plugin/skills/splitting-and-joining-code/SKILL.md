---
name: splitting-and-joining-code
description: Use when deciding whether to split a function or module, when a boolean parameter selects behaviour, or when two pieces always change together.
---

# Splitting and Joining Code

## Overview

Given two pieces of functionality, should they be in the same place or
separate places? The instinct to split is usually stronger than the
instinct to join, and it is usually wrong: subdividing creates
interfaces, and interfaces are where complexity lives. Subdivision also
scatters what belonged together, so a reader must find all the pieces
before understanding any of them.

Bring code together when the pieces share information, are always used
together, overlap conceptually, or cannot be understood apart. Split when
one piece is general and the other is special, or when the two have
genuinely separate reasons to change.

## When to use

- A function is "too long" and the urge is to extract parts of it
- Two modules are always changed in the same commit
- General logic and one caller's special case share a body
- A pipeline step is only ever called by one other step
- Deciding whether a helper belongs in the file that uses it

Not for: judging whether a module's interface is worth its cost, which is
[designing-deep-modules](../designing-deep-modules/SKILL.md).

## Bring together when

1. **They share information.** Both need the same non-obvious fact: a
   format, an invariant, a set of thresholds. Splitting them makes that
   fact travel.
2. **They are always used together.** Every caller of one calls the other,
   in the same order, with the same values.
3. **They overlap conceptually.** A single sentence covers both, without
   "and".
4. **One is hard to understand without the other.** If reading the second
   is required to understand the first, the split bought nothing.
5. **Joining eliminates duplication.** Two branches that repeat the same
   preparation collapse into one.

## Keep apart when

1. **One is general, the other special.** The general part serves many
   callers; the special part serves one. Mixing them means the general
   part carries a caller's assumptions forever.
2. **They have different reasons to change.** Different owners, different
   release cadence, different regulation, different domain.
3. **Only one needs to be understood by callers.** The other can be
   hidden behind it.
4. **They belong to different layers.** Different vocabulary means a real
   boundary. See [separating-layers](../separating-layers/SKILL.md).

## Pattern

The special-general mixture, and its repair.

```text
-- general calendar primitive, contaminated by one caller's case
place : Interval -> AppointmentId -> Calendar -> Result<Calendar, Clash>
-- ...and, inside, a branch for "if this is a follow-up visit, let it
-- overlap the same clinician's existing appointment"
```

The follow-up rule now lives inside the general primitive. Every future
scheduling feature must read it, and any change to follow-ups risks
everything else.

```text
-- general stays general
place : Interval -> AppointmentId -> Calendar -> Result<Calendar, Clash>

-- special lives with the feature that needs it
placeFollowUp :
  Clinician -> Interval -> AppointmentId -> Calendar
            -> Result<Calendar, Clash>
placeFollowUp c i a cal =
  place i a (allowOverlapFor c cal) |> map (restoreRules cal)
```

The general primitive knows nothing about follow-ups. The special case is
one small function next to the feature that owns it.

## On splitting functions

Length alone is not a reason to split. Split a function when:

- The extracted part is a **separate, meaningful abstraction** that a
  reader could use without knowing the parent
- The parent becomes shorter **and** neither part now needs to explain
  the other
- The interface between the two parts is simple: few parameters, no
  shared mutable state, no required call order

Do not split when:

- The extracted part takes six parameters, half of them for context
- Its name has to be `doPart2` or `helperFor...`
- Reading it requires reading the parent anyway
- It exists only because a style rule sets a line limit

The failure mode is **conjoined functions**: two functions that can only
be understood together. That is worse than one longer function, because
the reader must now hold both, plus the mapping between them.

## Quick reference

| Signal                            | Verdict          |
| --------------------------------- | ---------------- |
| Both know the same format         | Together         |
| Always called as a pair           | Together         |
| One is general, one is special    | Apart            |
| Different reasons to change       | Apart            |
| Extracting needs six parameters   | Leave together   |
| Only one is meant for callers     | Apart, and hide  |
| Reader must read both to get one  | Together         |
| Same nouns, different layer names | Together, remove |

## Red flags

- A function named after its position rather than its job
- Two files that never appear separately in a commit
- A general utility with a parameter named after one feature
- An extracted helper whose parameter list is longer than its body
- A module split that made both halves import each other

## Common mistakes

- **Splitting to satisfy a length limit.** Line limits measure nothing
  that matters; abstraction boundaries do.
- **Splitting by structure.** One file per type, per layer, or per verb
  distributes decisions rather than isolating them.
- **Joining things that merely resemble each other.** Two functions with
  similar shapes and different reasons to change should stay apart even
  if that means similar code.
- **Extracting the special case into the general module.** If it moves,
  it moves outward towards its caller, never inward.

## Related skills

- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [separating-layers](../separating-layers/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)
- [composing-functions](../composing-functions/SKILL.md)

## Further reading

- [decision-criteria.md](references/decision-criteria.md) turns the two
  lists above into a procedure, with worked cases including the
  duplication trap.
