---
name: translating-gof-patterns
description: Use when reaching for a factory, strategy, visitor or other class-based pattern, when porting object-oriented code, or when a pattern feels heavy.
---

# Translating GoF Patterns

## Overview

The classic design patterns are not obsolete in functional code; most of
them are simply smaller. A pattern that needed an interface, two classes,
and a registry usually becomes a function, a function type, or a choice
type. The problem each pattern solves is still real; the scaffolding
built to solve it in a language without first-class functions is not.

Knowing the translation matters for two reasons: it stops a familiar name
dragging a heavy implementation into a functional codebase, and it makes
object-oriented code readable when porting it.

## When to use

- About to name something `...Factory`, `...Strategy`, or `...Manager`
- Porting object-oriented code to a functional style
- A pattern's usual implementation feels like ceremony here
- Choosing how to make one piece of behaviour vary

Not for: deciding module boundaries, which is
[designing-deep-modules](../designing-deep-modules/SKILL.md).

## The translation table

| Pattern          | Functional form                           |
| ---------------- | ----------------------------------------- |
| Strategy         | A function parameter                      |
| Command          | A value describing the action             |
| Factory          | A function returning a value              |
| Abstract Factory | A record of constructor functions         |
| Template Method  | A function taking the varying steps       |
| Decorator        | A function wrapping a function            |
| Adapter          | A conversion function                     |
| Facade           | A module with a small interface           |
| Observer         | Return events; the shell delivers them    |
| Iterator         | A lazy sequence                           |
| State            | A choice type plus transition functions   |
| Composite        | A recursive choice type plus a fold       |
| Visitor          | A fold, or exhaustive matching            |
| Singleton        | A value, passed in                        |
| Builder          | A record with defaults, or a constructor  |
| Chain of resp.   | A list of functions returning `Option`    |
| Memento          | The previous immutable value              |
| Flyweight        | Structural sharing, which is automatic    |
| Interpreter      | A choice type plus an evaluation function |
| Mediator         | A workflow function                       |

Each is worked out in [catalog.md](references/catalog.md).

## The three that change most

**Strategy becomes a parameter.** No interface, no implementations, no
registry.

```text
-- before: an interface and three classes
-- after:
priceBooking : (Booking -> Money) -> Booking -> Priced
```

**Visitor becomes a fold or a match.** The double-dispatch machinery
exists to work around a language that cannot match on a value's case.
Where matching is available, use it.

```text
area : Shape -> Area
area s =
  match s with
  | Circle r -> pi * r * r
  | Rect w h -> w * h
```

**Observer becomes returned events.** Instead of registering callbacks
that fire inside the decision, return what happened and let the shell
deliver it. The decision stays pure and testable, and the set of
listeners becomes visible in one place.

```text
confirmBooking : BookingRequest -> Result<List<BookingEvent>, ConfirmBookingError>
```

## Patterns that stay useful

Not everything shrinks to nothing:

- **Interpreter** is a genuine functional pattern: a choice type for the
  language, a pure evaluator, and the option of several evaluators.
- **Decorator** remains useful for cross-cutting guarantees such as
  retry, but see the caution in
  [separating-layers](../separating-layers/SKILL.md).
- **Adapter** is unavoidable at every boundary, and should be an
  explicit named function. See
  [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md).
- **Composite** is exactly a recursive choice type, and folds over it are
  the natural way to consume one.

## The caution

A pattern applied because it is known, rather than because the problem
called for it, adds interface without adding capability. The failure mode
is the same as over-abstraction generally: a factory that produces one
type, a strategy with one implementation, a mediator that forwards.

Before naming anything after a pattern, ask:

1. What varies here, and does it vary in reality or only in principle?
2. What is the simplest thing that lets it vary? Usually a parameter.
3. Would a reader who does not know the pattern understand this code?

## Red flags

- A type name ending in `Factory`, `Strategy`, `Manager`, `Helper`
- An interface with one implementation and no test benefit
- A registry mapping names to constructors, used from one place
- Callbacks fired from inside a domain function
- Double dispatch where a match would do
- A builder for a record with three fields

## Common mistakes

- **Porting the structure instead of the intent.** The classes are the
  workaround; the intent is what to keep.
- **Reaching for a plugin mechanism when the cases are fixed.** Use a
  choice type and exhaustive matching. See
  [applying-solid-functionally](../applying-solid-functionally/SKILL.md).
- **Keeping the pattern's vocabulary.** Name things for the domain, not
  for the pattern.
- **Wrapping functions in objects to "keep it consistent".** Consistency
  with the framework is not worth the interface.

## Related skills

- [applying-solid-functionally](../applying-solid-functionally/SKILL.md)
- [folding-over-data](../folding-over-data/SKILL.md)
- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [composing-functions](../composing-functions/SKILL.md)

## Further reading

- [catalog.md](references/catalog.md) works each pattern through, with
  the object-oriented shape, the functional shape, and when the pattern
  is still worth naming.
