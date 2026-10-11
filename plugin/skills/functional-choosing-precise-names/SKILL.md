---
name: functional-choosing-precise-names
description: Use when naming a function, type or variable, when a name is vague like data or handle, or when a name is generic or unusually hard to pick.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.1.0
---

# Choosing Precise Names

## Overview

A name is the highest-bandwidth documentation there is: it appears at
every use, costs nothing to read, and cannot be skipped. A precise name
creates an image in the reader's mind of what the thing is; a vague one
forces them to open the implementation.

Naming is also a design tool. A name that is hard to choose is usually
telling you the thing has no clear purpose, and that is a design problem
discovered cheaply. First check that the domain has no word you do not
know.

## When to use

- Naming anything: a function, a type, a field, a parameter
- A review comment asks what something is
- A name needs a comment beside it to be understood
- Struggling to name something, which is the important case

Not for: deciding what to comment, which is
[functional-writing-useful-comments](../functional-writing-useful-comments/SKILL.md).

## Core rules

1. Default. **Be precise, not general.** A name should distinguish this thing
   from everything nearby. `blockCount` beats `count`; `remainingBytes` beats
   `size`.
2. Default. **Name the concept, not the shape.** `pendingInvoices` beats
   `invoiceList`. The reader can see it is a list.
3. Default. **One word per concept, everywhere.** Use one verb for one kind of
   retrieval and one noun for one concept. Two words are allowed when they
   name different kinds of retrieval, and the table in
   [naming-rules.md](references/naming-rules.md) fixes which is which.
4. Default. **Do not encode the type or the module.** `bookingService.bookingSave`
   repeats the noun and adds a type suffix, two redundancies; `Booking.save`
   says it once. In a flat module the function name has to carry the noun, so
   keep `saveBooking` and drop the rest.
5. Default. **Name what it returns, not what it does inside.** `bookingTotal`,
   not `calculateAndCacheTotal`. A pure function that only returns a value may
   be named for it, as a noun.
6. Default. **Say what a boolean is true of.** `isExpired`,
   `hasUnpaidTreatments`. The names to avoid are listed in
   [naming-rules.md](references/naming-rules.md).
7. Judgement. **Treat difficulty as a signal.** First check whether the domain
   has a word you do not know; if it has, use it. If not, the thing is doing two
   jobs or has no clear identity. Fix that instead of settling.

## Pattern

Vague names, requiring the implementation to be read:

```text
process : Data -> Result
handle : Item -> Boolean
check (x, y)
```

Precise names, readable at the call site:

```text
priceBooking :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, PricingError>
isEligibleForRefund : BookedTreatment -> Boolean
isWithinCreditLimit : Money -> CreditLimit -> Boolean
```

The signature and the name together say enough that the body is never
opened out of confusion.

## The test

Write the sentence you would use to explain the thing. If the sentence
contains a word that is not in the name and cannot be inferred, the name
is missing information.

A second test needs a reader who has not seen the code. Give them only
the name and its signature, and ask what it holds or what it does;
[working-alone.md](../functional-design/references/working-alone.md)
says who that reader is. If they are wrong, or vague, the name is wrong.
Do not explain the name to them; their first reading is the measurement.

## Common vague names and their repairs

| Vague          | Ask                             |
| -------------- | ------------------------------- |
| `data`, `info` | What information, specifically? |
| `manager`      | What does it decide?            |
| `handle`       | Handle it how, and to what end? |
| `process`      | Transform it into what?         |
| `helper`       | Whose job is it doing?          |
| `util`         | What concept do these share?    |
| `temp`         | What does it hold right now?    |
| `result`       | The result of what, as what?    |
| `value`        | The value of which quantity?    |
| `item`         | An item of what collection?     |
| `context`      | Which specific values, and why? |

More rules, including length and consistency, in
[naming-rules.md](references/naming-rules.md).

## When a name will not come

This is valuable information. Work through it in this order:

1. **Missing domain word.** Look for the word in the repository's docs,
   tests and tickets; if it is not there, ask the user. Often the
   business has a word nobody wrote down. See
   [functional-capturing-the-domain](../functional-capturing-the-domain/SKILL.md).
2. **Two jobs.** Try to name each half. If both names come easily, split
   it. See
   [functional-splitting-and-joining-code](../functional-splitting-and-joining-code/SKILL.md).
3. **Wrong abstraction.** The thing is a bag of steps rather than a
   concept. Look for the concept the domain has a word for.
4. **It should not exist.** A pass-through, an accidental split, a
   premature abstraction. Delete it and inline.

Never settle for `doStuff2`. Naming difficulty is the cheapest design
feedback available, and ignoring it is throwing it away.

## Red flags

- A name with a counter in it (`list2`, `doStuff2`); a version suffix on a
  transfer type is not one
- A name that needs a comment on the same line to be understood
- Two names for the same concept in one codebase
- A name that describes the implementation, not the meaning
- A variable reused for two purposes under one name
- Any name that could apply to half the codebase
- Abbreviations that are not universal in the domain

## Common mistakes

- **Short names for wide scopes.** Length follows scope, as the table in
  [naming-rules.md](references/naming-rules.md) sets out; an exported
  function's parameter is fully precise.
- **Long names as a substitute for design.**
  `validateAndNormaliseAndSaveBooking` names three jobs; split them.
- **Domain words used loosely.** If the business distinguishes "quote"
  from "estimate", the code must too.
- **Renaming without changing the concept.** A rename that does not make
  the thing clearer is churn.
- **Keeping a bad convention in one corner.** Change it everywhere in one
  commit, or keep it everywhere and write down why.

## Related skills

- [functional-writing-useful-comments](../functional-writing-useful-comments/SKILL.md)
- [functional-deciding-what-matters](../functional-deciding-what-matters/SKILL.md)
- [functional-capturing-the-domain](../functional-capturing-the-domain/SKILL.md)
- [functional-splitting-and-joining-code](../functional-splitting-and-joining-code/SKILL.md)

## Further reading

- [naming-rules.md](references/naming-rules.md) covers conventions for
  each kind of name, length against scope, and consistency across a
  codebase.
