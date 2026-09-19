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

## Adapting functions to the tracks

Functions come in four shapes. Each needs a different adapter to join a
two-track pipeline.

| Function shape               | Name      | Adapter            |
| ---------------------------- | --------- | ------------------ |
| `A -> B`                     | one-track | `map`              |
| `A -> Result<B, E>`          | switch    | `bind`             |
| `Result<A,E> -> Result<B,E>` | two-track | use directly       |
| Throws, returns nothing      | dead-end  | wrap into a switch |

```text
-- one-track function joined with map
priced |> map addTax

-- switch function joined with bind
raw |> bind validate

-- dead-end function made into a switch
save : Booking -> Unit        -- throws
saveSafely : Booking -> Result<Booking, SaveError>
saveSafely o = tryCatch (\_ -> save o; o) toSaveError
```

The dead-end adapter returns its input on success, so the value continues
down the track. This is the standard way to insert a logging or storage
step without breaking the chain.

## Composing switches

```text
confirmBooking = validate >=> price >=> acknowledge
```

`>=>` is bind in operator form. It is associative, so the grouping never
matters, and it is the reason a pipeline can be assembled from any number
of steps without nesting.

## Aligning error types

Each step has its own narrow error type. Lift each into the workflow's
type at composition, not inside the step.

```text
type ConfirmBookingError =
  | Validation of ValidationError
  | Pricing of PricingError

confirmBooking =
  (validate |> mapError Validation)
    >=> (price |> mapError Pricing)
```

Steps stay reusable in other workflows, and the caller matches on one
type.

## Working with collections

```text
-- one bad treatment fails the booking
traverse validateTreatment treatments : Result<List<ValidTreatment>, TreatmentError>

-- report every bad treatment
traverseAll validateTreatment treatments
  : Result<List<ValidTreatment>, NonEmptyList<TreatmentError>>
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
[effect-alignment.md](../../designing-workflow-pipelines/references/effect-alignment.md).

## What the model does not solve

- **Cleanup on failure.** If a step acquired something, the release must
  be arranged by the shell, with a scoped resource mechanism, not by the
  track.
- **Partial success.** "Three of five imported" is not one `Result`; it
  is a report type with successes and failures inside it. Model it
  explicitly.
- **Failures that must not be a value.** A corrupted process state is not
  a business outcome. Crash.
