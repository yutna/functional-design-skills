---
name: functional-diagnosing-complexity
description: Use when a small change touches many files, when an edit breaks a module nobody expected, when code is slow to read, or when complexity looks self-inflicted.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.1.0
---

# Diagnosing Complexity

## Overview

Complexity is anything about the structure of a system that makes it hard
to understand or modify. It has two parts: essential complexity, which is
inherent in the problem, and accidental complexity, which the code adds
on top of it. Judge it by how hard change is, not by line counts. What
can be observed is the files a typical change touches (`git log --stat`
lists them), the files that must be opened to read one function, and
what the user reports. Where a step below asks for a person's view, see
[working-alone.md](../functional-design/references/working-alone.md).

Diagnose before you fix. Every complexity has exactly two ultimate causes
and shows up as exactly three symptoms. Naming the symptom and tracing it
to its cause tells you which design rule to apply.

## When to use

- A one-line behaviour change requires edits in five places
- Reading a function requires opening four other files first
- A change broke something no one predicted it could reach
- Estimating a change is guesswork
- Before proposing any refactor, so the refactor targets a real cause

Not for: performance problems, or code that is hard only because its
domain words are unfamiliar to you. The test is a competent developer
who is new to this code and fluent in the language and the domain's
vocabulary.

## Is this complexity necessary?

Ask this before anything else. Complexity you added should be deleted,
and refactoring does not delete it — once accidental complexity has a
clean interface and a test suite, nobody removes it.

State the requirement in the business's words, using no implementation
nouns. The user's request, the tests and the docs are where those words
are found; see
[working-alone.md](../functional-design/references/working-alone.md).
Then list what the code contains that the sentence did not mention:
flags, caches, orderings, adapters, intermediate representations,
defensive checks. Each item on that list is a candidate for
**accidental**: it is in your solution, not in the problem. It is a
candidate, not a verdict, until the question below has been asked of it.

Almost all accidental complexity has one of three sources.

- **State.** A flag, a cache, a copy. See
  [functional-managing-state-immutably](../functional-managing-state-immutably/SKILL.md).
- **Control.** A required call order. See
  [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md).
- **Code volume.** Code carrying nothing. See
  [functional-designing-deep-modules](../functional-designing-deep-modules/SKILL.md).

State is the worst of the three, because it makes the unit of reasoning
the whole history of the program rather than the function in front of
you. Two booleans and an optional boolean are twelve states, not three
things to remember.

For each candidate, ask what breaks if it vanishes. The answer sorts it
into one of the outcomes set out in
[essential-and-accidental.md](references/essential-and-accidental.md):
delete it, keep it for a measured performance need, move the rule it
carries into a type and then delete it, or keep it because it is a
boundary or stage type. Run the procedure below on what is left.

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
places:

- Order of calls that the types do not enforce
- Implicit context: clock, locale, timezone, environment, current user
- Values read from shared mutable state, module state, or globals
- Types that overlap in shape so a caller can pass the wrong one
- Duplicated invariants: the same rule enforced in two modules
- Shape dependencies across a boundary: an internal type serialised
  directly, so the storage or wire format constrains the domain model

**Obscurity.** Important information is not obvious. Vague names, missing
documentation of a non-obvious contract, a type whose legal values are
described only in prose, an error case that exists but is not in the
signature. Obscurity is what turns a dependency into an unknown unknown.

## Diagnostic procedure

1. State the change you are about to make, or pick a past change from
   `git log` that touched the module, in one sentence.
2. List every file that change edited, and every file you needed to read
   but not edit. The second list is the more interesting one.
3. For each file, write why it was involved. If the answer is "it also
   knew about X", you have found a dependency on X.
4. Classify the pain as amplification, cognitive load, or unknown
   unknowns. If more than one, take them one at a time.
5. Decide whether the root is a dependency or obscurity. Ask: if every
   name and comment were perfect, would the dependency still be there?
   Yes means it is a dependency, and the comment only makes it visible.
   No means obscurity alone. Both may hold; fix the dependency first.
6. Look up the fix in the list below and apply that skill.

## Quick reference

Once the diagnosis names a cause, this list names the skill.

- Fact duplicated -> [functional-splitting-and-joining-code](../functional-splitting-and-joining-code/SKILL.md)
- Wire shape leaks inward -> [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md)
- Caller knows internals -> [functional-hiding-information](../functional-hiding-information/SKILL.md)
- Interface as big as code -> [functional-designing-deep-modules](../functional-designing-deep-modules/SKILL.md)
- Implicit call ordering -> [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- Contract not in the type -> [functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
- Hidden effects -> [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- Vague names -> [functional-choosing-precise-names](../functional-choosing-precise-names/SKILL.md)
- Shape decided outside code -> [functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md)
- Layers repeat each other -> [functional-separating-layers](../functional-separating-layers/SKILL.md)

## Complexity is incremental

No single decision makes a system complex. It accumulates from many small
concessions, each defensible on its own. That has two consequences:

- A zero-tolerance policy for changes that make the design worse is the
  only workable one. "Just this once" is how every complex system was
  built.
- You cannot fix it in one heroic refactor either. What each change owes
  the code it touches is stated in
  [functional-programming-strategically](../functional-programming-strategically/SKILL.md).

## Red flags

- Recent commits to one module each touch many files (`git log --stat`)
- The history shows one author for a module, or a comment says only one
  person knows how that part works
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
  the one above: state the requirement in the business's words, and see
  how much of the code it fails to account for.
- **Refactoring before diagnosing.** A refactor that does not name the
  dependency it removes usually just moves it.

## Related skills

- [functional-programming-strategically](../functional-programming-strategically/SKILL.md)
- [functional-reviewing-functional-design](../functional-reviewing-functional-design/SKILL.md)
- [functional-hiding-information](../functional-hiding-information/SKILL.md)

## Further reading

- [essential-and-accidental.md](references/essential-and-accidental.md)
  is the necessity axis in full, with the three sources worked through
  and a worked example of deleting rather than tidying.
- [symptoms.md](references/symptoms.md) works each symptom through a
  functional example, with the questions that expose it.
- [dependencies-and-obscurity.md](references/dependencies-and-obscurity.md)
  is a catalogue of where dependencies hide in functional code and how
  each is removed.
