# The Two-Track Model

Picture two parallel tracks. The success track carries values forward
through every step. The failure track carries an error straight to the
end, bypassing the remaining steps. Every function that can fail is a
switch: it takes a value on the success track and either keeps it there
or diverts it.

```text
              +--> validate --+--> price --+--> acknowledge --> Ok
input --------|               |            |
              +--------- error track ---------------------> Error
```

## Contents

- [Adapting functions to the tracks](#adapting-functions-to-the-tracks)
- [Composing switches](#composing-switches)
- [Aligning error types](#aligning-error-types)
- [Working with collections](#working-with-collections)
- [Recovering onto the success track](#recovering-onto-the-success-track)
- [Effects on the tracks](#effects-on-the-tracks)
- [What the model does not solve](#what-the-model-does-not-solve)

## Adapting functions to the tracks

Functions come in four shapes. Each needs a different adapter to join a
two-track pipeline.

| Function shape               | Name      | Adapter            |
| ---------------------------- | --------- | ------------------ |
| `A -> B`                     | one-track | `map`              |
| `A -> Result<B, E>`          | switch    | `bind`             |
| `Result<A,E> -> Result<B,E>` | two-track | use directly       |
| Throws on some input         | dead-end  | wrap into a switch |

```text
-- one-track function joined with map
priced |> map addTax

-- switch function joined with bind
validated |> bind price

-- dead-end function made into a switch
parseDate : String -> Date    -- throws on text that is not a date
readDate : String -> Result<Date, DateError>
readDate text = tryCatch (\_ -> parseDate text) toDateError
```

The wrapped function is pure and foreign, so wrapping it changes nothing
but the type. Its result continues down the track on success. This is
the standard way to bring a function that throws into a chain, and it is
done once, at the boundary.

## Composing switches

```text
confirmBooking = validate >=> price >=> acknowledge
```

`>=>` joins two functions the way `bind` chains a value onto one. It is
associative, so the grouping never matters, and it is the reason a
pipeline can be assembled from any number of steps without nesting.

## Aligning error types

Each step has its own narrow error type. Lift each into the workflow's
type at composition, not inside the step.

```text
type ConfirmBookingError =
  | Validation of NonEmptyList<ValidationError>
  | Pricing of PricingError

confirmBooking =
  (validate >> mapError Validation)
    >=> (price >> mapError Pricing)
```

Steps stay reusable in other workflows, and the caller matches on one
type.

## Working with collections

```text
-- one bad treatment fails the booking
traverse validateTreatment treatments
  : Result<List<ValidTreatment>, TreatmentInvalid>

-- report every bad treatment
traverseAll validateTreatment treatments
  : Result<List<ValidTreatment>, NonEmptyList<TreatmentInvalid>>
```

Pick by who reads the errors. A machine-to-machine import usually wants
every problem in one response; a step inside a decision usually wants the
first.

## Recovering onto the success track

Sometimes a failure has a legitimate fallback.

```text
-- supply a default for one specific failure
orElse : (E -> Result<A, E2>) -> Result<A, E> -> Result<A, E2>

priceFromCache |> orElse (\_ -> priceFromService)
```

Two rules: recover from named cases, never from "any failure"; and do it
where the fallback is a business decision, not deep inside a step.

## Effects on the tracks

When steps are asynchronous, the shape becomes `AsyncResult`, and the
same operators apply with an async-aware bind. Keep pure steps pure and
lift them at composition; do not make a function asynchronous because its
neighbour is. See
[effect-alignment.md](../../functional-designing-workflow-pipelines/references/effect-alignment.md).

## What the model does not solve

- **Cleanup on failure.** If a step acquired something, the release must
  be arranged by the shell, with a scoped resource mechanism, not by the
  track.
- **Partial success.** "Three of five imported" is not one `Result`; it
  is a report type with successes and failures inside it. Model it
  explicitly.

  ```text
  type ImportReport = {
    imported: List<PatientId>,
    failed: List<RowFailure>,
  }
  ```

  The step that runs the rows builds the report and returns it as a
  success. The caller decides from the report whether the whole counts
  as failed, for example when `imported` is empty or when `failed` is
  longer than the limit the requirement states.
- **Failures that must not be a value.** A corrupted process state is not
  a business outcome. Crash.
