---
name: deciding-what-matters
description: Use when code is correct but hard to follow, when deciding what an interface should expose, or when a reader cannot tell which parts are important.
---

# Deciding What Matters

## Overview

Design is the act of deciding which information matters and making it
prominent, while making everything that does not matter invisible. Those
two halves are one job: every fact you leave visible competes for the
reader's attention with the facts that actually govern behaviour.

Code is obvious when a reader understands it quickly, correctly, and
without conscious effort. Obviousness is a property of the reader, not
the author, so it cannot be judged from the inside.

## When to use

- Choosing what a module exports
- A reviewer says "this is correct but I had to read it three times"
- A function is short and still hard to follow
- Deciding whether a detail belongs in a name, a type, or a comment
- Naming and documenting a workflow's steps

Not for: deciding module boundaries, which is
[designing-deep-modules](../designing-deep-modules/SKILL.md).

## Core rules

1. **Decide what matters, explicitly.** For each module, list the facts a
   caller must know. That list is the interface. Everything else is
   implementation and must not be visible.
2. **Make what matters unmissable.** Put it in the type first, the name
   second, the doc comment third. Never only in prose far from use.
3. **Make what does not matter invisible.** Not merely unimportant-
   looking: absent. An exported helper nobody should call still costs
   attention every time someone reads the module's exports.
4. **Judge obviousness from outside.** You cannot assess your own code's
   obviousness. If a reader stumbled, the code is not obvious, and their
   confusion is the measurement, not their skill.
5. **Give the reader the information where they need it.** A fact needed
   at a call site belongs in the signature, not in the implementation.
6. **Prefer explicit over inferred.** If a reader must derive a fact by
   reasoning about three other facts, state it.

## Pattern

The same computation, unfocused and focused.

```text
-- unfocused: nine visible names, no hint which matter
export parse, normalise, TAX_TABLE, applyTax, roundHalfUp,
       Currency, convert, DEFAULT_RATE, priceBooking
```

A reader cannot tell that only `priceBooking` and `Currency` are meant for
them. Every other name is a question they must answer before they dare
call anything.

```text
-- focused: the two facts that matter, the rest hidden
export priceBooking, Currency

priceBooking : PricedBookingInput -> Result<PricedBooking, PricingError>
```

Now the interface states what matters: one entry point, one type in its
signature, one failure type. The tax table, rounding rule and conversion
are implementation, and a change to any of them cannot reach a caller.

## What matters, in order

| Rank | Kind of information               | Where it belongs      |
| ---- | --------------------------------- | --------------------- |
| 1    | What the function produces        | Return type and name  |
| 2    | What it requires of its inputs    | Parameter types       |
| 3    | How it can fail                   | Error type in result  |
| 4    | What it affects outside itself    | Effect in the type    |
| 5    | Why a non-obvious choice was made | Comment at the choice |
| 6    | How it does the work              | Nowhere; it is hidden |

Anything you cannot place in rows one to four, and that a caller needs,
is the reason comments exist. Anything a caller does not need should not
be reachable.

## Things that destroy obviousness

- **Event-driven flow.** Nothing shows what runs next. Compensate by
  documenting, at the registration site, what handles the event.
- **Generic containers.** A pair or a tuple of maps says nothing about
  what its parts mean. Name the type.
- **Different types, same declaration.** Two values that look alike and
  behave differently. Make them look different.
- **Behaviour that violates the reader's expectation.** A `get` that
  writes, a `validate` that mutates. Rename or restructure.
- **Implicit ordering.** Two calls that must happen in sequence with
  nothing to say so.
- **Long parameter lists of the same type.** Three strings in a row will
  be transposed eventually.

## Red flags

- The module exports more than a reader could hold in their head
- A caller must read the implementation to know what to pass
- The important thing is stated only in a comment far from the code
- "Correct but hard to follow" appears in a review
- Removing an exported name breaks nothing, and nobody noticed

## Common mistakes

- **Confusing short with obvious.** Terse code can be maximally obscure.
  Obviousness is about the reader's effort, not the line count.
- **Exposing internals for testing.** Test through the interface, or make
  the internal thing its own module with its own interface.
- **Hiding what the caller genuinely needs.** Making failure invisible is
  not simplicity; it is a bug waiting for production.
- **Arguing with a confused reader.** Their confusion is data.

## Related skills

- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)
- [choosing-precise-names](../choosing-precise-names/SKILL.md)
- [writing-useful-comments](../writing-useful-comments/SKILL.md)

## Further reading

- [obviousness-checklist.md](references/obviousness-checklist.md) is a
  pass to run over a diff, with the question to ask at each point.
