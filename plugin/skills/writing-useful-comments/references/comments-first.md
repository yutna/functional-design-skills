# Comments as a Design Tool

Writing the interface comment before the implementation turns
documentation from a chore at the end into a design check at the
beginning, when changing your mind is still cheap.

## The procedure

For each new module or exported function:

1. Write the signature.
2. Write the interface comment: what it produces, what it requires, how
   it fails, what it does not do.
3. Read the comment back. Judge the design by how the comment reads.
4. Change the design, not the comment, until the comment is short and
   clear.
5. Implement.
6. Adjust the comment only where implementing revealed something the
   caller genuinely needs to know.

## What the comment reveals

**A long comment means a complicated interface.** The comment is a
faithful measure of what a caller must learn. If it takes a paragraph to
say what the function requires, the requirements are the problem.

**A comment full of conditions means missing types.** "The booking must
already be validated" is a sentence that a type can enforce. Every
"requires" clause is a candidate for
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md).

**A comment describing steps means a shallow module.** If the only way to
say what a function does is to list what it calls, it is not hiding
anything. See
[designing-deep-modules](../../designing-deep-modules/SKILL.md).

**A comment with "and" means two functions.** Split before implementing.

**A comment you cannot write means you do not know what you are
building.** That is the most valuable outcome, and it costs two minutes
rather than two days.

## Worked example

First attempt:

```text
-- Takes the raw booking, checks the fields are present and the treatment
-- codes exist by calling the catalogue, then works out prices from
-- the price list, applies the customer's discount if they have one,
-- adds tax unless the customer is exempt, and saves the result,
-- returning the saved booking or throwing if anything went wrong.
processBooking : RawBooking -> Booking
```

Reading it back: six clauses joined by "and", a mention of throwing, and
a description of internal calls. Three problems, all visible before a
line of code.

Second attempt, after splitting and typing:

```text
-- Validates a raw booking against the catalogue, producing a booking
-- whose treatment codes are known to exist and whose quantities are
-- within limits.
--
-- Fails with: one ValidationError per bad field, all of them, so a
-- form can be corrected in a single pass.
-- Does not: price, discount, tax, or save.
validateBooking :
  CheckTreatmentExists -> RawBooking
    -> Result<ValidatedBooking, NonEmptyList<ValidationError>>
```

Shorter comment, narrower function, failures in the type. The other four
responsibilities became their own steps in a pipeline. See
[designing-workflow-pipelines](../../designing-workflow-pipelines/SKILL.md).

## For modules

The same technique at a larger scale. Before creating a module, write its
one-sentence purpose and its list of exports. If the sentence needs
"and", or if the export list is longer than a reader could hold, redesign
before writing code.

## Keeping them true

The design value comes at the start; the documentation value only lasts
if the comments stay true.

- Change the comment in the same edit as the code, never in a follow-up.
- Treat a stale comment found in review as a defect, not a nit.
- When a change makes a comment hard to keep accurate, that is a signal
  the change broke the abstraction, not that the comment is a nuisance.
