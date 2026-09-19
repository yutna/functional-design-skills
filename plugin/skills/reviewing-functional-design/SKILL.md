---
name: reviewing-functional-design
description: Use when reviewing a design, a diff, or a module, before merging a change, or when judging whether functional code meets a design standard.
---

# Reviewing Functional Design

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
- Deciding what to fix first in code that everyone dislikes
- Checking your own work before calling it done

Not for: finding bugs, which is a different activity with different
methods.

## The pass

Run in this order. Stop and record findings; do not fix as you go, or you
will lose the overview.

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

| Rank | Finding                             | Why first         |
| ---- | ----------------------------------- | ----------------- |
| 1    | Illegal state representable         | Silent wrong data |
| 2    | Knowledge duplicated across modules | Drifts apart      |
| 3    | Hidden failure or hidden effect     | Unknown unknowns  |
| 4    | Domain depends on infrastructure    | Blocks everything |
| 5    | Shallow module or leaked internals  | Compounds daily   |
| 6    | Vague name, stale comment           | Cheap to fix      |
| 7    | Style and idiom                     | Lowest value      |

A finding at rank one is worth ten at rank six. Say so in the review, so
the author knows what to act on.

## The red flags

Each is a symptom you can see without understanding the system. That is
what makes them cheap to spot, and it is also their limit: **a red flag
is a place to look, not a finding.** A deliberate convention and a defect
look identical from outside.

So where the codebase states a rule -- in its instructions file, its own
rule files, or a lint rule -- that rule is the answer and the flag is
already settled. Read the reason it gives before doubting it. Everywhere
else, what turns a flag into a finding is evidence: a measurement, a
reproduced bug, or a failing test. Reporting the flag itself spends the
author's time relitigating a decision the team already made, and a review
that does it twice stops being read.

When a stated convention still looks wrong after you have read its
reason, measure the claim and take the numbers to whoever owns the
convention. That is a separate conversation, not a finding in this
review.

The full catalogue, with detection and repair for each, is in
[red-flags.md](references/red-flags.md).

| Flag                    | One-line test                                |
| ----------------------- | -------------------------------------------- |
| Shallow module          | Interface nearly as big as the code          |
| Information leakage     | Same knowledge in two modules                |
| Temporal decomposition  | Modules named for steps                      |
| Overexposure            | Common case pays for the rare one            |
| Pass-through function   | Body is one call, same arguments             |
| Repetition              | The same fact written twice                  |
| Special-general mixture | One caller's case inside a primitive         |
| Conjoined functions     | Neither readable without the other           |
| Comment repeats code    | Deleting it loses nothing                    |
| Implementation in a doc | Callers can depend on internals              |
| Vague name              | Could apply to half the codebase             |
| Hard to pick a name     | The thing has no single purpose              |
| Hard to describe        | The purpose sentence needs "and"             |
| Non-obvious code        | Correct, and a reader stumbles               |
| Illegal state           | A type permits what the business bans        |
| Primitive obsession     | Domain values as raw strings                 |
| Hidden failure          | Throws, and the type does not say            |
| Hidden effect           | Touches the world, and the type does not say |
| Wide dependency         | Takes a service, uses one function           |
| Anaemic pipeline        | Steps that do not change the type            |
| Over-modelled value     | A wrapper only one function ever sees        |
| Unparsed generic data   | A map with no schema reaches a rule          |

## Writing the review

For each finding, give three things and nothing else:

1. **Where**, precisely.
2. **What rule it breaks**, named, with the skill that covers it.
3. **The smallest change** that would fix it.

Do not list findings you would not act on. Do not rewrite the author's
design in the review; propose the smallest move that removes the flag,
and let them choose.

## Reviewing your own work

The same pass, with one addition: you cannot judge obviousness from the
inside. For that, either hand it to someone else, or leave it and re-read
it later with the specific question "what would I have to be told to use
this correctly?". See
[deciding-what-matters](../deciding-what-matters/SKILL.md).

## Red flags in the review itself

- Every comment is about style, and none about structure
- No finding is ranked, so the author fixes the easy ones
- A finding says what is wrong but not what would be right
- The review proposes a redesign larger than the change under review
- A rank-one finding is raised as a suggestion

## Common mistakes

- **Reviewing the diff only.** A change can be locally reasonable and
  make the module's design worse. Read enough context to judge.
- **Confusing unfamiliarity with obscurity.** Ask the author before
  calling something non-obvious, and record what the answer was; if it
  needed an answer, it needed a comment.
- **Demanding perfection in existing code.** Judge the change by whether
  it leaves the design better than it found it.
- **Fixing while reading.** You lose the overview and miss the rank-one
  finding.

## Related skills

- [diagnosing-complexity](../diagnosing-complexity/SKILL.md)
- [refactoring-toward-functional-design](../refactoring-toward-functional-design/SKILL.md)
- [programming-strategically](../programming-strategically/SKILL.md)
- [functional-design](../functional-design/SKILL.md)

## Further reading

- [red-flags.md](references/red-flags.md) is the full catalogue with
  detection and repair for each flag.
- [review-procedure.md](references/review-procedure.md) is the pass in
  detail, with the questions to ask at each step.
