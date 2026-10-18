---
name: functional-programming-strategically
description: Use when a deadline tempts a shortcut, when editing existing code, or when a codebase degrades a little with every change.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.3.0
---

# Programming Strategically

**In this pack:** [how much design a task warrants](../functional-design/references/calibration.md),
[the notation](../functional-design/references/notation.md), and
[syntax per language](../functional-design/SKILL.md#language-packs).

## Overview

Working code is not enough. The primary output of a change is not the
behaviour it adds but the structure it leaves behind, because that
structure determines the cost of every change after it.

Tactical programming optimises for finishing this task. Strategic
programming optimises for the system a year from now, and pays for it
with a small, continuous investment: roughly ten to twenty per cent extra
effort on every change, spent on design, not on ceremony.

## When to use

- Deciding whether to add a special case or restructure
- Under deadline pressure, about to take a shortcut
- Editing code somebody else designed
- A codebase that is getting worse: the same few files are edited by most
  commits in `git log`, or the user says so
- Reviewing a change that works but reads badly

Not for: throwaway spikes whose output is an answer, not code.

## Core rules

1. Default. **Ask what the change leaves behind.** Before writing, name the
   design the code will have afterwards. If the answer is "the same, plus one
   more special case", stop and look for a better shape. A case is not special
   when the module's purpose covers it without gaining an "and". The purpose is
   the sentence in the module's header comment, or, where it has none, the one
   you wrote down before looking at the change. Such a case goes in, in the
   module's own idiom.
2. Default. **Invest continuously, never in a lump.** A small investment on
   every change beats a rewrite later. There is no point at which a team gets
   time to "clean it up". Two changes are outside this: one that stays inside a
   single function, which owes only what rule 4 says, and a convention that has
   to change everywhere at once, which is one dedicated change.
3. Default. **Design it twice.** For anything whose shape other code will depend
   on, produce two genuinely different designs before choosing. A change that
   fits the module by the test in rule 1, and follows its idiom, needs no second
   design, and neither does one that stays inside a single function. See
   [design-it-twice.md](references/design-it-twice.md).
4. Default. **Leave the campsite cleaner.** Never leave the code worse, and when
   the change adds to a module, make one small structural improvement to the
   code the change already edits. A change that stays inside one function owes
   no improvement; it owes only that the code is no worse.
5. Judgement. **Take the extra step.** When you have found the right design,
   apply it to the neighbouring code that has the same problem, if that is a
   small step and not a project. A change that stays inside one function stops
   there, and the neighbours with the same problem go in a change of their own.
   What you saw and left goes in the change's description: the design it calls
   for, and why it is not in this diff.
6. Rule. **Match the stated convention first, the surrounding code second.**
   Consistency beats your personal preference. But where a project writes its
   conventions down -- an instructions file, a rule file, a lint rule -- those
   are the convention, and surrounding code that contradicts one is debt rather
   than a standard to match. A baseline that grandfathers the findings is a
   stated position too: the change leaves it as it is, neither regenerated nor
   cleared. See [consistency.md](references/consistency.md).
7. Default. **Measure before optimising.** Choose the functional default
   (sharing, folds, tail calls) without measuring. Performance work that
   makes the code harder to read is a design activity only on the critical
   path, and only with numbers. See
   [designing-for-performance.md](references/designing-for-performance.md).

## Tactical versus strategic

| Question              | Tactical answer | Strategic answer             |
| --------------------- | --------------- | ---------------------------- |
| Goal of the change    | Make it work    | Make it work and fit         |
| Special case appears  | Add an `if`     | Ask why the case exists      |
| Existing design wrong | Work around it  | Fix it, or narrow the fix    |
| Test is awkward       | Mock more       | Treat as a design signal     |
| Deadline pressure     | Cut design      | Offer a smaller scope        |
| Repeated code appears | Copy once more  | Find the missing abstraction |

The distinction is not speed. Tactical programming is faster for days and
slower for years; strategic programming pays back within months on any
codebase with a future.

## The tactical tornado

Someone who produces working features faster than anyone, and leaves a
wake that everyone else must clean up. Two consequences for you:

- Do not measure your own work by features delivered per week if that
  number is bought with structure.
- When you inherit such code, do not attempt a global cleanup. Improve
  the module you are already in, each time you are in it, by as much as
  rule 4 asks.

## Incrementing on abstractions, not only features

Working in small increments is right; taking the increment to be a
feature is what causes trouble. A feature is a slice through many
modules, so a system built one feature at a time acquires the structure
of its slices, and no module ends up owning a coherent piece of
knowledge.

The increment that keeps a design coherent is an **abstraction**: when a
feature needs something the system does not yet have a concept for, add
the concept, design its interface, and implement the feature on top of
it. The unit of work stays small; the unit of design stays whole.

The same caution applies to any practice that focuses attention on one unit at a
time, including test-driven development and pattern-driven design. They are
useful for producing correct code inside a boundary; they do not produce the
boundary. Decide the module's interface first, then work incrementally inside
it. See
[functional-testing-functional-code](../functional-testing-functional-code/SKILL.md)
and
[functional-translating-gof-patterns](../functional-translating-gof-patterns/SKILL.md).

## Modifying existing code

Staying strategic is hardest when editing. The aim: after your change,
the design is what you would have chosen had you designed the module for
the new requirement from the start. Where the requirement fits what the
module already is, that asks for no more than rule 4 does.

1. Read enough of the module to state its current abstraction in one
   sentence.
2. Decide whether the new requirement fits that abstraction. If it does,
   the change is small. If it does not, the abstraction is wrong, and a
   patch will make it worse.
3. If the abstraction is wrong, decide between restructuring and a
   minimal patch with the table in
   [functional-refactoring-toward-functional-design](../functional-refactoring-toward-functional-design/SKILL.md#deciding-patch-or-restructure).
4. If the table says patch, tell the user what you would restructure,
   make the minimal change, and record the debt as
   [keeping-design-clean.md](../functional-refactoring-toward-functional-design/references/keeping-design-clean.md)
   describes.
5. Update the comments and names the change invalidated. Stale comments
   are worse than none.

See [working-in-existing-code.md](references/working-in-existing-code.md).

## Red flags

- The commit message says "quick fix" or "temporary"
- A special case was added without asking why the case exists
- Tests were changed to match the code rather than the requirement
- A comment near your edit is now false and you left it
- The design got worse and nobody wrote down that it did
- Only one design was considered for something whose shape other code
  will depend on

## Common mistakes

- **Treating strategic as gold-plating.** Investment means design effort,
  not extra abstraction layers or configuration nobody asked for.
- **Deferring all cleanup to a rewrite.** Rewrites are rarely funded, and
  a rewrite of a design nobody understands reproduces the design.
- **Applying strategy to throwaway code.** A spike whose output is an
  answer does not need a design; label it and delete it.
- **Refusing to ship.** Offer the user a smaller scope, and say what each
  cut leaves undone; do not cut design or scope without their answer.
  Missing the deadline to perfect an internal boundary is not strategic.

## Related skills

- [functional-diagnosing-complexity](../functional-diagnosing-complexity/SKILL.md)
- [functional-refactoring-toward-functional-design](../functional-refactoring-toward-functional-design/SKILL.md)
- [functional-reviewing-functional-design](../functional-reviewing-functional-design/SKILL.md)

## Further reading

- [design-it-twice.md](references/design-it-twice.md)
- [working-in-existing-code.md](references/working-in-existing-code.md)
- [consistency.md](references/consistency.md)
- [designing-for-performance.md](references/designing-for-performance.md)
