# Kinds of Comment

## Interface comments

Written for a caller who will never read the implementation. Above the
signature.

Contents, in order:

1. What it produces, in one sentence
2. What it requires of its inputs, beyond what the types say
3. How it can fail, and what each failure means
4. What it deliberately does not do
5. Anything a caller must do afterwards

```text
-- Reserves the slot for two minutes and returns the hold.
--
-- Requires: the slot belongs to the given doctor; callers get that
-- from validateBooking.
-- Fails with: SlotUnavailable when another hold or booking exists.
-- Does not: charge, notify, or create the appointment.
-- After: the caller must either confirm or release the hold; an
-- abandoned hold expires on its own after two minutes.
holdSlot : DoctorId -> SlotId -> Instant
             -> AsyncResult<SlotHold, SlotUnavailable>
```

Never mention the storage mechanism, the algorithm, or a helper function.
A caller who learns those will depend on them.

## Implementation comments

Inside the body, for the next person to modify it.

Worth writing:

- Why this approach rather than the obvious one
- What an unusual step accomplishes
- Which invariant the following lines maintain
- A reference to the specification or ticket that drove a rule

```text
-- Two passes: the first collects the codes so the price source is
-- called once for the whole booking. Calling it per treatment took the
-- p99 from 40ms to 900ms on large bookings.
```

Not worth writing: a summary of the next five lines, or a marker for
each section of a function that should have been split.

## Cross-module comments

The dependency exists but neither module's code shows it. These are the
comments that prevent the worst class of bug.

```text
-- The mobile client matches on these exact strings. Adding a case is
-- safe; renaming one is a breaking API change and needs a version
-- bump in BookingApi.
type BookingStatusTag = "new" | "paid" | "cancelled"
```

Placement: put it where an edit would break the assumption. If two places
can break it, comment both, and say in each where the other is.

## Rationale comments

What was decided, and what was rejected. These stop a future reader
undoing a deliberate choice.

```text
-- Stored, not derived. The invoice total must not change when a
-- treatment's price changes, so this is a snapshot at issue time,
-- deliberately duplicating what lines would compute today.
invoicedTotal: Money
```

The test for a rationale comment: would a competent developer, seeing
only the code, be tempted to change it? If yes, say why not.

## Data comments

Fields whose meaning or units are not obvious.

```text
type RetryPolicy = {
  -- Total elapsed time, not per attempt. An attempt already in
  -- flight is not cancelled when this expires.
  budget: Seconds,
  -- Multiplier applied to the previous delay. 1.0 means constant.
  backoff: Decimal,
}
```

Prefer a type where one exists. `budget: Seconds` already says more than
`budget: Integer` plus a comment, and cannot go stale.

## Module comments

At the top of a module, three things:

1. The knowledge this module owns, in one sentence
2. What it deliberately does not own
3. How to use it, if the entry point is not obvious

```text
-- Owns everything about how a booking is priced: rate selection,
-- rounding, and limits. Does not own discounts, which are applied
-- afterwards by the Discounts module, nor tax, which is Billing's.
```

If the sentence needs "and", the module has two purposes. See
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

## Comments to delete on sight

| Comment                         | Why                          |
| ------------------------------- | ---------------------------- |
| Restates the line below         | No information               |
| Commented-out code              | Version control holds it     |
| "TODO" with no name or date     | Nobody will do it            |
| A changelog in the file header  | Version control holds it     |
| "This should never happen"      | Either prove it or handle it |
| Apology for the code's quality  | Say what would be better     |
| A section marker in a long body | Split the function instead   |
