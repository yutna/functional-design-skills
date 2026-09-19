# Spotting What to Fix

Symptoms worth looking for, arranged by **what each one costs you** rather
than by what it looks like. The cost is the finding; the appearance is
only the prompt.

The three costs are the ones in
[functional-diagnosing-complexity](../../functional-diagnosing-complexity/SKILL.md):
one change becoming many, a reader having to hold too much, and a reader
not being able to tell what they must know. Naming which cost a symptom
carries is what turns "this looks wrong" into something worth acting on.

Read the last two sections before using the list.

## Contents

- [Symptoms that multiply one change](#symptoms-that-multiply-one-change)
- [Symptoms that raise what a reader must hold](#symptoms-that-raise-what-a-reader-must-hold)
- [Symptoms that hide what a reader must know](#symptoms-that-hide-what-a-reader-must-know)
- [Symptoms that only look like symptoms here](#symptoms-that-only-look-like-symptoms-here)
- [Using a symptom](#using-a-symptom)

## Symptoms that multiply one change

- The same fact written down twice -> [functional-splitting-and-joining-code](../../functional-splitting-and-joining-code/SKILL.md)
- One change edits many files -> [functional-diagnosing-complexity](../../functional-diagnosing-complexity/SKILL.md)
- One module edited for two reasons -> [functional-designing-deep-modules](../../functional-designing-deep-modules/SKILL.md)
- One rule enforced in two modules -> [functional-hiding-information](../../functional-hiding-information/SKILL.md)
- A wire shape repeated inward -> [functional-crossing-io-boundaries](../../functional-crossing-io-boundaries/SKILL.md)
- A status string spelled out -> [functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md)

The test for all six: count the places a single decision is written down.
More than one is the finding, whatever it looks like.

## Symptoms that raise what a reader must hold

- Values that always travel together -> [functional-modeling-with-algebraic-types](../../functional-modeling-with-algebraic-types/SKILL.md)
- A field set and read only once -> [functional-modeling-state-machines](../../functional-modeling-state-machines/SKILL.md)
- A function that computes and changes -> [functional-separating-pure-core-from-shell](../../functional-separating-pure-core-from-shell/SKILL.md)
- A boolean parameter selects behaviour -> [functional-splitting-and-joining-code](../../functional-splitting-and-joining-code/SKILL.md)
- A local reassigned for two purposes -> [functional-managing-state-immutably](../../functional-managing-state-immutably/SKILL.md)
- A field kept in step by hand -> [functional-diagnosing-complexity](../../functional-diagnosing-complexity/SKILL.md)
- A required call order the types allow -> [functional-modeling-state-machines](../../functional-modeling-state-machines/SKILL.md)

The boolean parameter is the strongest single signal here. A flag chosen
by the caller to select behaviour is two functions that were merged, every
time.

The last two are usually **accidental** rather than badly arranged: check
whether the field or the ordering should exist at all before moving it.
See
[essential-and-accidental.md](../../functional-diagnosing-complexity/references/essential-and-accidental.md).

## Symptoms that hide what a reader must know

- A name that fits half the code -> [functional-choosing-precise-names](../../functional-choosing-precise-names/SKILL.md)
- It throws and the type is silent -> [functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md)
- It touches the world silently -> [functional-separating-pure-core-from-shell](../../functional-separating-pure-core-from-shell/SKILL.md)
- Shared mutable data -> [functional-managing-state-immutably](../../functional-managing-state-immutably/SKILL.md)
- A caller navigating `a.b.c.d` -> [functional-designing-deep-modules](../../functional-designing-deep-modules/SKILL.md)
- Two modules using each other's guts -> [functional-hiding-information](../../functional-hiding-information/SKILL.md)
- Domain values as raw primitives -> [functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md)
- A module whose functions forward -> [functional-separating-layers](../../functional-separating-layers/SKILL.md)
- Machinery nobody asked for -> [functional-programming-strategically](../../functional-programming-strategically/SKILL.md)
- A comment restating the code -> [functional-writing-useful-comments](../../functional-writing-useful-comments/SKILL.md)

This is the worst of the three costs, because there is no point at which
a reader can stop looking. Everything here is information that is
required and not visible in the interface.

## Symptoms that only look like symptoms here

The section that matters most if you arrive with a list written for
object-oriented code. Four items on every such list are **not** defects
in a functional design, and treating them as defects pushes the design
the wrong way.

| Looks like a defect            | Here                          |
| ------------------------------ | ----------------------------- |
| A record of fields, no methods | The intended shape            |
| A loop                         | Only a defect when it mutates |
| The same match in many places  | Usually the correct trade-off |
| A type refusing part of a base | Cannot occur; no inheritance  |

**A record of fields with no behaviour.** The usual advice is to move
behaviour into it until it stops being a bag of fields. That is the exact
opposite of how this pack works: data is inert, and behaviour lives in
functions over it. A record with a smart constructor and no methods is a
correct functional type. Do not "fix" it.

What is worth checking instead: can the record only be built through a
constructor that enforces its invariants, and can it hold a combination
the business forbids? Those are real findings. See
[functional-making-illegal-states-unrepresentable](../../functional-making-illegal-states-unrepresentable/SKILL.md).

**A loop.** Iteration is not the defect. Accumulating into a mutable
variable is, because it hides what is being computed. A loop whose body
performs no mutation is merely less clear than the fold it could be.
Rewrite for clarity, not because a loop appeared. See
[functional-folding-over-data](../../functional-folding-over-data/SKILL.md).

**The same match repeated across functions.** The usual advice is to push
each case into a subclass so the dispatch happens once. In a functional
design the same set of cases is matched in every function that consumes
the sum type, and that is the deliberate trade: adding a case forces you
to visit every consumer, and the compiler names them all. That is the
feature. Reach for a single dispatch table only when the set of **cases**
changes more often than the set of **operations**. See
[functional-translating-gof-patterns](../../functional-translating-gof-patterns/SKILL.md).

**A type refusing part of what it inherits** has no functional equivalent,
because there is nothing to inherit. Where its shape appears, the real
finding is a sum type whose cases do not belong together. Two functions
doing the same job through different names is the same kind of residue.

## Using a symptom

Four rules, in order.

1. **Ask whether the code should exist at all.** If the requirement,
   stated in the domain's words, never mentions it, delete it rather than
   moving it. Refactoring accidental complexity is how it becomes
   permanent.
2. **Name the cost before the fix.** "This function is long" is not a
   finding. "A reader must hold four intermediate values to follow it" is.
3. **Check the symptom applies here.** Four of the items above do not, and
   using them anyway makes the design worse.
4. **One move at a time, tests green between each.** The strategic moves
   are in [migration-moves.md](migration-moves.md); the tactical ones in
   [tactical-moves.md](tactical-moves.md).

A symptom is a prompt to look. It is never, on its own, a reason to change
code.
