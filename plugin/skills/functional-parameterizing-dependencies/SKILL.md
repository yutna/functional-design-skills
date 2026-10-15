---
name: functional-parameterizing-dependencies
description: Use when domain code needs a database or clock, when tests need heavy mocking, or when an effect system or library makes simple code ceremonial where a plain function would do.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.2
---

# Parameterizing Dependencies

## Overview

Business logic frequently needs something from the world: a stored
record, the current time, a rate from another service. Reaching for it
directly makes the logic impure, untestable, and dependent on
infrastructure it should know nothing about.

A dependency here is anything a function needs and cannot compute from
its inputs: a value that had to be read, or the capability that reads
it.

The functional answer needs no container and no framework. Most of the
time the capability disappears from the logic: a handler reads first and
passes the value in, and the logic stays pure. Where a read cannot come
first, the handler takes the capability as a parameter, a function type
declared in the domain's words, and the shell supplies the real one
once, at the edge.

## When to use

- A domain function needs data it does not have
- Tests require a mocking framework to run business logic
- The current time, a random value, or an identifier must be generated
- Deciding where to put a service call inside a workflow
- A domain module imports a database or HTTP client

Not for: choosing which effects the system performs at all, which is
[functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md).

## The three strategies, in order of preference

**1. Dependency rejection.** The deciding code needs nothing from the
world. A handler reads everything first and passes values in, and the
decision is one pure function.

```text
-- before: a rule and a capability call in one function
alias GetTreatmentPrice = TreatmentCode -> Async<Price>
priceBooking : GetTreatmentPrice -> ValidatedBooking -> Async<PricedBooking>

-- after: the handler read the catalogue first
priceBooking :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, PricingError>
```

It leaves the core pure, and its tests need no stub at all. It costs a
read the decision may turn out not to use.

**2. Dependency parameterization.** A handler takes the capability as a
parameter and reads between two pure functions.

```text
-- core: one rule names the catalogue, another prices from it
catalogueFor : ValidatedBooking -> CatalogueId
priceBooking :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, PricingError>

-- shell: the handler declares what it needs and reads between them
alias LoadCatalogueById = CatalogueId -> AsyncResult<Catalogue, StoreError>

type PricingFailure =
  | Rejected of PricingError
  | Unavailable of StoreError

priceFromCatalogue :
  LoadCatalogueById -> ValidatedBooking
    -> AsyncResult<PricedBooking, PricingFailure>
priceFromCatalogue loadCatalogueById booking =
  loadCatalogueById (catalogueFor booking)
    |> mapError Unavailable
    |> bind (\catalogue ->
         priceBooking catalogue booking |> mapError Rejected)
```

The rules stay in the two pure functions: which catalogue applies, the
clinic's own or an insurer's, and what the booking costs under it. The
handler reads, calls, and passes on what came back. It costs a stub for
each capability in the handler's tests, and the order of reads becomes
code to test.

**3. Interpretation.** The core returns instructions for the effects to
perform, and the shell executes them.

```text
advance :
  Instant -> BookingProcess -> ProcessEvent
    -> (BookingProcess, List<Instruction>)
```

`Instruction` is a choice type with a case for each effect the process
can ask for, such as `HoldSlot` and `TakePayment`.
[worked-long-running.md](../functional-making-effects-reliable/references/worked-long-running.md)
declares it, with the states and the events.

This process runs for days and across three systems. What it does next
is saved with its state, so it can resume after a restart, and that is
what makes its effects worth having as values. The price is an
instruction type and a shell that interprets it.

## Core rules

1. Default. **Prefer rejection, then parameterization, then
   interpretation.** Read everything first. A read cannot come first in
   three cases, and then the handler reads between two pure functions:
   what to read cannot be named until a rule has run; the read has a
   known cost too high to pay every time, such as a charge for each
   call, a rate limit, or a delay that has been measured; or a check
   must pass before the read is allowed. Return instructions when the
   sequence of effects is itself something the business cares about:
   it has to be stored so that a long-running process can resume, shown
   to an auditor, or replayed.
2. Default. **Declare a capability's type in the domain's words**, where the
   handler that takes it can see it and no adapter is imported.
   `LoadCatalogueById`, not `ICatalogueRepository`. A handler that reads once
   and writes once declares none: it takes the connection and calls its adapters
   by name, because it has no path worth a stub.
3. Default. **One function type per capability used**, not one record per
   service. A record is right only for functions that have to vary together as a
   set, all of which the handler calls. See
   [functional-applying-solid-functionally](../functional-applying-solid-functionally/SKILL.md).
