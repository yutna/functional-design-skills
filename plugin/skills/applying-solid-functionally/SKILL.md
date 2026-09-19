---
name: applying-solid-functionally
description: Use when a function takes a whole service to use one part, when adding a variant forces edits everywhere, or when structuring module dependencies.
---

# Applying SOLID Functionally

## Overview

The SOLID principles are about the direction and shape of dependencies,
not about classes. Every one of them survives translation into functions
and data, and in functional code most of them get simpler: the
abstraction that other principles reach for with interfaces and
inheritance is, here, just a function type.

## When to use

- Deciding what a function should take as parameters
- Adding a new variant, and finding many places to edit
- Two features that change for different reasons live in one module
- A module receives a large record of functions and uses two of them
- Choosing between a choice type and a passed-in function

Not for: naming, or judging interface size in isolation.

## The five, restated

| Principle | Functional statement                                    |
| --------- | ------------------------------------------------------- |
| SRP       | One function, one reason to change, one audience        |
| OCP       | Extend by adding code, not by editing existing code     |
| LSP       | Any value of a type honours the type's whole contract   |
| ISP       | Depend on the narrowest function type that works        |
| DIP       | Concrete code depends on function types, not vice versa |

## Core rules

1. **Split by who asks for the change, not by what the code does.** Two
   calculations that look alike but answer to different stakeholders
   belong in different modules, whatever the duplication.
2. **Choose the axis of change before choosing the mechanism.** New cases
   and new operations pull in opposite directions. See the expression
   problem below.
3. **Make the extension point a parameter.** A function passed in is the
   simplest open-closed mechanism there is, and it needs no registry, no
   class, and no framework.
4. **Keep passed-in functions total and faithful.** A substitute that
   throws where the type says `Result`, or that demands more of its
   input than the type states, breaks every caller written against the
   type.
5. **Pass functions, not modules.** `GetPrice = TreatmentCode -> Price` is
   an interface with one member. A repository record with twenty members
   forces every consumer to depend on all twenty.
6. **Point dependencies at the domain.** The domain defines the function
   types it needs; the shell supplies implementations. Nothing in the
   domain imports the database, the framework, or the transport.

## The expression problem

This decides mechanism, and getting it wrong is the usual cause of
"adding a variant means editing ten files".

```text
-- Closed to new cases, open to new operations.
-- Adding Refunded means editing every match. Adding a new
-- function over Status costs nothing.
type Status = New | Paid | Void
```

```text
-- Open to new cases, closed to new operations.
-- Adding a new payment method costs nothing. Adding a new
-- operation means changing the record and every implementation.
alias PaymentMethod = { charge: Amount -> AsyncResult<Receipt, Error> }
```

Rules of thumb:

- The set of cases is fixed by the business and the operations grow:
  use a **choice type**. Exhaustive matching then tells you exactly what
  to update when a case really is added.
- The set of cases grows, from plugins or from a widening market, and
  the operations are stable: pass a **function or a small record of
  functions**.
- Both grow: pick the one that grows faster to be the open axis, and
  accept edits on the other. There is no mechanism that makes both free.

Choosing a choice type is not a violation of OCP. Exhaustive matching
turns "adding a case" into a task the compiler enumerates, which is the
opposite of the OCP failure mode, where a missed site fails silently.

## Pattern

Wide dependency, violating ISP and DIP at once:

```text
confirmBooking : BookingRepository -> Booking -> AsyncResult<Unit, Error>
-- BookingRepository has 22 functions; confirmBooking uses two of them,
-- and the domain module now imports the storage module
```

Narrow dependencies, defined by the domain:

```text
-- declared by the domain, in the domain's words
alias CheckTreatmentExists = TreatmentCode -> Boolean
alias SaveBooking = Booking -> AsyncResult<Unit, SaveError>

confirmBooking :
  CheckTreatmentExists -> SaveBooking -> Booking
    -> AsyncResult<BookingConfirmed, ConfirmBookingError>
```

Now the domain states its needs, the shell satisfies them, tests supply
two one-line functions, and no storage type crosses the boundary.

See
[parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
for how these are supplied without threading them through every call.

## On accessors and inheritance

Two habits carried over from object-oriented code that add nothing here:

- **Getters and setters for every field.** A record of plain data needs
  no accessors. Wrapping fields in functions does not hide them; it adds
  interface while leaving the design decision exposed. Hide data by not
  exposing the type, or by exposing operations that mean something.
- **Inheritance for reuse.** Sharing implementation by inheritance is
  the tightest coupling available. Compose functions, or pass the
  varying behaviour in. Reserve subtyping for genuine substitutability,
  and prefer a choice type when the set of variants is known.

## Red flags

- One module changes for two different stakeholders' requests
- Adding a variant requires edits in several unrelated files
- A parameter is a whole service, repository, or context object
- A function passed as a dependency throws instead of returning `Result`
- The domain imports the framework, the driver, or the transport
- A record type exists only to hold get and set functions

## Common mistakes

- **Treating SRP as "one function does one thing".** It is about reasons
  to change. Two audiences, two modules, even if the code looks similar.
- **Reaching for plugin machinery to satisfy OCP.** If the case set is
  fixed, exhaustive matching is stronger and cheaper.
- **Passing a mock-shaped object.** A dependency that must be mocked with
  a framework is too wide. Narrow it until a plain function suffices.
- **Inverting a dependency that never varies.** An abstraction with one
  implementation and no prospect of a second is interface for nothing.

## Related skills

- [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [translating-gof-patterns](../translating-gof-patterns/SKILL.md)

## Further reading

- [srp-and-ocp.md](references/srp-and-ocp.md) works through separating by
  audience and the open-closed mechanisms available in functional code.
- [lsp-isp-dip.md](references/lsp-isp-dip.md) covers substitutability
  contracts, narrowing dependencies, and which way the arrows point.
