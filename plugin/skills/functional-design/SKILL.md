---
name: functional-design
description: Use when starting design or review, when deciding how much design a task warrants, from a throwaway script to a new subsystem, or when unsure which skill fits.
---

# Functional Design

## Overview

This pack is a set of executable design rules for codebases written in a
functional style. It covers complexity and module boundaries, modelling a
domain in types, composing workflows, immutability, and where effects
belong.

One method runs through all of it: make the domain explicit in types,
express behaviour as composed total functions, push effects to the edges,
and hide everything else behind deep interfaces.

## When to use

- Starting a new module, workflow, endpoint, or bounded context
- A small change forces edits in many places, or nobody can predict what
  a change will break
- Reviewing a design or a diff and needing a concrete checklist
- Unsure which skill in this pack applies to the problem in front of you

Not for: language syntax lookups, or build and tooling problems.

## How much design does this need?

Decide this before opening a skill. The row is chosen by something you
can observe about the task, not by how important it feels.

| The task                      | Apply               | Skip         |
| ----------------------------- | ------------------- | ------------ |
| Output is an answer           | nothing             | everything   |
| One function, module exists   | names, totality     | modelling    |
| A feature in an existing flow | the flow's idiom    | new contexts |
| A new module or workflow      | the design loop     | nothing      |
| A new bounded context         | loop, then contexts | nothing      |

Reading the rows:

- **Output is an answer.** A script run once, a probe, a migration you
  will delete. Write it, get the answer, label it throwaway.
- **One function, module exists.** Match what the module already does.
  Give the function an honest signature and a precise name. Do not
  introduce a wrapper type, an error union, or a boundary the module
  does not already have.
- **A feature in an existing flow.** The idiom is already decided; your
  job is to fit it and leave the module no worse. New types only where
  the feature genuinely introduces a new concept.
- **A new module or workflow.** The full loop below is worth its cost,
  because other code is about to depend on the shape you choose.
- **A new bounded context.** The loop, plus the language and boundary
  work in `capturing-the-domain` and
  `enforcing-consistency-boundaries`.

Applying a heavier row than the task calls for is itself a design
failure: it adds interface, indirection, and reading cost that the
problem did not ask for, which is the definition of complexity these
skills exist to remove. See
[calibration.md](references/calibration.md) for the failure modes in
both directions.

## The design loop

Run in order. Skip a step only when the previous one proved it irrelevant.

1. Say what the software must do in the domain's own words, as commands
   and events. See
   [capturing-the-domain](../capturing-the-domain/SKILL.md).
