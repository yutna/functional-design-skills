---
name: separating-layers
description: Use when adjacent layers repeat the same abstraction, when a function only forwards to another, or when callers repeat the same lines after it.
---

# Separating Layers

## Overview

In a well-structured system each layer speaks a different language. The
layer above talks about bookings and customers; the layer below talks about
rows and bytes; a layer between talks about neither at once. When two
adjacent layers have the same abstraction, the boundary between them is
not earning anything, and the code is longer for no gain.

The companion rule is direction: when complexity has to live somewhere,
it belongs in the lower layer, absorbed once, rather than in every caller
above.

## When to use

- A function's body is a single call to another function
- A wrapper module exists whose exports mirror what it wraps
- Two layers use the same types and the same vocabulary
- A module returns something every caller must post-process identically
- Deciding where to put a messy detail

Not for: deciding whether two things belong in the same module, which is
[splitting-and-joining-code](../splitting-and-joining-code/SKILL.md).

## Core rules

1. **Each layer changes the abstraction.** If the layer above and the
   layer below use the same nouns, delete one of them.
2. **Delete pass-through functions.** A function that takes the same
   arguments and calls one function with them adds interface and hides
   nothing. Let the caller call directly.
3. **Pull complexity downward.** Given a choice between a slightly harder
   implementation and a slightly harder interface, make the
   implementation harder. One implementer pays once; every caller pays
   forever.
4. **Absorb the common case.** If every caller does the same thing after
   calling you, do it for them.
5. **Do not add configuration to avoid a decision.** An option exported
   so callers can choose is complexity moved upward. Decide, and expose a
   choice only where callers genuinely differ.
6. **Keep decorators rare.** A wrapper that adds one small behaviour is
   usually better as a parameter or as part of the thing it wraps.

## Pattern

Layers with the same abstraction: three hops, no translation.

```text
-- api layer
getBooking id = service.getBooking id

-- service layer
getBooking id = repo.getBooking id

-- repo layer
getBooking id = db.query "select ..." id
```

Two of these three functions exist only to be called. Every change to a
signature ripples through all three, and no reader learns anything by
following the chain.

Layers that each translate:

```text
-- api layer: HTTP words in, HTTP words out
handleGetBooking : Request -> Async<Response>
-- translates path parameters and status codes

-- domain layer: booking words only
loadBooking : BookingId -> AsyncResult<Booking, LoadError>
-- knows nothing about HTTP or SQL

-- storage layer: row words only
selectBooking : BookingId -> AsyncResult<Option<BookingRow>, DbError>
-- knows nothing about bookings as the business means them
```

Each layer now has a reason to exist: it converts one vocabulary into
another and hides the vocabulary below it.

## Pulling complexity downward

| Situation             | Upward (wrong)         | Downward (right)   |
| --------------------- | ---------------------- | ------------------ |
| Result needs cleaning | Every caller cleans it | Returned ready     |
| Failure is retryable  | Caller writes retries  | Module retries     |
| Defaults nearly fixed | Caller passes them     | Module defaults    |
| An edge case exists   | Caller checks for it   | Module handles it  |
| Two shapes are needed | Caller converts        | Module exports two |

The limit: do not pull complexity down when the callers genuinely differ.
Absorbing a decision that only half the callers agree with produces a
mode flag, which is complexity in both places at once.

See [pulling-complexity-down.md](references/pulling-complexity-down.md).

## Red flags

- A function body is one call with the same arguments
- Layer names differ but their types are identical
- Every caller of a function follows it with the same two lines
- A module exports options rather than making a decision
- A wrapper adds a single log line or a single retry
- Following a call takes four hops before reaching real work

## Common mistakes

- **Confusing a pass-through with a boundary.** A function that
  translates types, restricts a signature, or turns an exception into a
  `Result` is doing work and should stay.
- **Pulling complexity down into the wrong module.** The module that
  absorbs it must be the one that owns the knowledge, or you have created
  leakage while removing duplication.
- **Adding a layer for symmetry.** A layer that exists because the other
  side of the system has one is a pass-through with a nicer story.
- **Removing a layer that hides a real dependency.** If the wrapper is
  what stops a third-party type from reaching the domain, it earns its
  keep.

## Related skills

- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [hiding-information](../hiding-information/SKILL.md)
- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [defining-errors-out-of-existence](../defining-errors-out-of-existence/SKILL.md)

## Further reading

- [layer-smells.md](references/layer-smells.md) tells a real boundary
  from a pass-through, with the test for each case.
- [pulling-complexity-down.md](references/pulling-complexity-down.md)
  gives the decision procedure and its limits.
