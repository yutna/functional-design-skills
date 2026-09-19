# The Principles, on One Page

Every rule in this pack, compressed. Use it as a checklist when there is
no time to read a skill, and follow the link when a line needs its
reasoning.

## Complexity

1. Complexity is what makes a system hard to change, not what makes it
   large. Measure it by how hard change is.
2. It has three symptoms: change amplification, cognitive load, unknown
   unknowns. It has two causes: dependencies and obscurity.
3. It accumulates from small concessions, so the only workable policy is
   zero tolerance, applied one change at a time.
4. The primary output of a change is the design it leaves behind.
5. Produce two genuinely different designs before choosing one.
6. Ask whether the complexity is in the problem or in your solution.
   Complexity you added should be deleted, not refactored — a domain
   expert describing the requirement would not mention a flag, a cache,
   or a required call order.
7. Almost all added complexity is state, then ordering, then sheer
   volume of code, in that order of harm.

Skills: `diagnosing-complexity`, `programming-strategically`.

## Modules and interfaces

1. A module's value is how much it hides per unit of interface. Prefer
   deep modules to many small ones.
2. The interface includes everything a caller must know, including the
   rules no type states.
3. Each module owns knowledge no other module has. Two owners of one
   fact is leakage.
4. Decompose by knowledge, never by the booking things happen.
5. Each layer changes the abstraction. A function whose body is one call
   is not a layer.
6. Given a choice, make the implementation harder and the interface
   easier.
7. Bring code together when it shares knowledge; keep it apart when one
   part is general and the other special.
8. Make what matters obvious and everything else invisible.

Skills: `designing-deep-modules`, `hiding-information`,
`separating-layers`, `splitting-and-joining-code`,
`deciding-what-matters`, `applying-solid-functionally`.

## Types and the domain

1. Use the domain's words, unchanged, in every type and function name.
2. Discover the domain through events and the commands that cause them,
   not through nouns.
3. Say AND with a record and OR with a choice type. Most modelling
   mistakes are AND where the domain means OR.
4. Make illegal states unrepresentable; prefer construction over
   validation.
5. Wrap every constrained primitive in its own type with a constructor
   that can fail.
6. Model a lifecycle as a choice type with one function per transition.
7. Draw a consistency boundary around each set of invariants that must
   hold together, and make it one transaction.
8. Draw a context boundary wherever a word changes meaning, and never
   share a model across one.

Skills: `capturing-the-domain`, `modeling-with-algebraic-types`,
`making-illegal-states-unrepresentable`, `constraining-primitive-values`,
`modeling-state-machines`, `enforcing-consistency-boundaries`.

## Representation

The rules above assume a shape is worth modelling. These say when it is
not.

1. Model the shape. Default, not preference; "this is verbose" is not a
   reason to leave it.
2. Leave it generic only on an observable fact: its fields come from
   config or an admin, it varies per tenant, its schema is data, or
   nothing branches on it.
3. Decide per value, never per project. A typed envelope around a
   generic payload is the usual answer.
4. Generic is not cheaper. It owes a boundary schema, key constants,
   accessor functions, coverage tests, and a schema version.
5. Anything the system decides with gets a type. Anything it only
   stores, forwards, or renders may stay generic.

Skill: `choosing-types-or-plain-data`.

## Functions and workflows

1. Every function is total: for every input of its type there is an
   output of its type, with no exception and no null.
2. A workflow is a command in and events out, written as a pipeline of
   total functions with one type per completed stage.
3. Dependencies are parameters. Prefer fetching first and deciding
   purely; parameterize when you cannot; interpret when the effects
   themselves are a business artefact.
4. Configuration and dependencies first, data last, so partial
   application produces something useful.

Skills: `composing-functions`, `designing-workflow-pipelines`,
`parameterizing-dependencies`.

## Errors

1. An error a caller must handle belongs in the return type, named in
   the domain's words.
2. Short-circuit sequential steps; accumulate independent ones.
3. Before handling an error, try to define it out of existence, mask it
   where the recovery is universal, or aggregate the handling at the
   edge.
4. Crash on conditions that mean the program is wrong.
5. Convert foreign failures once, at the boundary.

Skills: `handling-errors-with-results`,
`defining-errors-out-of-existence`.

## Effects and state

1. All I/O at the edges; the core computes decisions from values.
2. The core returns what happened; the shell performs it.
3. Time, randomness, and identifier generation are effects.
4. Transform, never mutate. Keep the one mutable cell at the edge and
   replace its value atomically.
5. Domain types are not wire types or storage types. Parse inward,
   serialise outward, in one place per boundary.

Skills: `separating-pure-core-from-shell`, `managing-state-immutably`,
`crossing-io-boundaries`.

## Mechanics

1. A loop with an accumulator is a fold. Give every recursive type its
   fold and consume it through that.
2. Know whether your language eliminates tail calls; if not, use an
   accumulator loop or a trampoline.
3. Use laziness for size, not for style, and force at the boundary.
4. Most design patterns are a function, a function type, or a choice
   type here.

Skills: `folding-over-data`, `using-recursion-and-laziness`,
`translating-gof-patterns`.

## Reliability, once effects cross a process

Design rules stop being enough once an effect can be retried,
duplicated, or lost.

1. Give every command an identity the caller controls, and carry it into
   every effect.
2. Make the effect idempotent, not the decision. The core already is.
3. Assume at-least-once delivery and de-duplicate on receipt.
4. Never write state and publish an event in two transactions.
5. Retry at the shell, bounded in attempts and in total time.
6. Compensate with a named business operation; do not lock across
   systems.
7. Model partial success explicitly; it is a report, not a `Result`.

Skill: `making-effects-reliable`.

## Observability, as a design decision

The same idea as deciding what matters, applied to what a running system
reveals.

1. Write the questions the system must answer before choosing fields.
2. The events a workflow returns are the observability primitive.
3. Log once, at the edge; correlate with an identifier created there.
4. Structured errors are already structured records; do not flatten
   them.
5. Keep identifiers out of metric labels and secrets out of everything.
6. Alert on what a user would notice, not on a resource number.

Skill: `designing-what-to-observe`.

## Communication

1. A name should distinguish this thing from everything nearby. Being
   unable to name something is a design finding.
2. A comment must contain what the code cannot say. Write the interface
   comment before the implementation.
3. Similar things look similar; different things look different.

Skills: `choosing-precise-names`, `writing-useful-comments`,
`programming-strategically`.

## Verification

1. Test the core with plain values. A rule that needs infrastructure to
   test is in the wrong place.
2. Stub capabilities with functions, not with a mocking framework.
3. Assert on returned values, never on which functions were called.
4. Audit against the red flags before calling anything done.

Skills: `testing-functional-code`, `reviewing-functional-design`.
