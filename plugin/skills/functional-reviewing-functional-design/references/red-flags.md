# Red Flag Catalogue

Each flag: how to detect it, what it costs, the rank it takes in the
ranking in [SKILL.md](../SKILL.md#ranking-findings), and the repair. A
flag is recorded at a place; it becomes a finding when its cost is stated
for that place or evidence is given.

## Contents

- [Structural flags](#structural-flags)
- [Modelling flags](#modelling-flags)
- [Contract flags](#contract-flags)
- [Communication flags](#communication-flags)

## Structural flags

### Shallow module

**Detect.** The export list is nearly as long as the file. Exports map
one-to-one onto internal steps. Callers must combine several exports to
achieve anything.

**Costs.** Every caller learns the internals; the boundary buys nothing.

**Rank.** 5.

**Repair.** Merge into the caller, or find the abstraction it is trying
to be. See
[functional-designing-deep-modules](../../functional-designing-deep-modules/SKILL.md).

### Information leakage

**Detect.** The same fact, such as a literal, format, regular
expression, or business threshold, is written in two places, and the two
would need the same edit. Two rules that happen to agree would be edited
separately, and are not this flag. Two modules that change together in
most of the same commits are the same finding; count them from the
history.

**Costs.** One decision has several owners, and they drift. Change
amplification, then divergence.

**Rank.** 2.

**Repair.** One owner exports a parsed type or a decision function. See
[functional-hiding-information](../../functional-hiding-information/SKILL.md)
and
[decision-criteria.md](../../functional-splitting-and-joining-code/references/decision-criteria.md).

### Temporal decomposition

**Detect.** Modules named for stages: `parse`, `enrich`, `send`,
`preprocess`. A past commit that reordered the steps edited every stage
module; the history shows it.

**Costs.** Format and rule knowledge is spread across the stages.

**Rank.** 2.

**Repair.** Group by knowledge; keep the sequence in one workflow
function. See
[temporal-decomposition.md](../../functional-hiding-information/references/temporal-decomposition.md).

### Overexposure

**Detect.** A mode flag in a widely used signature. Most call sites pass
the same literal for a parameter that only the rare case cares about;
count them.

**Costs.** Every caller learns a feature most of them never use.

**Rank.** 5.

**Repair.** Two named functions, or a default decided inside. See
[functional-separating-layers](../../functional-separating-layers/SKILL.md).

### Pass-through function

**Detect.** The body is a single call with the same arguments. Following
a call takes four hops before real work.

**Costs.** Interface and indirection for nothing.

**Rank.** 5.

**Repair.** Delete it; let callers call through. Keep it only if it
translates, narrows, or adds a guarantee. See
[layer-smells.md](../../functional-separating-layers/references/layer-smells.md).

### Special-general mixture

**Detect.** A general primitive contains a branch for one caller's case.
A general utility takes a parameter named after one feature.

**Costs.** Everyone reading the general code reads the special case.

**Rank.** 5.

**Repair.** Move the special case outward, beside its caller. See
[functional-splitting-and-joining-code](../../functional-splitting-and-joining-code/SKILL.md).

### Conjoined functions

**Detect.** A helper with one caller that takes five or more parameters
from the caller's scope, or two functions that call each other and are
read together.

**Costs.** The reader holds both plus the mapping between them.

**Rank.** 5.

**Repair.** Rejoin them, then look for the one real boundary.

### Threaded value

**Detect.** A parameter that a function never reads and only hands to the
next function, through two or more calls.

**Costs.** Every signature on the path changes when the value does, and
each one appears to depend on it.

**Rank.** 5.

**Repair.** Pass it only to the function that reads it, or bind it once
where the functions are wired, so the others take a function that
already has it. See
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).

## Modelling flags

### Illegal state representable

**Detect.** Correlated optional fields. A status string beside fields
that only apply to some statuses. A comment listing which fields go
together.

**Costs.** Every consumer checks, or is wrong.

**Rank.** 1.

**Repair.** A choice type with the data attached to each case. See
[functional-making-illegal-states-unrepresentable](../../functional-making-illegal-states-unrepresentable/SKILL.md).

### Primitive obsession

**Detect.** Domain values as `String` or `Integer`. Two adjacent
parameters of the same primitive type. The same format check in two
places.

**Costs.** Transposed arguments, duplicated rules, invisible
constraints.

**Rank.** 1.

**Repair.** A wrapper type per concept with a smart constructor. See
[functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md).

### Anaemic pipeline

**Detect.** Pipeline steps whose input and output types are the same.
Validation repeated in two steps.

**Costs.** No step is protected from receiving unprepared data.

**Rank.** 1.

**Repair.** One stage type per completed step. See
[pipeline-anatomy.md](../../functional-designing-workflow-pipelines/references/pipeline-anatomy.md).

### Status string

**Detect.** Equality comparisons against string literals in more than one
module. This is Information leakage, with its own threshold.

**Costs.** The spelling and the meaning are known in several places.

**Rank.** 2.

**Repair.** A choice type owned by the concept's module, plus exported
predicates. See
[functional-modeling-state-machines](../../functional-modeling-state-machines/SKILL.md).

### Over-modelled value

**Detect.** A single-case wrapper whose constructor and only unwrap sit
inside the same function, or a batch of wrapper types added together with
none appearing in an exported signature.

**Costs.** Paperwork with no guarantee bought. It also trains readers to
skim wrappers, which is how the ones that matter get ignored.

**Rank.** 7.

**Repair.** Inline it. The threshold is in
[functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md);
whether the shape wanted a type at all is in
[functional-choosing-types-or-plain-data](../../functional-choosing-types-or-plain-data/SKILL.md).

### Unparsed generic data

**Detect.** A map, record, or `Json` value reaching a function that makes
a business decision, with no parse between it and the boundary. Key
string literals appearing at more than two call sites is Information
leakage, with its own threshold.

**Costs.** Every reader must guess the shape, and no two guesses agree.
This is the failure the generic route is accused of and the reason it
needs a schema.

**Rank.** 1.

**Repair.** One parse at the boundary returning a distinct type, key
constants in one module, and named accessors. See
[schema-as-data.md](../../functional-choosing-types-or-plain-data/references/schema-as-data.md).

## Contract flags

### Hidden failure

**Detect.** Documentation saying "throws". A `catch` in business logic.
A function returning a value where failure is possible.

**Costs.** Callers cannot see a branch they must handle.

**Rank.** 3.

**Repair.** Return `Result` with a named error type. See
[functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md).

### Hidden effect

**Detect.** A pure-looking signature over a body that reads a clock,
logs, caches, or writes.

**Costs.** Untestable, unsafe to memoise or parallelise, surprising.

**Rank.** 3.

**Repair.** Pass the value in, or return an instruction. See
[functional-separating-pure-core-from-shell](../../functional-separating-pure-core-from-shell/SKILL.md).

### Wide dependency

**Detect.** A parameter whose type has members the function never uses.
A test that needs a mocking framework.

**Costs.** Every consumer depends on everything.

**Rank.** 4.

**Repair.** One function type per capability used. See
[lsp-isp-dip.md](../../functional-applying-solid-functionally/references/lsp-isp-dip.md).

### Inverted dependency direction

**Detect.** A domain module importing a driver, framework, or transport.

**Costs.** The stable part depends on the volatile part;
[functional-separating-layers](../../functional-separating-layers/SKILL.md)
says which is which.

**Rank.** 4.

**Repair.** Declare the function type in the domain; wire at the edge.

## Communication flags

### Comment repeats the code

**Detect.** Deleting the comment loses no information.

**Costs.** Noise to read, and one more thing to keep true.

**Rank.** 6. A comment that contradicts the code ranks 3, because it
misleads.

**Repair.** Delete it, and write what the code cannot say instead. See
[functional-writing-useful-comments](../../functional-writing-useful-comments/SKILL.md).

### Implementation in a doc

**Detect.** An interface comment mentioning an internal algorithm,
helper, or storage mechanism.

**Costs.** Callers depend on what should be free to change.

**Rank.** 5.

**Repair.** Move it into the body.

### Vague name

**Detect.** The name could apply to half the codebase: `data`, `handle`,
`process`, `manager`, `info`.

**Costs.** Every reader opens the body to learn what the thing is.

**Rank.** 6.

**Repair.** Name the concept. See
[functional-choosing-precise-names](../../functional-choosing-precise-names/SKILL.md).

### Hard to pick a name

**Detect.** The best name you can write contains "and" or "or", or is
one of `data`, `info`, `handle`, `process`, `manager`, or the history
shows the thing renamed more than once.

**Costs.** Usually the thing has no single purpose, and readers will not
understand it either. The other cause is a domain word nobody knows yet.

**Rank.** 6.

**Repair.** Find the domain word first, then split it, or delete it.

### Hard to describe

**Detect.** The one-sentence purpose needs "and" between two unrelated
purposes. An "and" between attributes of one thing is fine.

**Costs.** The module has two reasons to change.

**Rank.** 5.

**Repair.** Split along the "and". See
[functional-splitting-and-joining-code](../../functional-splitting-and-joining-code/SKILL.md).

### Non-obvious code

**Detect.** A reader who is competent, fluent in the language and the
domain, and new to this code stumbles. Their stumble is the measurement,
not their skill.
[working-alone.md](../../functional-design/references/working-alone.md)
says who that reader is; with none, leave this flag unrecorded and say
so.

**Costs.** Every later reader pays for the same stumble.

**Rank.** 6.

**Repair.** A better name, a type, or a comment saying why, in that order
of preference. See
[functional-deciding-what-matters](../../functional-deciding-what-matters/SKILL.md).