2. Model the data so impossible states cannot be built. See
   [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
   and
   [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md).
3. Write the workflow as a pipeline of total functions, typed end to end.
   See
   [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md).
4. Decide where effects live: pure core, effectful shell. See
   [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md).
5. Shape the modules so each hides more than it reveals. See
   [designing-deep-modules](../designing-deep-modules/SKILL.md) and
   [hiding-information](../hiding-information/SKILL.md).
6. Name things precisely and comment only what code cannot say. See
   [choosing-precise-names](../choosing-precise-names/SKILL.md).
7. Audit the result against the red-flag catalogue. See
   [reviewing-functional-design](../reviewing-functional-design/SKILL.md).

## Symptom to skill

- Small change touches many files -> [diagnosing-complexity](../diagnosing-complexity/SKILL.md)
- Shipping fast now, paying later -> [programming-strategically](../programming-strategically/SKILL.md)
- Reader cannot tell what matters -> [deciding-what-matters](../deciding-what-matters/SKILL.md)
- Interface as large as the code behind it -> [designing-deep-modules](../designing-deep-modules/SKILL.md)
- Callers know internal details -> [hiding-information](../hiding-information/SKILL.md)
- Layers repeat the same abstraction -> [separating-layers](../separating-layers/SKILL.md)
- Unsure whether to split a function -> [splitting-and-joining-code](../splitting-and-joining-code/SKILL.md)
- Dependency direction feels wrong -> [applying-solid-functionally](../applying-solid-functionally/SKILL.md)
- Code and business speak different words -> [capturing-the-domain](../capturing-the-domain/SKILL.md)
- Types are records of primitives -> [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- Shape comes from config or varies per tenant -> [choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md)
- Booleans and nullable fields encode state -> [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- Strings and numbers used raw -> [constraining-primitive-values](../constraining-primitive-values/SKILL.md)
- Status fields and if-ladders -> [modeling-state-machines](../modeling-state-machines/SKILL.md)
- Unclear what one transaction covers -> [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)
- Use case spread across services -> [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- Functions do not fit together -> [composing-functions](../composing-functions/SKILL.md)
- Database calls deep inside logic -> [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- Errors thrown and caught everywhere -> [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- Error handling dwarfs the happy path -> [defining-errors-out-of-existence](../defining-errors-out-of-existence/SKILL.md)
- Logic cannot be tested without I/O -> [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- Shared mutable state or race conditions -> [managing-state-immutably](../managing-state-immutably/SKILL.md)
- Wire and storage shapes leak inward -> [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- Reaching for a class-based pattern -> [translating-gof-patterns](../translating-gof-patterns/SKILL.md)
- Loops accumulating into variables -> [folding-over-data](../folding-over-data/SKILL.md)
- Deep recursion or expensive repeats -> [using-recursion-and-laziness](../using-recursion-and-laziness/SKILL.md)
- Names are vague or hard to choose -> [choosing-precise-names](../choosing-precise-names/SKILL.md)
- Comments restate the code -> [writing-useful-comments](../writing-useful-comments/SKILL.md)
- Tests need heavy mocking -> [testing-functional-code](../testing-functional-code/SKILL.md)
- Need to judge a design or a diff -> [reviewing-functional-design](../reviewing-functional-design/SKILL.md)
- Imperative code to be moved forward -> [refactoring-toward-functional-design](../refactoring-toward-functional-design/SKILL.md)
- Effects retried, duplicated, or lost -> [making-effects-reliable](../making-effects-reliable/SKILL.md)
- An incident the records could not explain -> [designing-what-to-observe](../designing-what-to-observe/SKILL.md)

## Language packs

Core skills use a neutral notation. For real syntax, load the pack that
matches the project and use it alongside the core skill.

- [functional-javascript](../functional-javascript/SKILL.md)
- [functional-typescript](../functional-typescript/SKILL.md)
- [functional-typescript-effect](../functional-typescript-effect/SKILL.md)
- [functional-typescript-ts-pattern](../functional-typescript-ts-pattern/SKILL.md)
- [functional-react-nextjs](../functional-react-nextjs/SKILL.md)
- [functional-elixir-phoenix](../functional-elixir-phoenix/SKILL.md)

## Quick reference

| Question                     | Answer                                  |
| ---------------------------- | --------------------------------------- |
| Where does validation go?    | At the boundary, into domain types      |
| Where does I/O go?           | Edges only; core stays pure             |
| How are errors returned?     | Result values, not exceptions           |
| How are dependencies passed? | As function parameters                  |
| What makes an interface good | It hides far more than it reveals       |
| Does this shape need a type? | Yes, unless its fields come from config |
| When is a design done?       | When the red-flag audit finds none      |

## Red flags

Each is a place to look, not a verdict. Where this codebase states a rule
of its own, that rule is the answer; elsewhere a flag becomes a finding
only with evidence -- a measurement, a reproduced bug, or a failing test.

- A design decision was made before anyone named the domain concept
- A type can represent a state the business forbids
- A function's signature does not say what it can fail with
- A module's interface is as complicated as its implementation
- Only one design was considered

## Further reading

- [notation.md](references/notation.md) is the neutral notation used by
  every core skill in this pack.
- [design-loop.md](references/design-loop.md) is a worked pass through
  the seven steps on one small feature.
- [principles.md](references/principles.md) is every rule in the pack
  compressed onto one page, for when there is no time to read a skill.
- [calibration.md](references/calibration.md) is how much of the pack a
  given task actually warrants, and the cost of getting that wrong.
- [essential-and-accidental.md](../diagnosing-complexity/references/essential-and-accidental.md)
  is the question to ask before any refactor: did we add this
  complexity, or is it in the problem?

## Worked examples

Five end-to-end walkthroughs. Judgment transfers through these better
than through rules.

- [design-loop.md](references/design-loop.md) — a small feature through
  all seven steps.
- [a new workflow](../designing-workflow-pipelines/references/worked-example.md)
  — booking an appointment, from event storming to composed code.
- [a refactor](../refactoring-toward-functional-design/references/worked-refactor.md)
  — a legacy service moved in ten commits.
- [a read model](../crossing-io-boundaries/references/worked-read-model.md)
  — a screen where the aggregate rules do not apply.
- [a long-running process](../making-effects-reliable/references/worked-long-running.md)
  — three systems, compensation, and idempotency.
