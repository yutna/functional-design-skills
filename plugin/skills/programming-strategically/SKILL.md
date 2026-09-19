---
name: programming-strategically
description: Use when a deadline tempts a shortcut, when editing existing code, or when a codebase degrades a little with every change.
---

# Programming Strategically

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
- A codebase that everyone agrees is getting worse
- Reviewing a change that works but reads badly

Not for: throwaway spikes whose output is an answer, not code.

## Core rules

1. **Ask what the change leaves behind.** Before writing, name the design
   the code will have afterwards. If the answer is "the same, plus one
   more special case", stop and look for a better shape.
2. **Invest continuously, never in a lump.** Ten per cent on every change
   beats a rewrite later. There is no point at which a team gets time to
   "clean it up".
3. **Design it twice.** For anything non-trivial, produce two genuinely
   different designs before choosing. See
   [design-it-twice.md](references/design-it-twice.md).
4. **Leave the campsite cleaner.** Every change touching a module makes
   at least one small structural improvement to it.
5. **Take the extra step.** When you have found the right design, apply
   it to the neighbouring code that has the same problem, if that is a
   small step and not a project.
6. **Match the stated convention first, the surrounding code second.**
   Consistency beats your personal preference. But where a project writes
   its conventions down -- an instructions file, a rule file, a lint rule
   -- those are the convention, and surrounding code that contradicts one
   is debt rather than a standard to match. See
   [consistency.md](references/consistency.md).
7. **Measure before optimising.** Performance work is a design activity
   only on the critical path, and only with numbers. See
   [designing-for-performance.md](references/designing-for-performance.md).

## Tactical versus strategic

| Question              | Tactical answer | Strategic answer             |
| --------------------- | --------------- | ---------------------------- |
| Goal of the change    | Make it work    | Make it work and fit         |
| Special case appears  | Add an `if`     | Ask why the case exists      |
| Existing design wrong | Work around it  | Fix it, or narrow the fix    |
| Test is awkward       | Mock more       | Treat as a design signal     |
| Deadline pressure     | Cut design      | Cut scope                    |
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
  the module you are already in, each time you are in it.

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

The same caution applies to any practice that focuses attention on one
unit at a time, including test-driven development and pattern-driven
design. They are useful for producing correct code inside a boundary;
they do not produce the boundary. Decide the module's interface first,
then work incrementally inside it. See
[testing-functional-code](../testing-functional-code/SKILL.md) and
[translating-gof-patterns](../translating-gof-patterns/SKILL.md).

## Modifying existing code

Staying strategic is hardest when editing. The rule: after your change,
the design must be what you would have chosen had you designed the module
for the new requirement from the start.

1. Read enough of the module to state its current abstraction in one
   sentence.
2. Decide whether the new requirement fits that abstraction. If it does,
   the change is small. If it does not, the abstraction is wrong, and a
   patch will make it worse.
3. If the abstraction is wrong and the fix is bounded, fix it now.
4. If the fix is not bounded, make the minimal change, and write down
   what the right design is and why you did not do it.
5. Update the comments and names the change invalidated. Stale comments
   are worse than none.

See [working-in-existing-code.md](references/working-in-existing-code.md).

## Red flags

- The commit message says "quick fix" or "temporary"
- A special case was added without asking why the case exists
- Tests were changed to match the code rather than the requirement
- A comment near your edit is now false and you left it
- The design got worse and nobody wrote down that it did
- Only one design was considered for something non-obvious

## Common mistakes

- **Treating strategic as gold-plating.** Investment means design effort,
  not extra abstraction layers or configuration nobody asked for.
- **Deferring all cleanup to a rewrite.** Rewrites are rarely funded, and
  a rewrite of a design nobody understands reproduces the design.
- **Applying strategy to throwaway code.** A spike whose output is an
  answer does not need a design; label it and delete it.
- **Refusing to ship.** Cutting scope is strategic; missing the deadline
  to perfect an internal boundary is not.

## Related skills

- [diagnosing-complexity](../diagnosing-complexity/SKILL.md)
- [refactoring-toward-functional-design](../refactoring-toward-functional-design/SKILL.md)
- [reviewing-functional-design](../reviewing-functional-design/SKILL.md)

## Further reading

- [design-it-twice.md](references/design-it-twice.md)
- [working-in-existing-code.md](references/working-in-existing-code.md)
- [consistency.md](references/consistency.md)
- [designing-for-performance.md](references/designing-for-performance.md)
