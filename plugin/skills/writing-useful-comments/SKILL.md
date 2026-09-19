---
name: writing-useful-comments
description: Use when writing or reviewing comments and documentation, when a comment restates the code, or when a contract cannot be expressed in a type.
---

# Writing Useful Comments

## Overview

Comments exist to record what the code cannot say. Types state structure;
names state meaning; neither states why a threshold is thirty days, which
other module depends on this ordering, or what the caller must guarantee.
Those facts exist in the author's head and are lost unless written down.

The usual objections to comments are all objections to bad comments.
Comments that restate the code are worthless and go stale; comments that
carry information not present in the code are the difference between a
module a stranger can use and one only its author can.

## When to use

- Writing an exported function, type, or module
- A design decision was not obvious and has a reason
- Something in the code would surprise a reader
- Reviewing a diff whose comments repeat the code
- Designing an interface, where comments come before the code

Not for: naming, which is
[choosing-precise-names](../choosing-precise-names/SKILL.md).

## The rule

A comment must contain information that is not in the code. Test any
comment by deleting it and asking what was lost. If nothing, it should
not exist.

```text
-- worthless: the code says this
-- increment the counter
counter = counter + 1

-- valuable: the code cannot say this
-- Thirty days, not the contractual sixty, because the payment
-- provider expires authorisations at thirty and a longer window
-- produces charges that always fail.
authorisationWindow = Days 30
```

## The four excuses

Every argument for not writing comments is one of these, and each has an
answer.

| Excuse                     | Answer                                   |
| -------------------------- | ---------------------------------------- |
| Good code documents itself | Code says what, never why                |
| I have no time             | Minutes now against every reader's hours |
| Comments go out of date    | Only if you edit code without them       |
| The ones I see are useless | They were; write the four kinds below    |

The first excuse is the important one: a signature states structure, and
a name states meaning, but neither can state why a threshold is thirty
days, what a caller must guarantee, or which alternative was rejected and
why. Those facts exist only in the author's head.

The second is worth examining honestly. Comments written first save time
in the same session, because they expose a bad interface before it is
implemented. See [comments-first.md](references/comments-first.md).

## Four kinds worth writing

**Interface comments** describe what a caller must know: what the
function does, what it requires, what it guarantees, and what it can
fail with. Write these for everything exported. They belong above the
signature and must not describe the implementation, or callers will
depend on it.

**Implementation comments** explain what is not obvious inside: why an
algorithm was chosen, what an unusual step is for, which invariant the
following lines maintain.

**Cross-module comments** record a dependency that neither module's code
shows: "the batch job assumes these rows are ordered by created_at",
"this tag string is the wire contract with the mobile client". These are
the hardest to place; put them where a change would break the assumption,
in both places if necessary.

**Rationale comments** record why a choice was made and what was
rejected. They are what stop a future reader "simplifying" a deliberate
decision.

See [comment-kinds.md](references/comment-kinds.md).

## Core rules

1. **Write the interface comment before the code.** If it is hard to
   write, the interface is wrong, and you have learned that before
   implementing it. See
   [comments-first.md](references/comments-first.md).
2. **Describe things the reader cannot see.** Never restate the
   signature.
3. **Say why, not what.** The what is in the code; the why is not.
4. **Keep interface comments free of implementation.** Anything a caller
   should not rely on must not be in the interface comment.
5. **Put the comment where the reader will be.** Next to the code it
   explains, not in a document elsewhere.
6. **Update comments in the same edit.** A false comment costs more than
   no comment.
7. **Prefer a type to a comment.** If the comment states a constraint, a
   type can often state it instead, and then it cannot go stale. See
   [constraining-primitive-values](../constraining-primitive-values/SKILL.md).

## What belongs in an interface comment

For an exported function, in this order:

```text
-- Prices every treatment of a validated booking using the supplied price
-- source, and returns the booking with a total.
--
-- Requires: every treatment code in the booking exists in the source;
-- callers get that guarantee from validateBooking.
-- Fails with: PriceUnavailable when the source has no price today;
-- TotalTooLarge above the ten-million limit set by the finance team.
-- Does not: apply discounts, which happen later in the pipeline.
priceBooking : GetTreatmentPrice -> ValidatedBooking
               -> Result<PricedBooking, PricingError>
```

The "does not" line is often the most valuable, because it answers the
question a reader is actually asking.

## Red flags

- A comment that restates the line below it
- A comment that describes how, in an interface comment
- A comment contradicted by the code
- A commented-out block left in place
- An exported function with no comment and a non-obvious contract
- A comment saying "temporary" or "for now" older than a month
- A constant with no explanation of where its value came from

## Common mistakes

- **Documenting the obvious and skipping the subtle.** The getter has
  three lines of documentation and the concurrency assumption has none.
- **Explaining what a good name would say.** Fix the name instead.
- **Writing comments last.** By then the design is fixed and the comment
  is a transcription.
- **Duplicating a comment at every call site.** Put it once, at the
  definition.
- **Using comments to apologise.** "This is ugly but works" tells the
  reader nothing they cannot see. Say what would be better and why it was
  not done. See
  [working-in-existing-code.md](../programming-strategically/references/working-in-existing-code.md).
- **Leaving a stale comment because the change was small.** Staleness is
  what destroys trust in every other comment.

## Related skills

- [choosing-precise-names](../choosing-precise-names/SKILL.md)
- [deciding-what-matters](../deciding-what-matters/SKILL.md)
- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)

## Further reading

- [comment-kinds.md](references/comment-kinds.md) gives the shape of each
  kind, with examples and placement rules.
- [comments-first.md](references/comments-first.md) explains using the
  interface comment as a design tool before implementing.
