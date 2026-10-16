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
4. **If it does not fit**, the table in
   [functional-refactoring-toward-functional-design](../../functional-refactoring-toward-functional-design/SKILL.md#deciding-patch-or-restructure)
   says whether to widen, split or patch. The sentence from step 1 is
   what you test the new case against.
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
person will look, in the module itself, not in a ticket. What the note
contains is in
[keeping-design-clean.md](../../functional-refactoring-toward-functional-design/references/keeping-design-clean.md).

An unrecorded shortcut is indistinguishable from a design decision, and
the next reader will preserve it.

## Two traps

**The unrelated refactor.** Improving code you are not otherwise touching
makes the change hard to review and hides the real edit. Stay in the
module you came for, and its immediate neighbours. What you saw and left
goes in the change's description: the design it calls for, and why it is
not in this diff.

**The rewrite reflex.** A rewrite reproduces the original design unless
you can state what was wrong with it. If you cannot pass the
one-sentence test above, you are not ready to rewrite.
