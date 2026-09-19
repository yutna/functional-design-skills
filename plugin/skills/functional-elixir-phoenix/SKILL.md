---
name: functional-elixir-phoenix
description: Use when applying functional design in Elixir or Phoenix, including structs and typespecs, ok and error tuples, Ecto changesets, contexts, and OTP.
---

# Functional Elixir and Phoenix

## Overview

Elixir gives immutability, pattern matching, and pipelines by default, so
much of this pack is already the idiom. What it does not give is a
compiler that rejects an illegal state, so the enforcement lives in
structs with enforced keys, constructor functions, changesets, and
Dialyzer.

Phoenix contributes a boundary that maps cleanly onto the core and shell
split: contexts hold the domain, controllers and LiveViews hold the
shell, and OTP holds whatever must be stateful.

## When to use

- An Elixir or Phoenix project
- Designing a context, a schema, or a changeset
- Deciding what belongs in a GenServer
- Reviewing Elixir against the core design rules

Not for: Erlang-specific runtime tuning or release configuration.

## Notation mapping

| Neutral notation    | Elixir                                   |
| ------------------- | ---------------------------------------- |
| Record type         | `defstruct` with `@enforce_keys`         |
| Choice type         | Tagged tuple, or a struct per case       |
| Single-case wrapper | A struct with one field, plus `new/1`    |
| `Result<T, E>`      | `{:ok, term}` or `{:error, term}`        |
| `Option<T>`         | `{:ok, term}` or `:error`, or `nil`      |
| `>=/>` composition  | `with` expression                        |
| `>>` composition    | The pipe operator                        |
| Exhaustive match    | Function clauses with no catch-all       |
| Boundary parse      | An Ecto changeset, or a `new/1` function |

## Core rules

1. **`@enforce_keys` on every domain struct.** A struct with optional
   keys is a record of maybes.
2. **Construct through `new/1`**, returning `{:ok, struct}` or
   `{:error, reason}`. Never build a domain struct with a literal outside
   its module.
3. **Tagged tuples for choices**, matched by function clauses rather than
   by `case` inside one clause.
4. **No catch-all clause on a domain function.** An unmatched value
   should raise `FunctionClauseError`, which is a loud, findable bug.
5. **`with` for pipelines that can fail**, and an `else` that names each
   failure rather than one catch-all.
6. **Contexts are bounded contexts**, not folders. Each owns its structs
   and exposes functions; none reaches into another's schemas.
7. **`@spec` on every public function, and run Dialyzer in CI.** Without
   it the specs are comments.

## Pattern

```elixir
defmodule Clinic.Scheduling.Appointment do
  @enforce_keys [:id, :patient, :doctor, :slot, :status]
  defstruct [:id, :patient, :doctor, :slot, :status]

  @type status ::
          {:held, DateTime.t()}
          | {:confirmed, DateTime.t()}
          | {:cancelled, String.t(), DateTime.t()}

  @type t :: %__MODULE__{
          id: Appointment.Id.t(),
          patient: Patient.Id.t(),
          doctor: Doctor.Id.t(),
          slot: Slot.Id.t(),
          status: status()
        }

  @spec confirm(t(), DateTime.t()) ::
          {:ok, t()} | {:error, :not_held | :hold_expired}
  def confirm(%__MODULE__{status: {:held, held_at}} = appt, now) do
    if DateTime.diff(now, held_at) <= 120 do
      {:ok, %{appt | status: {:confirmed, now}}}
    else
      {:error, :hold_expired}
    end
  end

  def confirm(%__MODULE__{}, _now), do: {:error, :not_held}
end
```

The first clause matches only a held appointment, so an illegal
transition cannot reach the body. The status tuple carries the timestamp
that belongs to each state, which removes the nullable
`confirmed_at`, `cancelled_at` columns from the domain type. See
[modeling-state-machines](../modeling-state-machines/SKILL.md).

## Pipelines with `with`

