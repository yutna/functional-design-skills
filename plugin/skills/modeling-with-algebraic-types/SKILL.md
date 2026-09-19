---
name: modeling-with-algebraic-types
description: Use when designing domain types, when a record has many optional fields, or when choosing between a record, a union, and a bare primitive.
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
[constraining-primitive-values](../constraining-primitive-values/SKILL.md).

## Core rules

1. **Say AND with a record, OR with a choice.** Read the requirement
   aloud. Every "or" in the sentence is a case; every "and" is a field.
2. **Attach data to the case that owns it.** A field that is meaningful
   only in one state belongs inside that state's case, not beside it.
3. **Replace booleans that mean something.** A boolean carries one bit
   and no name. A two-case choice type carries a name, and can grow data.
4. **Match exhaustively.** Every case handled, no wildcard, so adding a
   case produces a list of places to think about.
5. **Compose, do not flatten.** Build big types from small named ones.
   `Booking` holding `CustomerInfo` and `ShippingAddress` reads better and
   changes better than twenty fields in a row.
6. **Name every case and every field in the domain's words.** The type is
   the documentation; see
   [capturing-the-domain](../capturing-the-domain/SKILL.md).
7. **Prefer a type over a comment.** If the comment explains which fields
   are valid together, the type is wrong.

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

Sixteen representable states become three. Every field is present exactly
when it applies, no consumer checks anything, and the compiler or the
test suite enumerates the cases when a fourth method appears.

## Composition

```text
-- small named pieces
type PersonalName = { first: FirstName, last: LastName }
type Contact = Email of EmailAddress | Phone of PhoneNumber
            | Both of { email: EmailAddress, phone: PhoneNumber }

-- composed, still readable at a glance
type Customer = { name: PersonalName, contact: Contact }
```

`Both` exists because the domain has three states, not two optional
fields. Reading the type answers "can a customer have neither?" without
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
- A `type` or `kind` field of type string
- A boolean whose name needs a comment to explain
- Consumers that check a field before reading another field
- A wildcard case in a match over a domain type
- A type with more than about seven fields and no grouping

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

- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [constraining-primitive-values](../constraining-primitive-values/SKILL.md)
- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [folding-over-data](../folding-over-data/SKILL.md)
- [choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md)

## Further reading

- [type-algebra.md](references/type-algebra.md) shows how counting the
  states a type can hold turns modelling into arithmetic.
- [static-and-dynamic.md](references/static-and-dynamic.md) carries the
  same designs into languages without a compiler to check them.

This skill answers **which** type to use. For whether a shape should be
a type at all, see
[choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md).
