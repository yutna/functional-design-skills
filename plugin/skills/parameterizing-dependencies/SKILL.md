---
name: parameterizing-dependencies
description: Use when domain code needs a database, clock, or service, when tests need heavy mocking, or when deciding how to supply I/O to business logic.
---

# Parameterizing Dependencies

## Overview

Business logic frequently needs something from the world: a stored
record, the current time, a rate from another service. Reaching for it
directly makes the logic impure, untestable, and dependent on
infrastructure it should know nothing about.

The functional answer needs no container and no framework. The domain
declares what it needs as a function type, receives it as a parameter,
and the shell supplies the real implementation once, at the edge. Where
possible the dependency is removed entirely, by fetching first and
deciding afterwards.

## When to use

- A domain function needs data it does not have
- Tests require a mocking framework to run business logic
- The current time, a random value, or an identifier must be generated
- Deciding where to put a service call inside a workflow
- A domain module imports a database or HTTP client

Not for: choosing which effects the system performs at all, which is
[separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md).

## The three strategies, in order of preference

**1. Dependency rejection.** Restructure so the function does not need
the dependency: fetch the data in the shell, pass the values in, and let
the decision be pure.

```text
-- before: the decision needs a lookup
priceBooking : GetTreatmentPrice -> Booking -> PricedBooking

-- after: the shell looked everything up first
priceBooking : PriceList -> Booking -> PricedBooking
```

Best when the set of needed data is known before the decision. It leaves
the core completely pure, and the test needs no stubs at all.

**2. Dependency parameterization.** Pass the capability as a function
type, applied once at wiring time.

```text
alias GetTreatmentPrice = TreatmentCode -> Price
priceBooking : GetTreatmentPrice -> ValidatedBooking -> PricedBooking
```

Best when what to fetch depends on the decision, so a prior fetch is not
possible. This is the default for workflow steps.

**3. Interpretation.** The core returns a description of the effects to
perform, and the shell executes them.

```text
type Instruction = Charge of Money | Notify of EmailAddress
decide : Booking -> List<Instruction>
```

Best when the effect sequence is itself a business decision worth
inspecting, testing, or replaying. It costs an extra layer, so use it
where that payoff is real.

## Core rules

1. **Prefer rejection, then parameterization, then interpretation.**
   Reach for the heaviest only when the lighter ones do not fit.
2. **Declare the function type in the domain**, in the domain's words.
   `GetTreatmentPrice`, not `ITreatmentRepository`.
3. **One function type per capability used**, not one record per treatment.
   See
   [applying-solid-functionally](../applying-solid-functionally/SKILL.md).
4. **Dependencies first, data last**, so partial application produces the
   shape a pipeline wants.
5. **Bind dependencies once, at the edge.** The wiring happens in one
   composition-root function, not at every call site.
6. **Never thread a dependency through a function that does not use it.**
   Apply it where it is needed, so intermediate signatures stay clean.
7. **Treat time, randomness, and identifier generation as dependencies.**
   They are I/O wearing an innocent face.

## Pattern

Hidden dependency:

```text
-- imports the database and the clock; untestable without both
expireQuotes : Unit -> AsyncResult<Integer, Error>
expireQuotes () =
  let now = Clock.now ()
  let quotes = Db.query "select ... where expires < ?" now
  in ...
```

Declared and supplied:

```text
-- domain: states what it needs, imports nothing
alias FindExpirable = Instant -> Async<List<Quote>>
alias MarkExpired = QuoteId -> AsyncResult<Unit, StoreError>

expireQuotes :
  FindExpirable -> MarkExpired -> Instant
    -> AsyncResult<ExpiryReport, ExpiryError>

-- shell: supplies real ones, once
expireQuotesLive = expireQuotes (findInDb pool) (markInDb pool)
```

The test supplies two one-line functions and a fixed instant, and asserts
on a plain value.

## Avoiding the threading problem

Passing a dependency through functions that do not use it is leakage. Fix
it by applying the dependency where it is needed, before composing.

```text
-- bad: every step's signature mentions the catalogue
step1 : Catalogue -> A -> B
step2 : Catalogue -> B -> C

-- good: applied once, signatures stay clean
pipeline catalogue =
  step1 catalogue >> step2 catalogue
-- inside pipeline, the composed steps are A -> B and B -> C
```

For a dependency needed deep inside a large tree of calls, that is a
signal the decision is in the wrong place. Move the decision up to where
the data already is, which is dependency rejection again.

## Red flags

- A domain module importing a driver, a client, or a framework
- A test that needs a mocking library to exercise a business rule
- `now()`, `random()`, or `uuid()` called inside a domain function
- A parameter named `context`, `services`, or `container`
- A dependency passed to five functions and used by one
- A repository interface with twenty members, two of them used

## Common mistakes

- **Building a container.** Partial application is the injection
  mechanism. A framework adds indirection and hides the wiring.
- **Passing a whole service.** Pass the one function used, so the
  signature states exactly what the code touches.
- **Parameterizing pure helpers.** A function that formats a string does
  not need an injected formatter.
- **Wiring at every call site.** One composition root, at the edge.
- **Using interpretation everywhere.** Returning instructions for every
  effect makes simple code ceremonial. Reserve it for effect sequences
  that are business decisions.

## Related skills

- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- [applying-solid-functionally](../applying-solid-functionally/SKILL.md)
- [testing-functional-code](../testing-functional-code/SKILL.md)

## Further reading

- [strategies.md](references/strategies.md) compares the three strategies
  on the same example, and covers time, randomness, configuration, and
  the composition root.
