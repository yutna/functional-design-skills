---
name: diagnosing-complexity
description: Use when a small change touches many files, when an edit breaks a module nobody expected, when code is slow to read, or when complexity looks self-inflicted.
---

# Diagnosing Complexity

## Overview

Complexity is anything about the structure of a system that makes it hard
to understand or modify. It is not the difficulty of the problem being
solved; it is what the code adds on top of that problem. Complexity is
what you feel, not what you measure: if the people working in a system
find it hard to change, it is complex, whatever the metrics say.

Diagnose before you fix. Every complexity has exactly two ultimate causes
and shows up as exactly three symptoms. Naming the symptom and tracing it
to its cause tells you which design rule to apply.

## When to use

- A one-line behaviour change requires edits in five places
- Reading a function requires opening four other files first
- A change broke something no one predicted it could reach
- Estimating a change is guesswork
- Before proposing any refactor, so the refactor targets a real cause

Not for: performance problems, or code that is merely unfamiliar to you
but obvious to the people who own it.

## Is this complexity necessary?

Ask this before anything else. Complexity you added should be deleted,
and refactoring does not delete it — once accidental complexity has a
clean interface and a test suite, nobody removes it.

State the requirement in the domain expert's words, using no
implementation nouns. Then list what the code contains that the sentence
did not mention: flags, caches, orderings, adapters, intermediate
representations, defensive checks. Everything on that list is
**accidental** — it is in your solution, not in the problem — and nothing
in the domain will defend it.

Almost all accidental complexity has one of three sources.

| Source      | Looks like              | Skill                             |
| ----------- | ----------------------- | --------------------------------- |
| State       | A flag, a cache, a copy | `managing-state-immutably`        |
| Control     | A required call order   | `separating-pure-core-from-shell` |
| Code volume | Code carrying nothing   | `designing-deep-modules`          |

State is the worst of the three, because it makes the unit of reasoning
the whole history of the program rather than the function in front of
you. Two booleans and an optional field are twelve states, not three
things to remember.

For each accidental item, ask what breaks if it vanishes. Nothing means
delete it. A performance requirement means keep it, isolate it, and label
it as accidental. A correctness rule living inside it means move the rule
into a type, then delete it.

Run the procedure below only on what survives. See
[essential-and-accidental.md](references/essential-and-accidental.md).

## The three symptoms

**Change amplification.** One conceptual change requires modification in
many places. Count the files a typical change touches. In functional code
this usually means a fact is written down more than once: a validation
rule repeated at three call sites, a status string parsed in four
modules, a unit conversion inlined wherever it is needed.

**Cognitive load.** A developer must hold too much in their head to make a
correct change. Measure it as the number of facts you must already know
before you may edit a function safely: which caller has already
validated, whether the list is sorted, which fields may be absent,
whether the function may be called twice.

**Unknown unknowns.** You cannot tell which code must change, or what you
must know, to make a change correctly. This is the worst symptom, because
there is no point at which you can stop looking. It is caused by
information that is required but not visible in the interface.

## The two causes

**Dependencies.** A dependency exists when code cannot be understood or
modified in isolation. Dependencies are necessary; the goal is to have
few, and to make each obvious. In functional code they hide in these
places, in rough order of how often they bite:

- Booking of calls that the types do not enforce
- Values read from shared mutable state, module state, or globals
- Implicit context: clock, locale, timezone, environment, current user
- Types that overlap in shape so a caller can pass the wrong one
- Duplicated invariants: the same rule enforced in two modules

**Obscurity.** Important information is not obvious. Vague names, missing
documentation of a non-obvious contract, a type whose legal values are
described only in prose, an error case that exists but is not in the
signature. Obscurity is what turns a dependency into an unknown unknown.

## Diagnostic procedure

1. State the change that felt hard, in one sentence.
2. List every file you had to edit, and every file you had to read but
   not edit. The second list is the more interesting one.
3. For each file, write why it was involved. If the answer is "it also
   knew about X", you have found a dependency on X.
4. Classify the pain as amplification, cognitive load, or unknown
   unknowns. If more than one, take them one at a time.
5. Decide whether the root is a dependency or obscurity. Ask: if this had
   a perfect name and a comment, would the problem be gone? Yes means
   obscurity; no means a dependency.
6. Look up the fix in the table below and apply that skill.

## Quick reference

Once the diagnosis names a cause, this table names the skill.

| Cause found                | Skill                                   |
| -------------------------- | --------------------------------------- |
| Fact duplicated            | `splitting-and-joining-code`            |
| Wire shape leaks inward    | `crossing-io-boundaries`                |
| Caller knows internals     | `hiding-information`                    |
| Interface as big as code   | `designing-deep-modules`                |
| Implicit call ordering     | `modeling-state-machines`               |
| Contract not in the type   | `making-illegal-states-unrepresentable` |
| Hidden effects             | `separating-pure-core-from-shell`       |
| Vague names                | `choosing-precise-names`                |
| Shape decided outside code | `choosing-types-or-plain-data`          |
| Layers repeat each other   | `separating-layers`                     |

## Complexity is incremental

No single decision makes a system complex. It accumulates from many small
concessions, each defensible on its own. That has two consequences:

- A zero-tolerance policy is the only workable one. "Just this once" is
  how every complex system was built.
- You cannot fix it in one heroic refactor either. Each change should
  leave the design a little better than it found it.

## Red flags

- Nobody can say how long a change will take without reading the code
- The team has a person who "knows how that part works"
- A pull request explains itself with "you also have to remember to..."
- A bug report says a change broke a module the author never opened
- The same business rule appears in more than one module

## Common mistakes

- **Treating complexity as a code metric.** Line counts and cyclomatic
  numbers miss the worst cases. The measurement is how hard change is.
- **Fixing the symptom you noticed instead of the cause.** Extracting a
  function reduces line count but can raise cognitive load.
- **Blaming the domain.** Some domains are genuinely intricate. That
  explains essential complexity, never the accidental kind. The check is
  the one above: state the requirement in the expert's words, and see how
  much of the code it fails to account for.
- **Refactoring before diagnosing.** A refactor that does not name the
  dependency it removes usually just moves it.

## Related skills

- [programming-strategically](../programming-strategically/SKILL.md)
- [reviewing-functional-design](../reviewing-functional-design/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)

## Further reading

- [essential-and-accidental.md](references/essential-and-accidental.md)
  is the necessity axis in full, with the three sources worked through
  and a worked example of deleting rather than tidying.
- [symptoms.md](references/symptoms.md) works each symptom through a
  functional example, with the questions that expose it.
- [dependencies-and-obscurity.md](references/dependencies-and-obscurity.md)
  is a catalogue of where dependencies hide in functional code and how
  each is removed.
