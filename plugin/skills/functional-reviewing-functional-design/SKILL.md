---
name: functional-reviewing-functional-design
description: Use when reviewing a design, a diff, or a module, before merging a change, or when judging whether functional code meets a design standard.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
---

# Reviewing Functional Design

**In this pack:** [how much design a task warrants](../functional-design/references/calibration.md),
[the notation](../functional-design/references/notation.md), and
[syntax per language](../functional-design/SKILL.md#language-packs).

## Overview

This is the audit pass for everything else in this pack. It turns the
principles into a checklist that can be run against a diff, a module, or
a proposed design, and produces findings ranked by cost rather than a
list of opinions.

The value of a red flag is that it is cheap to spot and reliably points
at a real problem. You do not need to understand a system to notice that
a function's body is one call, that two modules share a string literal,
or that a name could apply to anything.

## When to use

- Reviewing a pull request or a design document
- Before merging any non-trivial change
- Assessing an unfamiliar codebase
- Deciding what to fix first in code the user or the history marks as
  troublesome, such as the files most commits edit
- Checking your own work before calling it done

Not for: debugging a failure you already have, which is a different
activity with different methods.

## The pass

Run in this order. Stop and record flags; do not fix as you go, or you
will lose the overview. A flag is an observation at a place; the section
on red flags says when it becomes a finding.

1. **Types.** Can any type hold a state the business forbids? Are domain
   values primitives? Does a record have correlated optional fields?
2. **Signatures.** Is every function total? Are failures in the return
   type? Are effects visible? Would two parameters be transposable?
3. **Interfaces.** Is each module's interface much smaller than what it
   hides? Is anything exported that no caller outside uses?
4. **Dependencies.** Does the domain import infrastructure? Does any
   function take a whole service to use one operation? Is a value
   threaded through functions that do not read it?
5. **Duplication of knowledge.** Does the same rule, format, or literal
   appear in two modules?
6. **Names and comments.** Any name that could apply to anything? Any
   comment that restates the code, or that is now false?
7. **Effects.** Any I/O, clock, or randomness inside a decision? Any
   business rule inside the shell?
8. **Tests.** Does any business rule require infrastructure to test?

## Ranking findings

Fix in this order, because the cost of leaving each is different.

| Rank | Finding                                    | Why first         |
| ---- | ------------------------------------------ | ----------------- |
| 1    | Illegal state representable                | Silent wrong data |
| 2    | Knowledge duplicated across modules        | Drifts apart      |
| 3    | Hidden failure or effect, false comment    | Unknown unknowns  |
| 4    | Domain depends on infrastructure           | Blocks everything |
| 5    | Shallow module, pass-through, overexposure | Compounds daily   |
| 6    | Vague name, comment that repeats code      | Cheap to fix      |
| 7    | Style and idiom                            | Lowest value      |

A finding at rank one is worth ten at rank six. Say so in the review, so
the author knows what to act on.

## The red flags

Each is a symptom you can see without understanding the system. That is
what makes them cheap to spot, and it is also their limit: **a red flag
is a place to look, not a finding.** A deliberate convention and a defect
look identical from outside. The pass records flags; a flag becomes a
finding only as set out here.

So where the codebase states a rule -- in its instructions file, its own
rule files, or a lint rule -- that rule is the answer and the flag is
already settled. Read the reason it gives before doubting it. Everywhere
else, what turns a flag into a finding is its cost stated for that place,
or evidence: a measurement, a reproduced bug, or a failing test.
Reporting the flag itself spends the author's time relitigating a
decision the project already made, and a review that does it twice stops
being read.

When a stated convention still looks wrong after you have read its
reason, measure the claim and report the numbers to the user as a
separate note. It is not a finding in this review.

The full catalogue, with detection and repair for each, is in
[red-flags.md](references/red-flags.md).

| Flag                          | One-line test                                |
| ----------------------------- | -------------------------------------------- |
| Shallow module                | Interface nearly as big as the code          |
| Information leakage           | Same fact in two places, same edit           |
| Temporal decomposition        | Modules named for steps                      |
| Overexposure                  | Common case pays for the rare one            |
| Pass-through function         | Body is one call, same arguments             |
| Special-general mixture       | One caller's case inside a primitive         |
| Conjoined functions           | Neither readable without the other           |
| Threaded value                | Passed through functions that never read it  |
| Illegal state representable   | A type permits what the business bans        |
| Primitive obsession           | Domain values as raw strings                 |
| Anaemic pipeline              | Steps that do not change the type            |
| Status string                 | String literals compared in many modules     |
| Over-modelled value           | A wrapper only one function ever sees        |
| Unparsed generic data         | A map with no schema reaches a rule          |
| Hidden failure                | Throws, and the type does not say            |
| Hidden effect                 | Touches the world, and the type does not say |
| Wide dependency               | Takes a service, uses one function           |
| Inverted dependency direction | Domain imports a driver or framework         |
| Comment repeats the code      | Deleting it loses nothing                    |
| Implementation in a doc       | Callers can depend on internals              |
| Vague name                    | Could apply to half the codebase             |
| Hard to pick a name           | The thing has no single purpose              |
| Hard to describe              | The purpose sentence needs "and"             |
| Non-obvious code              | Correct, and a reader stumbles               |

## Writing the review

For each finding, give three things and nothing else:

1. **Where**, precisely, and what is wrong in one clause.
2. **The smallest change** that would fix it.
3. **What rule it breaks**, named, with the skill that covers it.

Do not list findings you would not act on. Do not rewrite the author's
design in the review; propose the smallest move that removes the flag,
and let them choose.

## Reviewing your own work

The same pass, with two differences. You cannot judge obviousness from
the inside, so that step needs a reader who has not seen the code;
[working-alone.md](../functional-design/references/working-alone.md)
says who that is. With no such reader, write the step as unverified in
the review. See
[functional-deciding-what-matters](../functional-deciding-what-matters/SKILL.md).
The second difference is in the obviousness checklist: on your own code
you fix at the first "no", and on someone else's diff you record each
one and fix none.

## Red flags in the review itself

- Every comment is about style, and none about structure
- No finding is ranked, so the author fixes the easy ones
- A finding says what is wrong but not what would be right
- The review proposes a redesign larger than the change under review
- A rank-one finding is raised as a suggestion

## Common mistakes

- **Reviewing the diff only.** A change can be locally reasonable and
  make the module's design worse. Read enough context to judge.
- **Confusing unfamiliarity with obscurity.** Ask the user, who can ask
  the author, only when the stumble is over a domain fact or convention
  you could not have known, and record what the answer was; if it needed
  an answer, it needed a comment.
- **Demanding perfection in existing code.** Judge the change by the bar
  in [functional-programming-strategically](../functional-programming-strategically/SKILL.md):
  what a change owes the code it touches.
- **Fixing while reading.** You lose the overview and miss the rank-one
  finding.

## Related skills

- [functional-diagnosing-complexity](../functional-diagnosing-complexity/SKILL.md)
- [functional-refactoring-toward-functional-design](../functional-refactoring-toward-functional-design/SKILL.md)
- [functional-programming-strategically](../functional-programming-strategically/SKILL.md)
- [functional-design](../functional-design/SKILL.md)

## Further reading

- [red-flags.md](references/red-flags.md) is the full catalogue with
  detection and repair for each flag.
- [review-procedure.md](references/review-procedure.md) is the pass in
  detail, with the questions to ask at each step.
