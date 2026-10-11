---
name: functional-constraining-primitive-values
description: Use when domain values are raw strings or numbers, when the same format or range check appears in more than one place, or when ids can be swapped.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.1.0
---

# Constraining Primitive Values

## Overview

A domain value is almost never "a string" or "a number". It is a booking
identifier, a percentage between zero and one hundred, a quantity of at
least one, an email address. When those are represented by primitives,
three things follow: the constraints live in prose, any value can be
passed where any other is expected, and the same check appears wherever
someone remembered it.

Wrapping each domain value in its own type, built only through a function
that can reject it, fixes all three at once. This is the cheapest structural
improvement available in most codebases.

## When to use

- A function signature has two or more parameters of the same primitive
- The same format or range check appears in more than one place
- A comment or a schema documents what values are legal
- An identifier is passed as a string across module boundaries
- A number is a quantity, a rate, an amount, or a duration

Not for: values that genuinely are unconstrained free text with no rules.

## Core rules

1. Default. **One type per domain concept**, even when the underlying primitive
   is the same. `PatientId` and `BookingId` are different types.
2. Rule. **A constructor that can reject an input returns `Result`.** The
   constructor is the only place the rule lives. A constructor whose
   parameter type has no invalid value, or that clamps by a rule the domain
   states, returns the value.
3. Rule. **No public raw construction.** If the wrapper can be built directly
   from a primitive anywhere, the type is decoration.
4. Default. **Unwrap late, at the edge.** Inside the domain, pass the wrapper.
   Convert to a primitive only when serialising or displaying.
5. Default. **Put the unit in the type, not in the name.** `Meters`, not
   `distanceInMeters: Float`, so mixing units cannot compile.
6. Rule. **Choose the constraint the business names.** Encode "a quantity is at
   least one", not "an integer between one and 2147483647".
7. Rule. **Keep the rule in one place forever.** When it changes, exactly one
   function changes.

## Pattern

Primitive obsession:

```text
-- what is legal? nothing here says.
bookTreatment : String -> String -> Integer -> Decimal -> Result<...>
-- callers pass (patientId, treatmentCode, quantity, unitPrice)
-- and eventually pass them in the wrong order
```

Constrained values:

```text
type PatientId = PatientId of Uuid
type TreatmentCode = TreatmentCode of String     -- "W" or "G" + 4 digits
type Quantity = Quantity of Integer          -- at least 1
type UnitPrice = UnitPrice of Money          -- at least 0

TreatmentCode.parse : String -> Result<TreatmentCode, TreatmentCodeError>
Quantity.parse : Integer -> Result<Quantity, QuantityError>

bookTreatment :
  PatientId -> TreatmentCode -> Quantity -> UnitPrice
    -> Result<BookedTreatment, BookTreatmentError>
```

In these examples a constrained wrapper's raw constructor is private to
its module, and other code calls the parser, which is named
`TypeName.parse` throughout. Here `BookedTreatment` also carries the
`unitPrice`.

Transposed arguments no longer compile. The legal values are in the
types. The checks happen once, at the edge, and never again.

## What goes in the wrapper

| Concept kind      | Constraint typically encoded            |
| ----------------- | --------------------------------------- |
| Identifier        | Format, and which entity it identifies  |
| Code or reference | Pattern, length, allowed characters     |
| Quantity          | Minimum, maximum, whole numbers only    |
| Money             | Currency, scale, non-negative if so     |
| Percentage        | Range, and whether 1.0 or 100 means all |
| Text field        | Non-empty, maximum length, trimmed      |
| Timestamp         | Zone, and past or future if the domain  |
|                   | says so                                 |
| Measurement       | The unit itself                         |

## Cost and where to stop

Each wrapper costs a type, a constructor, and an unwrap at the edges. It
is worth it when the value crosses a module boundary, appears in more
than one signature, or has a rule worth stating. It is not worth it for a
local intermediate inside one function.

A practical threshold: if the value appears in an exported signature,
wrap it. If it lives and dies inside one function, do not.

There is a second case where the wrapper is the wrong move rather than
merely a poor bargain: a value whose shape is decided by config, by a
tenant, or by an admin has no compile-time set of cases to wrap. See
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md)
for which side of that line a value falls on.

## Red flags

- Two adjacent parameters of the same primitive type
- A regular expression appearing in more than one module
- A magic number that means a limit, repeated
- An identifier logged, stored, and compared as a bare string
- A function that begins by trimming and lower-casing its input
- Arithmetic between two numbers with different units

## Common mistakes

- **Wrapping without constraining.** A wrapper with a public constructor
  that accepts anything gives type safety and no validity. Both are
  worth having; the constructor is what gives the second.
- **Validating in the constructor and again downstream.** If the value
  exists, it is valid. A second check says the first is not trusted.
- **Unwrapping early for convenience.** Once a raw string escapes into
  the domain, everything downstream is back to primitives.
- **Encoding constraints nobody asked for.** A maximum length invented by
  the developer becomes a production incident when the business changes.
- **Making equality do too much.** If `EmailAddress` compares
  case-insensitively, normalise at construction instead, so equality
  stays obvious.

## Related skills

- [functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
- [functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)
- [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md)

## Further reading

- [smart-constructors.md](references/smart-constructors.md) is why a
  constructor returns a value rather than a verdict, and the shape of
  one, including normalisation and error design.
- [units-and-measures.md](references/units-and-measures.md) covers
  quantities, money, and the arithmetic that units make safe.
