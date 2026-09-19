# Working in Existing Code

Most programming is editing, and editing is where designs decay. Each
change is individually reasonable; the sum is a system nobody can
explain.

## The standard to hold

After the change, the module's design must be what you would have chosen
if you had designed it for the new requirement from the start. That is
the bar. Anything less is a deliberate, recorded debt.

## Procedure

1. **State the current abstraction in one sentence.** If you cannot, you
   do not yet know enough to change it safely, and that itself is the
   finding.
2. **Test whether the new requirement fits.** Fitting means the new case
   is an instance of what the module already claims to do. Not fitting
   means the module's sentence would have to grow an "and also".
3. **If it fits**, make the change in the module's existing idiom.
4. **If it does not fit**, choose:
   - Widen the abstraction so the new case is an instance of it. Best
     when the two cases are genuinely the same kind of thing.
   - Split the module so the new case has its own home. Best when they
     are different things that were merged by accident.
   - Make the minimal patch and record the debt. Only when the first two
     are out of budget.
5. **Repair what the change invalidated.** Names, comments, and types
   that were true before and are not now.

## Signs that the abstraction no longer fits

- The change adds a boolean parameter that selects behaviour
- A new optional field is only meaningful for some callers
- The function's name would need "and" to stay accurate
- A caller must now check which variant it got back
- You had to read the implementation to know what to pass

## Recording debt honestly

When you knowingly leave the design worse, write it down where the next
person will look, in the module itself, not in a ticket:

```text
-- The rules below are duplicated in the billing module. They belong in
-- one owner, but unifying them needs the billing rewrite scheduled for
-- the next quarter. Until then, change both.
```

An unrecorded shortcut is indistinguishable from a design decision, and
the next reader will preserve it.

## Two traps

**The unrelated refactor.** Improving code you are not otherwise touching
makes the change hard to review and hides the real edit. Stay in the
module you came for, and its immediate neighbours.

**The rewrite reflex.** A rewrite reproduces the original design unless
you can state what was wrong with it. If you cannot pass the
one-sentence test above, you are not ready to rewrite.
