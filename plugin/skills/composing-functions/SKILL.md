---
name: composing-functions
description: Use when two steps do not fit together, when deciding parameter order, or when a signature is partial rather than total.
---

# Composing Functions

## Overview

Functional design builds behaviour by connecting small functions, and
connecting them works only when each one is **total**: for every input of
the declared type it produces an output of the declared type, with no
exception, no null, and no hidden condition. Totality is what makes
composition safe; without it every join is a place where the chain can
silently break.

The rest is mechanics: composition, pipes, currying, and partial
application. They are worth knowing precisely, because they are how
dependencies are supplied and how pipelines are assembled.

## When to use

- Two functions almost fit but not quite
- Deciding the order of a function's parameters
- A function throws for some inputs, or returns null
- Building a pipeline out of existing functions
- Wondering whether to pass a value or a function

Not for: designing the domain types themselves.

## Core rules

1. **Make every function total.** Narrow the input type, or widen the
   output type to `Option` or `Result`. Never leave the gap implicit.
2. **One input, one output, conceptually.** Group related parameters into
   a named record rather than passing six positional arguments.
3. **Put the varying argument last.** Data last, configuration and
   dependencies first, so partial application produces a useful function.
4. **Name the composed function.** A pipeline assigned to a name that
   states the business process beats a long anonymous chain.
5. **Prefer explicit parameters to captured context.** A closure over
   module state is a hidden input.
6. **Stop before the chain becomes unreadable.** Point-free style is a
   tool, not a goal; a named intermediate value is often clearer.
7. **Match the shapes before composing.** Lift pure into fallible, and
   fallible into asynchronous, deliberately.

## Totality

```text
-- not total: throws for zero, and the type does not say so
divide : Integer -> Integer -> Integer

-- total by narrowing the input
divide : Integer -> NonZeroInteger -> Integer

-- total by widening the output
divide : Integer -> Integer -> Result<Integer, DivideByZero>
```

Prefer narrowing when the caller can reasonably produce the narrower
type, because it removes the failure entirely. Prefer widening when the
value comes from outside and can genuinely be wrong.

The three ways a function is secretly partial:

| Secret partiality      | Repair                                 |
| ---------------------- | -------------------------------------- |
| Throws an exception    | Return `Result`                        |
| Returns null           | Return `Option`                        |
| Returns a wrong answer | Narrow the input type so it cannot     |
| Loops forever          | Bound the input, or return a step type |

## Composition and piping

```text
-- compose: build a function from functions
processName = trim >> toTitleCase >> abbreviate

-- pipe: push a value through
result = rawName |> trim |> toTitleCase |> abbreviate
```

Use composition when defining a reusable function, and piping when
transforming a value at hand. Composition of fallible functions needs a
different operator, because `Result<B, E>` does not fit an input of `B`:

```text
confirmBooking = validate >=> price >=> acknowledge
```

See
[handling-errors-with-results](../handling-errors-with-results/SKILL.md).

## Currying and partial application

Every multi-argument function can be seen as a chain of one-argument
functions. That is what makes partial application possible, and partial
application is how dependencies are supplied.

```text
priceBooking : GetTreatmentPrice -> ValidatedBooking -> PricedBooking

-- apply the dependency once, at wiring time
priceWithCatalogue = priceBooking (lookupIn catalogue)

-- the result is exactly the shape the pipeline wants
pipeline = validate >=> priceWithCatalogue >=> acknowledge
```

This is why parameter order matters: dependencies first, data last. With
the order reversed, partial application produces nothing useful and the
pipeline needs a wrapper at every step.

## Functions as values

A function type is the smallest possible interface, and passing one is
the simplest way to make behaviour vary.

```text
alias Comparator = Treatment -> Treatment -> Ordering
sortTreatments : Comparator -> List<Treatment> -> List<Treatment>
```

Name the function type when it means something in the domain
(`GetTreatmentPrice`), and leave it inline when it is generic
(`A -> Boolean`).

## Red flags

- A function whose documentation says "throws if..."
- A parameter list where two adjacent parameters share a type
- A composed chain longer than about four steps with no names
- A function that takes a boolean to select behaviour
- A helper that exists only to reorder another function's arguments
- Point-free code that the author had to explain in review

## Common mistakes

- **Composing partial functions.** One `null` in the middle and the chain
  fails somewhere unrelated. Fix totality first, then compose.
- **Configuration last.** Then partial application is useless and every
  call site repeats the same dependency arguments.
- **Chasing point-free style.** Readability is the objective; an
  intermediate name is not a defect.
- **Very long parameter lists.** Beyond about four, group into a record
  and gain names at every call site.
- **Hiding a dependency in a closure.** A captured database handle is a
  parameter that the signature refuses to admit.

## Related skills

- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [folding-over-data](../folding-over-data/SKILL.md)

## Further reading

- [totality.md](references/totality.md) is the procedure for making a
  function total, with the trade-off between narrowing and widening.
- [composition-toolkit.md](references/composition-toolkit.md) lists the
  operators for connecting mismatched shapes, with when to use each.
