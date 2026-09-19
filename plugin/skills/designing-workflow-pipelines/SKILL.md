---
name: designing-workflow-pipelines
description: Use when implementing a use case, command handler, or business process, or when logic for one operation is scattered across services and layers.
---

# Designing Workflow Pipelines

## Overview

A workflow is one business process: a command arrives, work happens,
events come out. Modelled as a pipeline, it becomes a sequence of small
total functions, each with its own input and output types, composed into
one function whose signature states the whole contract.

This shape is what makes a domain model executable. The types along the
pipeline record which checks have already happened, so no step re-checks;
the ends of the pipeline mark exactly where effects are allowed; and the
whole use case can be read in one place instead of being assembled in a
reader's head from four services.

## When to use

- Implementing a use case, endpoint handler, job, or message consumer
- Business logic for one operation lives in three files
- A service method is long and mixes validation, rules, and I/O
- Deciding what the steps of an operation are
- Turning an event-storming result into code

Not for: designing the data itself, which is
[modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md).

## Core rules

1. **Start with the end points.** Write the workflow's own signature
   before its steps: command in, `Result` of events out.
2. **One type per stage.** The output of a step is a type that did not
   exist before it ran, so later steps cannot receive unvalidated data.
3. **Each step is total.** Everything that can go wrong is in the return
   type. No exceptions, no nulls, no hidden failure.
4. **Effects at the ends only.** Steps that need the world take their
   capability as a parameter; the shell supplies it. See
   [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md).
5. **Steps are named in the domain's words**, and each one is meaningful
   to a domain expert.
6. **The pipeline is the documentation.** Reading the composed function
   should tell a reader what the business process is.
7. **Emit events, do not perform them.** The workflow returns what
   happened; the shell decides who is told.

## Pattern

Scattered across layers:

```text
-- controller: parses, calls service, maps errors, sends email
-- service: validates, calls two repositories, prices, saves, publishes
-- repository: also validates, because the service sometimes forgets
```

Nobody can state the process without reading three files, and the
validation rule now has two homes.

As a pipeline:

```text
type ConfirmBookingWorkflow =
  UnvalidatedBooking
    -> AsyncResult<List<ConfirmBookingEvent>, ConfirmBookingError>

confirmBooking checkTreatment getPrice =
  validateBooking checkTreatment
    >=> priceBooking getPrice
    >=> acknowledgeBooking
    >=> createEvents
```

Four steps, each with its own types:

```text
validateBooking :
  CheckTreatmentExists -> UnvalidatedBooking
    -> Result<ValidatedBooking, ValidationError>

priceBooking :
  GetTreatmentPrice -> ValidatedBooking -> Result<PricedBooking, PricingError>

acknowledgeBooking : PricedBooking -> AcknowledgedBooking
createEvents : AcknowledgedBooking -> List<ConfirmBookingEvent>
```

The signature of `confirmBooking` states the whole contract. The steps state
the process. Nothing else in the system needs to know the order of them.

## Anatomy

| Part         | Rule                                          |
| ------------ | --------------------------------------------- |
| Command      | A record named as an imperative               |
| Input type   | Untrusted, from the edge                      |
| Stage types  | One per completed step, never reused          |
| Dependencies | Function types, passed as parameters          |
| Error type   | One choice type for the whole workflow        |
| Output       | A list of events, or one event type           |
| Composition  | `>=>` for fallible steps, `>>` for total ones |

More on each in
[pipeline-anatomy.md](references/pipeline-anatomy.md).

## Choosing the steps

Ask the domain expert to describe the process, and take the steps from
their sentences. Then check each candidate step against three tests:

1. **Would an expert name it?** If not, it is an implementation detail,
   and belongs inside another step.
2. **Does it change the type?** A step whose input and output types are
   the same is either a validation that should return a narrower type, or
   not a step.
3. **Could it fail for its own reason?** If two adjacent steps always
   fail together and for the same reason, they are one step.

Typical shapes: validate, enrich, decide, price or calculate, record,
acknowledge. Not every workflow has all of them, and inventing empty ones
is how pipelines become ceremony.

## Effects in the middle

Some steps genuinely need I/O: a stock check, a price lookup. Two ways to
handle it, in order of preference:

**Pass the capability in.** The step stays a function of its inputs; the
effect is a parameter.

```text
validateBooking :
  CheckTreatmentExists -> UnvalidatedBooking
    -> AsyncResult<ValidatedBooking, ValidationError>
```

**Split around the effect.** Fetch first in the shell, then run a pure
step over the fetched data. Better when the fetch is one lookup that the
whole workflow needs.

```text
-- shell fetches, core decides
priceBooking : PriceList -> ValidatedBooking -> Result<PricedBooking, Error>
```

See [effect-alignment.md](references/effect-alignment.md) for how to keep
the types consistent when some steps are async and others are not.

## Red flags

- The workflow function has no signature that states its failures
- A step takes and returns the same type
- Validation happens in two steps of the same pipeline
- A step writes to the database and also decides business rules
- The order of steps is enforced only by the order of the lines
- The workflow returns nothing and sends notifications itself
- Steps named `process`, `handle`, `execute`, `doWork`

## Common mistakes

- **Making steps too small.** Ten steps of two lines each is ceremony;
  the reader now assembles the process from fragments.
- **Reusing one type through the whole pipeline.** Then no step is
  protected from receiving unprepared data.
- **Letting a step perform side effects it decided on.** Return the
  decision, let the shell act, or the workflow cannot be tested or
  retried.
- **One error type per step, unified by casting.** One error choice type
  for the workflow, with a case per failure, keeps callers sane.
- **Putting the pipeline in the controller.** The controller translates
  transport; the workflow is domain code and belongs with the domain.

## Related skills

- [composing-functions](../composing-functions/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)

## Further reading

- [pipeline-anatomy.md](references/pipeline-anatomy.md) details each part
  and how to size the steps.
- [effect-alignment.md](references/effect-alignment.md) covers mixing
  pure, fallible and asynchronous steps in one pipeline.
- [worked-example.md](references/worked-example.md) builds a complete
  workflow end to end, from event storming output to composed code.
