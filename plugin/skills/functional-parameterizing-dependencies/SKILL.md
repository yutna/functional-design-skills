---
name: functional-parameterizing-dependencies
description: Use when domain code needs a database or clock, when tests need heavy mocking, or when an effect system or library makes simple code ceremonial where a plain function would do.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.1.0
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
time the dependency disappears: a handler reads first and passes the
value in, and the logic stays pure. Where a read cannot come first, the
handler takes the capability as a parameter, a function type declared in
the domain's words, and the shell supplies the real one once, at the
edge.

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
alias GetTreatmentPrice = TreatmentCode -> AsyncResult<Price, StoreError>
priceBooking :
  GetTreatmentPrice -> ValidatedBooking
    -> AsyncResult<PricedBooking, StoreError>

-- after: the handler read the price list first
priceBooking : PriceList -> ValidatedBooking -> PricedBooking
```

It leaves the core pure, and its tests need no stub at all. It costs a
read the decision may turn out not to use.

**2. Dependency parameterization.** A handler takes the capability as a
parameter and reads between two pure functions.

```text
-- core: one rule names the price list, another prices from it
priceListFor : ValidatedBooking -> PriceListId
priceBooking : PriceList -> ValidatedBooking -> PricedBooking

-- shell: the handler declares what it needs and reads between them
alias LoadPriceList = PriceListId -> AsyncResult<PriceList, StoreError>

priceFromList :
  LoadPriceList -> ValidatedBooking
    -> AsyncResult<PricedBooking, StoreError>
priceFromList loadPriceList booking =
  loadPriceList (priceListFor booking)
    |> map (\prices -> priceBooking prices booking)
```

The rules stay in the two pure functions. The handler reads, calls, and
passes on what came back. It costs a stub for each capability in the
handler's tests, and the order of reads becomes code to test.

**3. Interpretation.** The core returns instructions for the effects to
perform, and the shell executes them.

```text
type Instruction = Charge of Money | Notify of EmailAddress
settle : ConfirmedBooking -> List<Instruction>
```

It costs an instruction type and a shell that interprets it. What it
buys is that the effects are values, which can be stored, compared,
shown to an auditor, and replayed.

## Core rules

1. Default. **Prefer rejection, then parameterization, then
   interpretation.** Read everything first. Read between two pure
   functions when what to read cannot be named until a rule has run,
   when reading it all has been measured to cost too much, or when a
   check must pass before a read is allowed. Return instructions when
   the sequence of effects is itself something the business cares
   about: it has to be stored so that a long-running process can
   resume, shown to an auditor, or replayed.
2. Default. **Declare a capability's type in the domain's words**, where
   the handler that takes it can see it and no adapter is imported.
   `LoadPriceList`, not `IPriceListRepository`.
3. Default. **One function type per capability used**, not one record per
   service. See
   [functional-applying-solid-functionally](../functional-applying-solid-functionally/SKILL.md).
4. Default. **Dependencies first, data last**, so partial application produces
   the shape a pipeline wants.
5. Default. **Bind dependencies once, at the edge.** The wiring happens in one
   composition-root function, not at every call site.
6. Rule. **Never hand a dependency to a function that only passes it
   on.** Apply it where it is used, so the signatures in between stay
   clean.
7. Rule. **Time, randomness, and identifier generation are
   dependencies.** They are I/O wearing an innocent face. The core
   receives the value; only the shell calls the source.

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
expired : Instant -> List<Quote> -> List<QuoteId>

-- shell: reads, asks the core, writes
expireQuotes : Pool -> Instant -> AsyncResult<Integer, StoreError>
expireQuotes pool now =
  loadOpenQuotes pool
    |> map (expired now)
    |> bind (markExpired pool)
```

The rule is tested with an instant and a list, and no stub. The handler
has no condition in it, and takes the instant from whoever read the
clock for this run.

Where a read has to wait for a rule, the handler declares the capability
and the composition root supplies it:

```text
-- declared beside the handler, in the domain's words
alias LoadPriceList = PriceListId -> AsyncResult<PriceList, StoreError>

-- supplied once, at the edge
priceFromListLive = priceFromList (loadPriceListFrom pool)
```

The handler's test supplies a one-line function for `LoadPriceList` and
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
