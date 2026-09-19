# Contexts and Ecto

## A context is a bounded context

```text
lib/clinic/
  scheduling/          # owns slots, holds, appointments
  billing/             # owns invoices, payments
  records/             # owns patient notes
```

Each directory is a bounded context in the sense of
[capturing-the-domain](../../capturing-the-domain/SKILL.md): its own
vocabulary, its own structs, and a public module that other contexts
call.

Rules that make it real rather than cosmetic:

1. **No context aliases another's schema.** Cross-context calls go
   through the public context module and exchange plain structs or
   primitives.
2. **The same word may mean different things.** Scheduling's `Patient`
   holds contact details; billing's holds tax status. Two structs, one
   identifier.
3. **No cross-context Ecto associations.** A `belongs_to` across a
   context boundary welds the two schemas together and makes preloading
   a coupling mechanism.
4. **Translate at the edge.** When one context consumes another's data,
   it maps it into its own struct, in one function.

## Schemas are boundary artefacts

An Ecto schema describes a table. It carries nullable columns,
associations, and `__meta__`, and it changes when the database changes.
That is a DTO, not a domain model.

```elixir
# storage
defmodule Clinic.Scheduling.Store.AppointmentRow do
  use Ecto.Schema

  schema "appointments" do
    field :patient_id, Ecto.UUID
    field :status, :string
    field :held_at, :utc_datetime
    field :confirmed_at, :utc_datetime
    timestamps()
  end
end

# mapping, the only place both shapes appear
@spec to_domain(AppointmentRow.t()) ::
        {:ok, Appointment.t()} | {:error, :corrupt_row}
def to_domain(%AppointmentRow{status: "held", held_at: at} = row)
    when not is_nil(at) do
  {:ok, %Appointment{...status: {:held, at}}}
end

def to_domain(_), do: {:error, :corrupt_row}
```

`to_domain` returns a result because the database can hold rows the
domain forbids, usually written by an earlier version of the code.
Defaulting instead of failing reintroduces the illegal state. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

For a small project where the schema and the domain type genuinely
coincide, using the schema directly is a reasonable trade. Make it a
decision, note it, and revisit it the first time a nullable column
appears for storage reasons alone.

## Changesets as boundary parsers

A changeset is applicative validation with a good error report: it
accumulates every problem and attaches each to its field.

```elixir
def booking_changeset(params) do
  %BookingParams{}
  |> cast(params, [:patient_id, :doctor_id, :slot_id, :reason])
  |> validate_required([:patient_id, :doctor_id, :slot_id])
  |> validate_length(:reason, max: 200)
  |> validate_format(:patient_id, @uuid)
end
```

What belongs in a changeset:

- Presence, format, length, ranges, and casting
- Uniqueness constraints backed by a database index
- Anything a form should report field by field

What does not:

- Rules that need other aggregates or the clock
- Decisions with business consequences, such as pricing or eligibility
- Anything you would want to test without Ecto

Those belong in the domain, where they are pure functions over structs.
See
[when-to-validate-instead.md](../../making-illegal-states-unrepresentable/references/when-to-validate-instead.md).

## Commands and queries

Separate the write path from the read path.

```elixir
# write: goes through the domain
def book_appointment(params, deps)

# read: queries directly, returns a view struct
def list_upcoming(doctor_id) :: [AppointmentListItem.t()]
```

Reconstructing a domain struct to render a list is wasted work and
couples the screen to the domain's shape. A purpose-built view struct is
the right answer, and the invariants still live on the write path where
they matter.

## Transactions

```elixir
Repo.transaction(fn ->
  with {:ok, appt} <- load(id),
       {:ok, confirmed} <- Appointment.confirm(appt, now),
       {:ok, _} <- save(confirmed) do
    confirmed
  else
    {:error, reason} -> Repo.rollback(reason)
  end
end)
```

One aggregate per transaction. The pure function in the middle knows
nothing about the transaction and cannot start or commit one. See
[enforcing-consistency-boundaries](../../enforcing-consistency-boundaries/SKILL.md).

For concurrent updates, use `Ecto.Changeset.optimistic_lock/2` rather
than a database lock: read with a version, apply the pure transition,
write conditionally, and re-read on conflict.

## Dependencies

Pass capabilities as functions, not modules, so tests need no mocking
library and no global configuration.

```elixir
@type deps :: %{
        find_patient: (Patient.Id.t() -> {:ok, Patient.t()} | {:error, term}),
        hold_slot: (Slot.Id.t() -> {:ok, Hold.t()} | {:error, term}),
        now: (-> DateTime.t())
      }
```

A behaviour with a mock library is the common Elixir alternative. It
works, and it is heavier: a behaviour is an interface with several
members, which is the wide-dependency smell from
[applying-solid-functionally](../../applying-solid-functionally/SKILL.md).
Prefer function values for one or two capabilities, and reserve
behaviours for genuinely swappable adapters.