4. Default. **Dependencies first, data last**, so partial application produces
   the shape a pipeline wants. Rule 3 of
   [functional-composing-functions](../functional-composing-functions/SKILL.md)
   owns the order, and names the language in which it is reversed.
5. Default. **Bind capabilities once, at the edge.** The wiring happens in one
   composition-root function, not at every call site. Rule 8 of
   [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
   names the two things that are bound somewhere else.
6. Rule. **Never hand a dependency to a function that only passes it
   on.** The function that composes the steps applies the dependency to
   the step that uses it, so no signature in between names it.
7. Rule. **Time, randomness, and identifier generation are
   dependencies.** They are I/O wearing an innocent face. The core
   receives the value; only the shell calls the source. Where only a
   rule can count how many identifiers are needed, pass one that the
   core derives the rest from, or draw them between two pure functions.

## Pattern

Hidden dependency:

```text
-- imports the database and the clock; untestable without both
expireQuotes : Unit -> AsyncResult<Integer, StoreError>
expireQuotes () =
  let now = Clock.now ()
  let quotes = Db.query "select ... where expires < ?" now
  in ...
```

Rejected:

```text
-- core: which quotes have expired is a rule
expire : Instant -> List<Quote> -> List<QuoteExpired>

-- shell: reads, asks the core, writes
expireQuotes : Pool -> Instant -> AsyncResult<Integer, StoreError>
expireQuotes pool now =
  loadOpenQuotes pool
    |> map (expire now)
    |> bind (saveExpired pool)
```

The rule is tested with an instant and a list, and no stub. The handler
has no condition in it, and takes the instant from whoever read the
clock for this run. It takes the connection and calls its adapters by
name: with one read and one write it has no path worth a stub, and an
integration test covers it.

Where there are too many open quotes to load, a pure function works out
the cutoff from the instant and the handler passes it to the query. How
old a quote may grow is still stated in the core.

A handler that reads between pure functions has paths. It takes its
capabilities as function-typed parameters, so that a test can stub each
one, and the composition root supplies the real ones:

```text
-- declared beside the handler, in the domain's words
alias LoadCatalogueById = CatalogueId -> AsyncResult<Catalogue, StoreError>

-- supplied once, at the edge
priceFromCatalogueLive = priceFromCatalogue (loadCatalogueByIdFrom pool)
```

The handler's test supplies a one-line function for `LoadCatalogueById` and
asserts on a plain value.

## Avoiding the threading problem

A function that receives a dependency only to hand it on has a signature
that names something it does not use. Apply the dependency where it is
used, and give the function in between what it actually calls.

```text
-- threaded: only checkCode reads the catalogue; checkLines carries it
checkLines : Catalogue -> List<RawLine> -> Result<List<Line>, LineError>
checkCode  : Catalogue -> RawLine -> Result<Line, LineError>

-- applied where it is used: checkLines takes the check it runs
checkLines :
  (RawLine -> Result<Line, LineError>) -> List<RawLine>
    -> Result<List<Line>, LineError>

validateLines catalogue = checkLines (checkCode catalogue)
```

For a dependency needed deep inside a large tree of calls, that is a
signal the decision is in the wrong place. Move the decision up to where
the data already is, which is dependency rejection again.

## Red flags

- A domain module importing a driver, a client, or a framework
- A core function with a capability among its parameters
- A test that needs a mocking library to exercise a business rule
- `now()`, `random()`, or `uuid()` called inside a domain function
- A parameter named `context`, `services`, or `container`
- A dependency passed to five functions and used by one
- A repository interface with twenty members, two of them used

## Common mistakes

- **Building a container.** Partial application is the injection
  mechanism. A framework adds indirection and hides the wiring.
- **Passing a capability where a value would do.** If the handler can
  read first, the function it calls needs the value, not the means of
  fetching it.
- **Passing a whole service.** Pass the one function used, so the
  signature states exactly what the code touches.
- **Parameterizing pure helpers.** A function that formats a string does
  not need an injected formatter.
- **Wiring at every call site.** One composition root, at the edge.
- **Using interpretation everywhere.** Returning instructions for every
  effect makes simple code ceremonial. Reserve it for effect sequences
  that are business decisions.

## Related skills

- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-designing-workflow-pipelines](../functional-designing-workflow-pipelines/SKILL.md)
- [functional-applying-solid-functionally](../functional-applying-solid-functionally/SKILL.md)
- [functional-testing-functional-code](../functional-testing-functional-code/SKILL.md)

## Further reading

- [strategies.md](references/strategies.md) compares the three strategies
  on the same example, and covers time, randomness, configuration, and
  the composition root.
