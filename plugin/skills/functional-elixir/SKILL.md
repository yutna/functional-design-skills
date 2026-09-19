---
name: functional-elixir
description: Use when designing Elixir structs, ok and error tuples, or `with` pipelines, and whether a GenServer, a supervision tree, or letting a process crash is the right answer.
license: MIT
metadata:
  pack: functional-design-skills
  version: 2.0.1
---

# Functional Elixir

## Overview

Elixir gives immutability, pattern matching, and pipelines by default, so
much of this pack is already the idiom. What it does not give is a
compiler that rejects an illegal state, so the enforcement lives in
structs with enforced keys, constructor functions, and Dialyzer.

It also gives processes, which are the only thing in the language that
holds state over time. Deciding what is a process is therefore the same
decision as deciding what is mutable, and it is a design question rather
than a performance one.

This pack covers the language and OTP. Phoenix, Ecto and LiveView are in
[functional-elixir-phoenix](../functional-elixir-phoenix/SKILL.md).

## When to use

- An Elixir project, with or without a web framework
- Designing a struct, a tagged tuple, or a constructor
- Composing a pipeline that can fail
- Deciding whether something should be a process, and what supervises it
- Reviewing Elixir against the core design rules

Not for: Erlang runtime tuning, release configuration, or Phoenix.

## Notation mapping

| Neutral notation    | Elixir                                |
| ------------------- | ------------------------------------- |
| Record type         | `defstruct` with `@enforce_keys`      |
| Choice type         | Tagged tuple, or a struct per case    |
| Single-case wrapper | A struct with one field, plus `new/1` |
| `Result<T, E>`      | `{:ok, term}` or `{:error, term}`     |
| `Option<T>`         | `{:ok, term}` or `:error`, or `nil`   |
| `>=>` composition   | `with` expression                     |
| `>>` composition    | The pipe operator                     |
| Exhaustive match    | Function clauses with no catch-all    |
| Boundary parse      | A `new/1` function                    |
| Mutable cell        | A process, and nothing else           |

## Core rules

1. Rule. **`@enforce_keys` on every domain struct.** A struct with optional
   keys is a record of maybes.
2. Rule. **Construct through `new/1`**, returning `{:ok, struct}` or
   `{:error, reason}`. Never build a domain struct with a literal outside
   its module.
3. Default. **Tagged tuples for choices**, matched by function clauses
   rather than by `case` inside one clause.
4. Rule. **No catch-all clause on a domain function.** An unmatched value
   should raise `FunctionClauseError`, which is a loud, findable bug.
5. Default. **`with` for pipelines that can fail**, and an `else` that
   names each failure rather than one catch-all.
6. Default. **The default is no process.** Reach for one when something
   must be able to fail without taking the rest down with it, or when
   work must be serialised per entity. A GenServer around a value with
   one caller is a mutable variable with a mailbox.
7. Rule. **Crash on a bug, return a tuple on a business outcome.** A
   slot already taken is `{:error, :slot_unavailable}`. A nil that
   should have been impossible is a crash, and the supervisor's job.
8. Default. **`@spec` on every public function, and run Dialyzer in CI.**
   Without it the specs are comments.

## Pattern

```elixir
defmodule Clinic.Scheduling.Appointment do
  alias Clinic.Scheduling.{Doctor, Patient, Slot}

  @enforce_keys [:id, :patient, :doctor, :slot, :status]
  defstruct [:id, :patient, :doctor, :slot, :status]

  @type status ::
          {:held, DateTime.t()}
          | {:confirmed, DateTime.t()}
          | {:cancelled, String.t(), DateTime.t()}

  @type t :: %__MODULE__{
          id: __MODULE__.Id.t(),
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
[functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md).

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
[functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md).
Name each failure in `else`; a single `_ -> {:error, :failed}` throws
away everything the error channel was carrying.

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
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md).
Note that Ecto's `:map` column and embedded schemas are exactly this
split expressed in the database.

## Processes

A GenServer is shell, not core: the decision it makes should be a pure
function it calls, and the process should hold only what genuinely has
to outlive a request. Supervision is where failure is designed rather
than configured, and a restart returns a process to its initial state
and nothing more. See [otp.md](references/otp.md).

## Red flags

- A struct with no `@enforce_keys`
- A domain function with a catch-all `_` clause
- `with ... else _ -> {:error, :error}`
- A GenServer holding state that a database or a caller could hold
- A supervision strategy chosen without saying what depends on what
- `try/rescue` around domain logic
- `nil` used to mean three different things
- `@spec` absent, or Dialyzer not run

## Common mistakes

- **A GenServer per entity by default.** Use one when the state has a
  lifecycle, a mailbox, or supervision needs. Otherwise it is a mutable
  variable with a process around it.
- **Catch-all clauses.** They convert a missing case into a wrong answer.
- **`{:error, :error}`.** An error atom with no information forces the
  caller to guess.
- **Expecting a restart to restore work in flight.** It restores the
  initial state. Messages in the mailbox die with the process, and
  effects already performed stay performed.
- **Using a struct where the keys come from outside.** Config, tenant
  and admin-defined shapes are the generic route; see the section above.

## Related skills

- [functional-modeling-state-machines](../functional-modeling-state-machines/SKILL.md)
- [functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-making-effects-reliable](../functional-making-effects-reliable/SKILL.md)
- [functional-elixir-phoenix](../functional-elixir-phoenix/SKILL.md)

## Further reading

- [types-and-structs.md](references/types-and-structs.md) covers structs,
  wrappers, tagged tuples, typespecs, and Dialyzer.
- [otp.md](references/otp.md) covers where stateful processes belong,
  processes as isolation boundaries, supervision as failure design,
  what a restart cannot restore, and testing without sleeping.
