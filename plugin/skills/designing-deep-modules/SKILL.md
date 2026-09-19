---
name: designing-deep-modules
description: Use when designing a module interface, when it exports nearly as much as it hides, or when many tiny modules or one-function files multiply.
---

# Designing Deep Modules

## Overview

A module is two things: an interface, which is everything a caller must
know to use it, and an implementation, which is everything else. A
module's value is the ratio between them. Deep modules present a small
interface over a lot of functionality; shallow modules present an
interface almost as complicated as the code behind it, and so pay their
own cost back in complexity.

The best modules are deep. Getting depth wrong is the most common
structural mistake in otherwise clean functional code, because splitting
feels virtuous and each split adds an interface.

## When to use

- Deciding what a new module or file exports
- Reviewing an interface before other code depends on it
- A codebase has many small files that each do almost nothing
- A wrapper exists that only forwards to something else
- Deciding whether a helper deserves its own module

Not for: deciding whether two existing pieces of code belong together,
which is
[splitting-and-joining-code](../splitting-and-joining-code/SKILL.md).

## What counts as the interface

In functional code the interface is larger than the export list. It is
everything a caller must know, formal and informal:

| Part of the interface | Formal? | Example                       |
| --------------------- | ------- | ----------------------------- |
| Exported signatures   | Yes     | `price : Booking -> Priced`   |
| Types in signatures   | Yes     | the fields of `Booking`       |
| Failure cases         | Yes     | the `E` in `Result<T, E>`     |
| Effects               | Yes     | `Async`, `IO` in the type     |
| Required call order   | No      | "validate before price"       |
| Value constraints     | No      | "quantity must be positive"   |
| Performance promises  | No      | "safe to call in a loop"      |
| Idempotency           | No      | "calling twice double-counts" |

Every informal item is a cost a caller pays and a compiler cannot help
with. The design goal is to make the formal parts carry as much of the
contract as possible, and to reduce the rest to nothing.

## Core rules

1. **Measure depth as functionality hidden per unit of interface.** Count
   the interface, including the informal parts above. If the count
   approaches the size of the implementation, the module is not earning
   its existence.
2. **Prefer fewer, larger modules over many tiny ones.** Each boundary
   costs an interface. A boundary must buy more than it costs.
3. **Design the interface for the common case.** Make the frequent use a
   one-liner; let the rare use be more work, not the other way round.
4. **Do not export what callers should not use.** Test through the
   interface. See
   [hiding-information](../hiding-information/SKILL.md).
5. **Make it somewhat general purpose.** Not maximally general, and not
   welded to today's single caller. See
   [general-purpose-questions.md](references/general-purpose-questions.md).
6. **Reject pure pass-throughs.** A function whose body is one call with
   the same arguments adds interface and hides nothing.

## Pattern

A shallow module: the interface restates the implementation.

```text
-- BookingStore: five exported functions, each one line of real work
insertBookingRow : BookingRow -> AsyncResult<Unit, DbError>
selectBookingRow : BookingId -> AsyncResult<Option<BookingRow>, DbError>
updateBookingRow : BookingRow -> AsyncResult<Unit, DbError>
beginTx        : Unit -> AsyncResult<Tx, DbError>
commitTx       : Tx -> AsyncResult<Unit, DbError>
```

Every caller must know about rows, transactions, and the order in which
to use them. The module hides the SQL string and nothing else. Callers
carry the complexity.

A deep module: the same functionality, one thing to know.

```text
-- BookingStore
saveBooking : Booking -> AsyncResult<Unit, SaveError>
loadBooking : BookingId -> AsyncResult<Option<Booking>, LoadError>
```

Transactions, rows, retries, and the mapping between `Booking` and storage
are now implementation. The interface is two functions and two error
types, and a change to the schema cannot reach a caller.

## Classitis and its functional twin

The belief that more, smaller units are automatically better. In
object-oriented code it produces classes with one method; in functional
code it produces:

- One-function files whose export is a rename of an import
- "Utils" modules that exist so a two-line helper has a home
- Pipelines split into steps so small that the wiring is longer than the
  work
- A separate module per record field's validation

The test: could this module's contents be inlined into its single caller
without any reader losing information? If yes, it is not a module; it is
a paragraph that was given a filename.

Length is not the enemy. A long function that does one thing at one level
of abstraction is fine. Splitting it is only an improvement if each part
is independently meaningful and the split boundaries are natural.

## Red flags

- The export list is as long as the file
- Exported functions map one-to-one onto internal steps
- A caller always calls two of the exports in sequence
- Adding a feature means adding an export
- The module's doc comment lists its functions instead of its purpose
- Anything named `helpers`, `utils`, `common`, or `misc`

## Common mistakes

- **Splitting by structure rather than by knowledge.** One module per
  entity, per layer, or per file-type distributes one decision across
  many places.
- **Counting only exported names as the interface.** Required call order
  and value constraints cost callers just as much.
- **Making a module maximally general.** Generality nobody uses is
  interface nobody needs.
- **Confusing a deep module with a big one.** Depth is a ratio, not a
  size. A deep module can be small if what it hides is genuinely hard.

## Related skills

- [hiding-information](../hiding-information/SKILL.md)
- [separating-layers](../separating-layers/SKILL.md)
- [splitting-and-joining-code](../splitting-and-joining-code/SKILL.md)
- [deciding-what-matters](../deciding-what-matters/SKILL.md)

## Further reading

- [depth-audit.md](references/depth-audit.md) scores a module's depth and
  says what to do with each score.
- [general-purpose-questions.md](references/general-purpose-questions.md)
  is the set of questions that finds the right level of generality.
