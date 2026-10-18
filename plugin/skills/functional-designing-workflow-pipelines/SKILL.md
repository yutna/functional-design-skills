---
name: functional-designing-workflow-pipelines
description: Use when implementing a use case, command handler, or business process, or when logic for one operation is scattered across services and layers.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.3.0
---

# Designing Workflow Pipelines

**In this pack:** [how much design a task warrants](../functional-design/references/calibration.md),
[the notation](../functional-design/references/notation.md), and
[syntax per language](../functional-design/SKILL.md#language-packs).

## Overview

A workflow decides one business process: a command comes in, with the
values a handler read for it, and events come out. Modelled as a
pipeline, it is a sequence of small total functions, each with its own
input and output types, composed into one function whose signature
states the whole contract.

This shape is what makes a domain model executable. The types along the
pipeline record which checks have already happened, so no step re-checks;
the pipeline is pure from end to end, so the only places an effect can
be are before it and after it; and the whole use case can be read in one
place instead of being assembled in a reader's head from four services.
A workflow whose reads cannot all come first is two such pipelines, with
the read between them.

## When to use

- Implementing a use case, endpoint handler, job, or message consumer
- Business logic for one operation lives in three files
- A service method is long and mixes validation, rules, and I/O
- Deciding what the steps of an operation are
- Turning an event-storming result into code

Not for: designing the data itself, which is
[functional-modeling-with-algebraic-types](../functional-modeling-with-algebraic-types/SKILL.md).

## Core rules

1. Default. **Start with the end points.** Write the workflow's own signature
   before its steps: the command and the values read for it in, `Result`
   of events out. A decision nothing can refuse returns its events with
   no `Result` around them.
2. Rule. **One type per stage.** The output of a step is a type that did not
   exist before it ran, so later steps cannot receive unvalidated data. A step
   whose output would be the type it took is either a validation that should
   return a narrower type, or not a step: fold it into its neighbour.
3. Rule. **Each step is total.** Every failure the business can name is in
   the return type, never thrown and never a null.
4. Rule. **A workflow performs nothing.** What its steps need from the
   world is read by the handler and passed in as values, and what it
   decides is written by the handler after it returns. Where a read
   cannot come first, the pipeline is cut there into two pure functions
   and the handler reads between them. See
   [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md).
5. Default. **Steps are named in the domain's words**, and each one is
   meaningful to a domain expert. The sub-steps inside one step are outside
   this: they are private to it, appear in no workflow's signature, and are
   named for what they do.
6. Default. **The pipeline is the documentation.** Reading the composed function
   should tell a reader what the business process is. Where the pipeline is cut
   in two around a read, the handler's chain is what reads as the process, and
   each half reads as its part of it.
7. Rule. **Return events, not actions.** A workflow returns the events it
   decided, each a fact that is true once the decision is saved. An
   event carries what changed, as `BookingConfirmed` carries the
   confirmed booking, and the handler saves the event and the state in
   one transaction. What follows from an event, a message to send or a
   schedule to update, is the work of whichever handler receives it.

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
confirmBooking :
  Catalogue -> Instant -> UnvalidatedBooking
    -> Result<List<ConfirmBookingEvent>, ConfirmBookingError>

confirmBooking catalogue now unvalidated =
  validateBooking catalogue unvalidated
    |> mapError Validation
    |> bind (priceBooking catalogue >> mapError Pricing)
    |> map (issueConfirmation now)
    |> map (\booking -> [BookingConfirmed booking])
```

Three steps, each with its own types, and a last line that reports what
was decided:

```text
validateBooking :
  Catalogue -> UnvalidatedBooking
    -> Result<ValidatedBooking, NonEmptyList<ValidationError>>

priceBooking :
  Catalogue -> ValidatedBooking -> Result<PricedBooking, PricingError>

issueConfirmation : Instant -> PricedBooking -> ConfirmedBooking

type ConfirmBookingError =
  | Validation of NonEmptyList<ValidationError>
  | Pricing of PricingError
```

The signature of `confirmBooking` states the whole contract. The steps state
the process. Nothing else in the system needs to know the order of them.

`Catalogue` and `Instant` are values. The catalogue is the treatments
the clinic offers and their prices, read before the workflow runs, and
the instant is the one clock reading taken for this command.

## Anatomy

| Part         | Rule                                          |
| ------------ | --------------------------------------------- |
| Command      | The caller's unchecked input, as a record     |
| Values read  | Parameters, read by the handler beforehand    |
| Stage types  | One per completed step, never reused          |
| Error type   | One choice type for the whole workflow        |
| Output       | The events it decided, usually as a list      |
| Composition  | `bind` for a step that can fail, `map` if not |

More on each in
[pipeline-anatomy.md](references/pipeline-anatomy.md).

## Choosing the steps

Ask the domain expert to describe the process, and take the steps from
their sentences. Where there is no expert to ask,
[working-alone.md](../functional-design/references/working-alone.md)
says what stands in for one. Then check each candidate step against
three tests:

1. **Would an expert name it?** If not, it is an implementation detail,
   and belongs inside another step.
2. **Does it change the type?** A step whose input and output types are
   the same is either a validation that should return a narrower type, or
   not a step.
3. **Could it fail for its own reason?** If two adjacent steps always
   fail together and for the same reason, they are one step.

Typical shapes: validate, decide, price or calculate, acknowledge. Not
every workflow has all of them, and inventing empty ones is how
pipelines become ceremony. Enriching is not on the list because it is a
read the handler makes before the workflow, and recording is the write
it makes after.

## Effects around the pipeline

No step performs an effect, and no step takes a capability. A step that
seems to need I/O, a slot availability check or a price lookup, needs a
value, and the handler reads that value first.

```text
-- shell: the handler reads, calls the workflow, and writes
type ConfirmBookingFailure =
  | Rejected of ConfirmBookingError
  | Unavailable of StoreError

handleConfirmBooking :
  Pool -> Instant -> UnvalidatedBooking
    -> AsyncResult<List<ConfirmBookingEvent>, ConfirmBookingFailure>
handleConfirmBooking pool now unvalidated =
  loadCatalogue pool                                    -- read
    |> mapError Unavailable
    |> bind (\catalogue ->
         confirmBooking catalogue now unvalidated       -- decide
           |> mapError Rejected)
    |> bind (saveEvents pool >> mapError Unavailable)   -- write
```

The handler's failure type has two cases because two different things
can go wrong: the rules refused the booking, or storage could not be
reached. The workflow's own error type knows only the first.
`saveEvents` writes the booking and its events in one transaction and
hands the events back.

Where a read cannot come first, as when a rule picks which catalogue
applies, cut the pipeline at that point and let the handler read between
the two halves. Each half is then a pure pipeline with a signature and
an error type of its own, and the handler lifts both into its failure
type. Rule 1 of
[functional-parameterizing-dependencies](../functional-parameterizing-dependencies/SKILL.md)
says when a read cannot come first, and
[worked-example.md](references/worked-example.md) builds a workflow that
is cut this way.
[effect-alignment.md](references/effect-alignment.md) covers how a
handler's chain keeps its types consistent.

## Red flags

- A workflow that can refuse, with no signature that states its failures
- A step, or the workflow, takes a capability or has an effect type
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
- **Unifying step errors by casting instead of lifting.** Each step
  keeps its own narrow error, and the pipeline lifts each into the
  workflow's one choice type with `mapError`, a case per failure.
- **Putting the pipeline in the controller.** The controller translates
  transport; the workflow is domain code and belongs with the domain.

## Related skills

- [functional-composing-functions](../functional-composing-functions/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)
- [functional-parameterizing-dependencies](../functional-parameterizing-dependencies/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)

## Further reading

- [pipeline-anatomy.md](references/pipeline-anatomy.md) details each part
  and how to size the steps.
- [effect-alignment.md](references/effect-alignment.md) covers joining
  steps that can fail with steps that cannot, and the handler's chain of
  reads and writes.
- [worked-example.md](references/worked-example.md) builds a complete
  workflow end to end, from event storming output to composed code.
