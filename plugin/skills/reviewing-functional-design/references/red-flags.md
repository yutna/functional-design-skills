# Red Flag Catalogue

Each flag: how to detect it, what it costs, and the repair.

## Structural flags

### Shallow module

**Detect.** The export list is nearly as long as the file. Exports map
one-to-one onto internal steps. Callers must combine several exports to
achieve anything.

**Costs.** Every caller learns the internals; the boundary buys nothing.

**Repair.** Merge into the caller, or find the abstraction it is trying
to be. See
[designing-deep-modules](../../designing-deep-modules/SKILL.md).

### Information leakage

**Detect.** The same literal, format, regular expression, or business
threshold appears in two modules. Two modules always change together.

**Costs.** One decision has several owners, and they drift.

**Repair.** One owner exports a parsed type or a decision function. See
[hiding-information](../../hiding-information/SKILL.md).

### Temporal decomposition

**Detect.** Modules named for stages: `parse`, `enrich`, `send`,
`preprocess`. Changing the order of steps touches every module.

**Costs.** Format and rule knowledge is spread across the stages.

**Repair.** Group by knowledge; keep the sequence in one workflow
function. See
[temporal-decomposition.md](../../hiding-information/references/temporal-decomposition.md).

### Overexposure

**Detect.** The common case must supply a parameter that only the rare
case cares about. A mode flag in a widely used signature.

**Costs.** Every caller learns a feature most of them never use.

**Repair.** Two named functions, or a default decided inside. See
[separating-layers](../../separating-layers/SKILL.md).

### Pass-through function

**Detect.** The body is a single call with the same arguments. Following
a call takes four hops before real work.

**Costs.** Interface and indirection for nothing.

**Repair.** Delete it; let callers call through. Keep it only if it
translates, narrows, or adds a guarantee. See
[layer-smells.md](../../separating-layers/references/layer-smells.md).

### Repetition

**Detect.** The same fact expressed twice. Not similar-looking code:
the same fact.

**Costs.** Change amplification, then divergence.

**Repair.** One owner for the fact. Check first whether the two would
need the same edit; if not, they are not repetition. See
[decision-criteria.md](../../splitting-and-joining-code/references/decision-criteria.md).

### Special-general mixture

**Detect.** A general primitive contains a branch for one caller's case.
A general utility takes a parameter named after one feature.

**Costs.** Everyone reading the general code reads the special case.

**Repair.** Move the special case outward, beside its caller. See
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

### Conjoined functions

**Detect.** Two functions that cannot be understood apart. An extracted
helper taking six parameters from the parent's scope.

**Costs.** The reader holds both plus the mapping between them.

**Repair.** Rejoin them, then look for the one real boundary.

## Modelling flags

### Illegal state representable

**Detect.** Correlated optional fields. A status string beside fields
that only apply to some statuses. A comment listing which fields go
together.

**Costs.** Every consumer checks, or is wrong.

**Repair.** A choice type with the data attached to each case. See
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md).

### Primitive obsession

**Detect.** Domain values as `String` or `Integer`. Two adjacent
parameters of the same primitive type. The same format check in two
places.

**Costs.** Transposed arguments, duplicated rules, invisible
constraints.

**Repair.** A wrapper type per concept with a smart constructor. See
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md).

### Anaemic pipeline

**Detect.** Pipeline steps whose input and output types are the same.
Validation repeated in two steps.

**Costs.** No step is protected from receiving unprepared data.

**Repair.** One stage type per completed step. See
[pipeline-anatomy.md](../../designing-workflow-pipelines/references/pipeline-anatomy.md).

### Status string

**Detect.** Equality comparisons against string literals in more than one
module.

**Costs.** The spelling and the meaning are known in several places.

**Repair.** A choice type owned by the concept's module, plus exported
predicates. See
[modeling-state-machines](../../modeling-state-machines/SKILL.md).

### Over-modelled value

**Detect.** A single-case wrapper whose constructor and only unwrap sit
inside the same function, or a batch of wrapper types added together with
none appearing in an exported signature.

**Costs.** Paperwork with no guarantee bought. It also trains readers to
skim wrappers, which is how the ones that matter get ignored.

**Repair.** Inline it. The threshold is in
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md);
whether the shape wanted a type at all is in
[choosing-types-or-plain-data](../../choosing-types-or-plain-data/SKILL.md).

### Unparsed generic data

**Detect.** A map, record, or `Json` value reaching a function that makes
a business decision, with no parse between it and the boundary. Key
string literals appearing at more than two call sites is the same
finding.

**Costs.** Every reader must guess the shape, and no two guesses agree.
This is the failure the generic route is accused of and the reason it
needs a schema.

**Repair.** One parse at the boundary returning a distinct type, key
constants in one module, and named accessors. See
[schema-as-data.md](../../choosing-types-or-plain-data/references/schema-as-data.md).

## Contract flags

### Hidden failure

**Detect.** Documentation saying "throws". A `catch` in business logic.
A function returning a value where failure is possible.

**Costs.** Callers cannot see a branch they must handle.

**Repair.** Return `Result` with a named error type. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

### Hidden effect

**Detect.** A pure-looking signature over a body that reads a clock,
logs, caches, or writes.

**Costs.** Untestable, unsafe to memoise or parallelise, surprising.

**Repair.** Pass the capability, or return the intent. See
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

### Wide dependency

**Detect.** A parameter whose type has members the function never uses.
A test that needs a mocking framework.

**Costs.** Every consumer depends on everything.

**Repair.** One function type per capability used. See
[lsp-isp-dip.md](../../applying-solid-functionally/references/lsp-isp-dip.md).

### Inverted dependency direction

**Detect.** A domain module importing a driver, framework, or transport.

**Costs.** The stable part depends on the volatile part.

**Repair.** Declare the function type in the domain; wire at the edge.

## Communication flags

### Comment repeats the code

**Detect.** Deleting the comment loses no information.

**Repair.** Delete it, and write what the code cannot say instead. See
[writing-useful-comments](../../writing-useful-comments/SKILL.md).

### Implementation documentation in an interface comment

**Detect.** An interface comment mentioning an internal algorithm,
helper, or storage mechanism.

**Costs.** Callers depend on what should be free to change.

**Repair.** Move it into the body.

### Vague name

**Detect.** The name could apply to half the codebase: `data`, `handle`,
`process`, `manager`, `info`.

**Repair.** Name the concept. See
[choosing-precise-names](../../choosing-precise-names/SKILL.md).

### Hard to pick a name

**Detect.** You cannot name it after several attempts.

**Costs.** The thing has no single purpose, and readers will not
understand it either.

**Repair.** Split it, find the domain word, or delete it.

### Hard to describe

**Detect.** The one-sentence purpose needs "and".

**Repair.** Split along the "and". See
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

### Non-obvious code

**Detect.** A reader who is competent and unfamiliar stumbles. Their
stumble is the measurement, not their skill.

**Repair.** A better name, a type, or a comment saying why, in that order
of preference. See
[deciding-what-matters](../../deciding-what-matters/SKILL.md).
