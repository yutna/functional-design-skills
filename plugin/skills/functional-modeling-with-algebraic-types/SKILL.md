---
name: functional-modeling-with-algebraic-types
description: Use when designing domain types, when a record has many optional fields, or when choosing between a record, a union, and a bare primitive.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
---

# Modeling With Algebraic Types

## Overview

Two combinators build every domain model. A **product type** holds
several values at once: this AND that. A **sum type**, also called a
choice or union, holds exactly one of several alternatives: this OR that.
Everything else, including generics and recursion, is composition of
those two.

Most modelling mistakes are the same mistake: using AND where the domain
means OR. A record with four optional fields, three of which are set only
in particular combinations, is a choice type written badly, and every
consumer pays for it in checks that the compiler cannot verify.

## When to use

- Designing any domain type
- A record has optional fields whose presence depends on each other
- Choosing between a boolean, an enum, and a union with data
- A type's documentation explains which fields apply when
- Reviewing types before the implementation is written

Not for: enforcing value ranges on a single primitive, which is
[functional-constraining-primitive-values](../functional-constraining-primitive-values/SKILL.md).

## Core rules

1. Default. **Say AND with a record, OR with a choice.** Read the requirement
   aloud. Every "or" in the sentence is a case; every "and" is a field. An
   "optionally" is neither: a field that may be absent whatever the others hold
   stays an `Option` field, and only optional fields whose presence depends on
   each other become cases.
2. Rule. **Attach data to the case that owns it.** A field that is meaningful
   only in one state belongs inside that state's case, not beside it.
3. Default. **Replace booleans that mean something.** A boolean carries one bit
   and no name. A two-case choice type carries a name, and can grow data. A
   boolean means something when other fields make sense under only one of its
   values, or when it sits beside flags that depend on it. One that passes
   neither test stays a boolean, whether it records a plain fact, as `isWalkIn`
   does, or is the answer of a predicate.
4. Rule. **Match exhaustively.** Name every case, and let no arm return a
   value for a case it does not name, so adding a case produces a list of
   places to think about. A last arm that crashes on an unknown tag
   returns nothing, so it is outside this rule. A table over a pair of
   choices, such as a state and a command, may give every pair it does not
   list one refusal that the caller sees; what it may not do is treat an
   unlisted pair as some other case, or pass over it in silence.
5. Default. **Compose, do not flatten.** Build big types from small named ones.
   `Booking` holding `PatientInfo` and `ClinicLocation` reads better and changes
   better than twenty fields in a row. A transfer type is outside this: it stays
   as flat as the wire or the table it mirrors.
6. Rule. **Name every case and every field in the domain's words.** The type is
   the documentation; see
   [functional-capturing-the-domain](../functional-capturing-the-domain/SKILL.md).
7. Default. **Prefer a type over a comment.** If the comment explains which
   fields are valid together, the type is wrong. A constraint whose answer is
   not in the value, because it depends on the time, on another system or on a
   record stored somewhere else, cannot be put in the value's type; it is
   checked, and said in a comment on the interface.
   [when-to-validate-instead.md](../functional-making-illegal-states-unrepresentable/references/when-to-validate-instead.md)
   lists those cases.

## Pattern

AND where the domain means OR:

```text
type Payment = {
  method: String,               -- "cash" | "card" | "transfer"
  cardNumber: Option<String>,   -- only for card
  cardExpiry: Option<String>,   -- only for card
  bankCode: Option<String>,     -- only for transfer
  transferRef: Option<String>,  -- only for transfer
}
```

This type can represent a cash payment with a bank code, a card payment
with no number, and a transfer with a card expiry. Every consumer must
check combinations, and no consumer can be sure it checked them all.

The same domain as OR:

```text
type Payment =
  | Cash
  | Card of { number: CardNumber, expiry: ExpiryDate }
  | Transfer of { bank: BankCode, reference: TransferRef }
```

Sixteen combinations of present and absent fields become three shapes.
Every field is present exactly when it applies, no consumer checks
anything, and the compiler or the test suite enumerates the cases when
a fourth method appears. The count with the values included is in
[type-algebra.md](references/type-algebra.md).

## Composition

```text
-- small named pieces
type PersonalName = { first: FirstName, last: LastName }
type Contact = Email of EmailAddress | Phone of PhoneNumber
            | Both of { email: EmailAddress, phone: PhoneNumber }

-- composed, still readable at a glance
type Patient = { name: PersonalName, contact: Contact }
```

`Both` exists because the domain has three states, not two optional
fields. Reading the type answers "can a patient have neither?" without
opening a single function.

## Quick reference

| Requirement wording            | Type                       |
| ------------------------------ | -------------------------- |
| "an X and a Y"                 | Record with two fields     |
| "an X or a Y"                  | Choice with two cases      |
| "an X, optionally a Y"         | Record, `Option<Y>` field  |
| "zero or more X"               | `List<X>`                  |
| "one or more X"                | `NonEmptyList<X>`          |
| "either succeeds or fails"     | `Result<T, E>`             |
| "one of a fixed set of labels" | Choice with no payloads    |
| "a label, some carry data"     | Choice with mixed payloads |
| "an X, but a special kind"     | Single-case wrapper        |

## Static and dynamic languages

The design is the same in both; only the enforcement differs.

- **Statically typed**: the compiler checks construction and matching.
  Turn on exhaustiveness checking and treat its warnings as errors.
- **Dynamically typed**: the shape is still the design. Represent a
  choice as a tagged value with one agreed tag field, build values only
  through constructor functions, and add a test that asserts every case
  is handled where it matters. See
  [static-and-dynamic.md](references/static-and-dynamic.md).

A dynamic language loses the compiler's help, not the design's benefit. A
tagged union with constructors and exhaustive dispatch still removes the
illegal combinations from the code that matters.

## Red flags

- Two or more optional fields whose presence is correlated
- A comment listing which fields apply in which case
- A `type` or `kind` string field, in a language that has a choice type
- A boolean whose name needs a comment to explain
- Consumers that check a field before reading another field
- A wildcard case in a match over a domain type
- A domain type with more than about seven fields and no grouping

## Common mistakes

- **Modelling the storage shape.** Databases have columns and nulls;
  domains have alternatives. Map between them at the edge.
- **Reaching for inheritance for the OR case.** A closed set of
  alternatives is a choice type, not a hierarchy.
- **Adding a case "just in case".** Cases nobody constructs still must be
  handled by everyone.
- **Flattening for convenience at one call site.** One caller's
  convenience costs every other caller a check.
- **Using a wildcard to silence exhaustiveness.** That is disabling the
  one mechanism that finds the places to update.

## Related skills

- [functional-making-illegal-states-unrepresentable](../functional-making-illegal-states-unrepresentable/SKILL.md)
- [functional-constraining-primitive-values](../functional-constraining-primitive-values/SKILL.md)
- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-folding-over-data](../functional-folding-over-data/SKILL.md)
- [functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md)

## Further reading

- [type-algebra.md](references/type-algebra.md) shows how counting the
  states a type can hold turns modelling into arithmetic.
- [static-and-dynamic.md](references/static-and-dynamic.md) carries the
  same designs into languages without a compiler to check them.

This skill answers **which** type to use. For whether a shape should be
a type at all, see
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md).
