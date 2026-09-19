# Two Ways to Represent Data

Where the type-first and data-first positions agree, where they genuinely
conflict, and what each one is actually optimising for.

Knowing exactly where the conflict sits is what lets you decide per value
instead of per doctrine. The conflict is narrower than the rhetoric on
either side suggests.

## What each side is optimising for

**Type-first** optimises for the mistake that cannot be made. Give every
concept a distinct type, put its rules in the constructor, and a whole
class of error stops compiling. The cost is a wall: generic operations
stop at each type, and every new operation over "any value" needs
per-type code.

**Data-first** optimises for the operation that works on everything. Keep
data as maps and lists, keep the schema outside the data as a separate
value, and a projection, a structural diff, a deep merge, a serialiser or
an audit log is written once and works on every shape. The cost is that
nothing stops a caller passing the wrong map, and no name in the codebase
says what a key means.

Both costs are real. This pack defaults to type-first and names the
exceptions, rather than pretending the wall is free.

## Where they agree

Three things, and they are not the trivial ones.

**Data is inert.** Behaviour lives in functions that take data and return
data. No methods attached to values, no object that owns its own rules.
This pack already requires it everywhere: see
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md)
and
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

A single-case wrapper does not violate this. `BookingId of String`
attaches no behaviour; it attaches a name, and its constructor is a
function like any other.

**Data does not mutate.** Updates produce new values that share
structure. Both positions insist on it, and they arrive independently at
the same concurrency advice: one state reference, updated by comparing and
swapping on a version, with all logic reading immutable snapshots. That is
what
[concurrency.md](../../managing-state-immutably/references/concurrency.md)
already says.

**Untrusted input is parsed once, at the edge.** Not checked repeatedly,
defensively, inward. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Where they conflict

Two points, and both are direct contradictions rather than differences of
emphasis.

**Whether a concept gets its own type.** Type-first says give it one, so
the wrong value cannot be passed. Data-first says do not, because the
type is a wall that stops generic code and forces the reader to accept
one interpretation of the value before they can read it. This is the
direct negation of
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md).

**Whether the rules live in the representation.** Type-first fuses them,
so the check cannot be skipped. Data-first splits them, so the schema
becomes a value you can store in a row, compose, generate, and change
without a deployment. This contradicts
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md),
whose whole method is the fusing.

The trade is explicit on both sides:

| Fusing them (type-first)           | Splitting them (data-first)     |
| ---------------------------------- | ------------------------------- |
| The check cannot be bypassed       | The check can be forgotten      |
| Changing a rule is a deployment    | Changing a rule is a row update |
| One shape per concept              | One validator over many shapes  |
| The reader learns rules from types | The reader must find the schema |
| The compiler proves exhaustiveness | Tests stand in for the compiler |

This pack already crosses that line for one case: a policy that changes
faster than the code should be data, per
[when-to-validate-instead.md](../../making-illegal-states-unrepresentable/references/when-to-validate-instead.md).
The data-first position makes that the general rule rather than the
exception.

## The disagreement is mostly about tooling

Each position is strongest where the other's tooling is weakest, which is
why neither generalises.

Where a distinct type is a runtime construct with no checking behind it,
the wall costs you generic operations and returns almost nothing
enforceable. Tearing it down is straightforwardly correct there, and the
schema has to be a runtime value anyway.

Where a distinct type is free to declare, checked at every use, and proves
exhaustiveness, the wall is nearly free and returns a great deal.

Neither view is wrong about its own setting. Both are wrong when they
generalise. That is why this pack keeps one default and one list of
observable exceptions rather than picking a side per language: real
projects span both, and the same project has values of both kinds.

## What both agree most codebases get wrong

Worth stating on its own, because this is where the agreement is largest
and the practice is worst:

1. Untrusted input is parsed once, at the edge, into something the rest
   of the code trusts.
2. Data does not mutate. Not "mostly", not "except for the cache".
3. Behaviour is not attached to data.
4. Optional fields are not a substitute for representing a choice.

A codebase doing those four is well designed under either view. A codebase
doing none of them is not saved by choosing one.