```elixir
@spec book(map(), deps()) ::
        {:ok, Appointment.t()} | {:error, booking_error()}
def book(params, deps) do
  with {:ok, command} <- BookCommand.new(params),
       {:ok, patient} <- deps.find_patient.(command.patient),
       {:ok, hold} <- deps.hold_slot.(command.slot),
       {:ok, appt} <- Appointment.new(command, patient, hold) do
    {:ok, appt}
  else
    {:error, :patient_not_found} = e -> e
    {:error, :slot_unavailable} = e -> e
    {:error, %Ecto.Changeset{} = cs} -> {:error, {:invalid, cs}}
  end
end
```

`with` is the railway composition of
[handling-errors-with-results](../handling-errors-with-results/SKILL.md).
Name each failure in `else`; a single `_ -> {:error, :failed}` throws
away everything the error channel was carrying.

## Contexts and Ecto

A context is a bounded context: its own structs, its own vocabulary, and
a public surface other contexts call. Schemas and changesets are
boundary artefacts, not the domain model.

```elixir
# boundary: parses and validates untrusted input
def changeset(params) do
  %BookingParams{}
  |> cast(params, [:patient_id, :doctor_id, :slot_id, :reason])
  |> validate_required([:patient_id, :doctor_id, :slot_id])
  |> validate_length(:reason, max: 200)
end

# domain: receives values that are already valid
def book(%BookCommand{} = command, deps), do: ...
```

A changeset accumulates every error at once, which is what a form needs.
Past the changeset, the domain works with structs whose invariants hold.
See [contexts-and-ecto.md](references/contexts-and-ecto.md).

## Structs or plain maps

Elixir idiom sits closer to plain maps than most of this pack assumes,
and that is often right — but decide it per value, not by habit.

A struct is the modelled route: it gives the value a name, makes
`%Booking{}` pattern matches fail loudly on the wrong type, and gives
Dialyzer something to check. A bare map is the generic route, and it is
correct when the keys come from config, from a tenant, or from an admin,
or when the map is only stored and forwarded.

The usual answer is a struct whose one field is a map: the envelope
modelled, the varying part generic. See
[choosing-types-or-plain-data](../choosing-types-or-plain-data/SKILL.md).
Note that Ecto's `:map` column and embedded schemas are exactly this
split expressed in the database.

## Red flags

- A struct with no `@enforce_keys`
- A domain function with a catch-all `_` clause
- `with ... else _ -> {:error, :error}`
- Ecto schemas passed into business logic as the domain model
- Business rules inside a controller, a LiveView, or a query
- A GenServer holding state that a database or a caller could hold
- `nil` used to mean three different things
- `@spec` absent, or Dialyzer not run

## Common mistakes

- **Treating the Ecto schema as the domain type.** It carries nullable
  columns, associations, and `__meta__`. Map it into a domain struct.
- **Contexts as folders.** A context that exposes another's schema is one
  context with two names.
- **Rules in the changeset.** Format and presence belong there; "a
  discount over 20% needs approval" belongs in the domain, where it can
  be tested without Ecto.
- **A GenServer per entity by default.** Use one when the state has a
  lifecycle, a mailbox, or supervision needs. Otherwise it is a mutable
  variable with a process around it.
- **Catch-all clauses.** They convert a missing case into a wrong answer.
- **`{:error, :error}`.** An error atom with no information forces the
  caller to guess.

## Related skills

- [modeling-state-machines](../modeling-state-machines/SKILL.md)
- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- [capturing-the-domain](../capturing-the-domain/SKILL.md)

## Further reading

- [types-and-structs.md](references/types-and-structs.md) covers structs,
  wrappers, tagged tuples, typespecs, and Dialyzer.
- [contexts-and-ecto.md](references/contexts-and-ecto.md) covers
  contexts as bounded contexts and changesets as boundary parsers.
- [otp-and-liveview.md](references/otp-and-liveview.md) covers where
  stateful processes belong and how LiveView maps onto the split.
