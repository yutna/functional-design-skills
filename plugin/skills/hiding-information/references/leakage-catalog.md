# Leakage Catalogue

Each entry: what leaks, how to detect it, and how to repair it. Detection
tests are mechanical; run them on a codebase to find real instances.

## Shared format knowledge

**Leak.** Two or more modules parse, build, or validate the same textual
or binary format.

**Detect.** Search for the same regular expression, delimiter, date
pattern, or field name in more than one module.

**Repair.** One module owns the format and exports a parsed type. Others
receive the parsed type and never see the text.

## Exposed storage or wire shape

**Leak.** A type used inside the domain has the shape of a database row
or an API payload: snake-case keys, nullable columns, string enums,
foreign keys.

**Detect.** Look for domain types whose field names match a table's
columns exactly, or that contain fields no business rule reads.

**Repair.** Two types and a mapping. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Status strings

**Leak.** A status is a string; its spelling and its meaning are known in
several modules.

**Detect.** Grep for equality comparisons against string literals.

**Repair.** A choice type owned by the module that owns the concept, plus
exported predicates for each meaning callers need.

## Leaked error types

**Leak.** A module returns errors from the library it happens to use, so
every caller depends transitively on that library.

**Detect.** Look for library-specific error types or codes in exported
signatures.

**Repair.** Define the module's own error choice type and translate at
the boundary, keeping the original as an opaque cause if needed.

## Pass-through variables

**Leak.** A value is threaded through several functions that do not use
it, only to reach one that does. Every function in the chain now names a
concept it has nothing to do with.

**Detect.** For each parameter, check whether the function body mentions
it other than to pass it on.

**Repair**, in order of preference:

1. Have the caller that has the value call the function that needs it,
   directly, if the chain exists only for delivery.
2. Move the decision that needs the value up to where the value already
   is, so it never travels.
3. Bind the value into the function once, at the edge, using partial
   application, so downstream signatures do not mention it. See
   [parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).
4. Only as a last resort, group related values into a named context type.
   A context object is still leakage, merely tidier; it becomes a place
   where unrelated things accumulate.

## Exported helpers

**Leak.** A function exists to help the module do its job, and is
exported so tests or a neighbour can reach it.

**Detect.** For each export, ask which caller outside the module calls
it. If the only caller is a test, it is a leak.

**Repair.** Test through the interface. If the helper is genuinely
valuable on its own, give it a module and an interface of its own.

## Duplicated business rules

**Leak.** The same threshold, rate, or eligibility rule is implemented in
two places.

**Detect.** Grep for numeric literals that appear more than once, and for
predicates with similar names in different modules.

**Repair.** One module owns the rule as a function. Others call it. Do
not share the constant; share the decision, because the decision is what
will grow conditions later.

## Configuration sprawl

**Leak.** Modules read configuration directly, so each one knows the
config key names and the environment.

**Detect.** Search for environment or config lookups outside the edge.

**Repair.** Read configuration once at the edge, turn it into typed
values, and pass those in.

## Temporal module names

**Leak.** Modules named for stages: `preprocess`, `handle`, `postprocess`.
The order of operations is now part of the structure.

**Detect.** Module names that are verbs in a sequence, or numbered.

**Repair.** See
[temporal-decomposition.md](temporal-decomposition.md).
