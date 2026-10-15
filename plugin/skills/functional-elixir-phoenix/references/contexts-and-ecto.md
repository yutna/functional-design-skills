# Contexts and Ecto

## Contents

- [A context is a bounded context](#a-context-is-a-bounded-context)
- [Schemas are boundary artefacts](#schemas-are-boundary-artefacts)
- [Changesets as boundary parsers](#changesets-as-boundary-parsers)
- [Commands and queries](#commands-and-queries)
- [Transactions](#transactions)
- [Dependencies](#dependencies)

## A context is a bounded context

```text
lib/clinic/
  scheduling/          # owns slots, holds, appointments
  billing/             # owns invoices, payments
  records/             # owns patient notes
```

Each directory is a bounded context in the sense of
[functional-capturing-the-domain](../../functional-capturing-the-domain/SKILL.md):
its own vocabulary, its own structs, and a public module that other contexts
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

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  schema "appointments" do
    field :patient_id, Ecto.UUID
    field :doctor_id, Ecto.UUID
    field :slot_id, Ecto.UUID
    field :status, :string
    field :held_at, :utc_datetime
    field :confirmed_at, :utc_datetime
    field :cancelled_at, :utc_datetime
    field :cancel_reason, :string
    field :lock_version, :integer, default: 1
    timestamps()
  end

  @type t :: %__MODULE__{}
end

# mapping, the only place both shapes appear
@spec to_domain(AppointmentRow.t()) ::
        {:ok, Appointment.t()} | {:error, :corrupt_row}
def to_domain(%AppointmentRow{status: "held", held_at: at} = row)
    when not is_nil(at) do
  Appointment.restore(%{
    id: row.id,
    patient: row.patient_id,
    doctor: row.doctor_id,
    slot: row.slot_id,
    status: {:held, at}
  })
end

# the other statuses get a clause each

def to_domain(_), do: {:error, :corrupt_row}
```

`to_domain` returns a result because the database can hold rows the
domain forbids, usually written by an earlier version of the code.
Defaulting instead of failing reintroduces the illegal state. The struct
is still never built outside its module: `Appointment.restore/1` is the
constructor for a stored appointment, so a rule added to the module later
binds stored rows as well as new input. See
[functional-crossing-io-boundaries](../../functional-crossing-io-boundaries/SKILL.md).

A screen that only reads, and enforces no rule, may use the schema's
rows as they are;
[worked-read-model.md](../../functional-crossing-io-boundaries/references/worked-read-model.md)
says when. Whatever a rule is enforced on goes through the mapping, even
while the two types look identical.

## Changesets as boundary parsers

A changeset is applicative validation with a good error report: it
accumulates every problem and attaches each to its field.

```elixir
@spec booking_changeset(map()) :: Ecto.Changeset.t()
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
[when-to-validate-instead.md](../../functional-making-illegal-states-unrepresentable/references/when-to-validate-instead.md).

## Commands and queries

Separate the write path from the read path.

```elixir
# write: goes through the domain
@spec book_appointment(map(), DateTime.t()) ::
        {:ok, Appointment.t(), [Appointment.event()]}
        | {:error, booking_failure()}

# read: queries directly, returns a view struct
@spec list_upcoming(Doctor.Id.t()) ::
        {:ok, [AppointmentListItem.t()]} | {:error, :unavailable}
```

Reconstructing a domain struct to render a list is wasted work and
couples the screen to the domain's shape. A purpose-built view struct is
the right answer, and the invariants still live on the write path where
they matter.

## Transactions

The context function reads, calls the pure function, and then calls one
private function that writes what was decided:

```elixir
@type confirm_failure ::
        :not_found
        | :corrupt_row
        | :conflict
        | :unavailable
        | Appointment.confirm_error()

@spec confirm_appointment(Ecto.UUID.t(), DateTime.t()) ::
        {:ok, Appointment.t(), [Appointment.event()]}
        | {:error, confirm_failure()}
def confirm_appointment(id, now) do
  with {:ok, row} <- fetch_row(id),
       {:ok, appt} <- AppointmentRow.to_domain(row),
       {:ok, confirmed, events} <- Appointment.confirm(appt, now),
       {:ok, :saved} <- save_confirmation(row, confirmed, events) do
    {:ok, confirmed, events}
  end
end

# store: private, and the only code here that touches Repo
defp fetch_row(id) do
  case Repo.get(AppointmentRow, id) do
    nil -> {:error, :not_found}
    row -> {:ok, row}
  end
rescue
  DBConnection.ConnectionError -> {:error, :unavailable}
end

defp save_confirmation(row, confirmed, events) do
  Repo.transact(fn ->
    with {:ok, _row} <- update_row(row, confirmed),
         {:ok, _events} <- insert_events(events) do
      {:ok, :saved}
    end
  end)
rescue
  DBConnection.ConnectionError -> {:error, :unavailable}
end

defp update_row(row, confirmed) do
  row
  |> Ecto.Changeset.change(status: "confirmed")
  |> Ecto.Changeset.change(confirmed_at: confirmed_at(confirmed))
  |> Ecto.Changeset.optimistic_lock(:lock_version)
  |> Repo.update(stale_error_field: :lock_version)
  |> case do
    {:ok, _row} = updated -> updated
    {:error, _stale} -> {:error, :conflict}
  end
end
```

Only `save_confirmation/3` opens the transaction. Ecto raises
`DBConnection.ConnectionError` when the database cannot be reached and
answers a stale write with a changeset; the store functions turn both
into values, `:unavailable` and `:conflict`, so a caller of the context
matches on the context's own failure and never on Ecto's. A row the
domain forbids is a fault of the store as well, and it keeps its own
name, `:corrupt_row`, because trying again will not cure it.
`insert_events/1` wraps `Repo.insert_all/3`, which answers a count or
raises, and answers `{:ok, count}`, so it adds no failure of its own.

`Repo.transact/2` commits when the function returns `{:ok, value}` and
rolls back when it returns `{:error, reason}`, and it returns that same
tuple. A failing step therefore ends the `with`, undoes the transaction
and reaches the caller, with no `else` and no `Repo.rollback/1`.
`Repo.transact/2` needs Ecto 3.13; on an older 3.x the same function is
written with `Repo.transaction/2` and `Repo.rollback/1`.

One aggregate per transaction. The pure function in the middle knows
nothing about the transaction and cannot start or commit one. See
[functional-enforcing-consistency-boundaries](../../functional-enforcing-consistency-boundaries/SKILL.md).

For concurrent updates, the guard is `Ecto.Changeset.optimistic_lock/2`
rather than a database lock: the context function read the row with its
version, the pure transition ran, and the write is conditional on that
version still being current. On a conflict, re-read. A conflict raises
`Ecto.StaleEntryError` from `Repo.update/2`; passing `:stale_error_field`
returns the error on the changeset instead, and `update_row/2` above
turns that into `{:error, :conflict}` for the caller, who reads again.
Its changeset is built with `change/2` and carries no validation and no
constraint, so a stale version is the only error the update can answer.

`Ecto.Multi` describes the same transaction as a value. Reach for it
when the set of steps is built at run time, or when the caller has to
learn which step failed: each step is named, each step sees what the
earlier ones produced, and the first failure rolls the rest back. The
pure function has already run, so the multi inserts the events it
returned and loads nothing:

```elixir
defp save_confirmation(row, confirmed, events) do
  Ecto.Multi.new()
  |> Ecto.Multi.update(:saved, changeset_for(row, confirmed),
    stale_error_field: :lock_version
  )
  |> Ecto.Multi.insert_all(:outbox, EventRow, EventRow.entries(events))
  |> Repo.transact()
  |> case do
    {:ok, _changes} -> {:ok, :saved}
    {:error, :saved, _changeset, _changes} -> {:error, :conflict}
  end
rescue
  DBConnection.ConnectionError -> {:error, :unavailable}
end
```

`Repo.transact/2` on a multi returns `{:ok, changes}` with every
step's result under its name, or
`{:error, failed_step, value, changes_so_far}`, so this function learns
which step failed and says it in the context's own words. The one step
here that can answer an error is `:saved`, and what it reports is a
stale version.

The `:outbox` step is the point. The state change and the record of the
event are written in one transaction, which is the only way a consumer
cannot see one without the other; a relay reads that table afterwards
and publishes. See
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

Two cautions. A multi is still one aggregate's transaction — reaching
for a second aggregate because the multi makes it easy is the boundary
mistake, not a convenience. And keep the pure transition outside the
multi, as above: the function stays a function of values, and the multi
only sequences the writes.

## Dependencies

A context function reads first and passes values to the pure function, so
most of the time nothing is injected. A capability is passed in only
where a read cannot come first, which rule 1 of
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md)
names.

Where one is needed, the context function takes it, as a function and
not a module, so tests need no mocking library and no global
configuration. Declare a type for each, and put them last, after the
data:

```elixir
@type fee_schedule_for ::
        (Treatment.Id.t() -> {:ok, FeeSchedule.t()} | {:error, term()})
@type quote_deposit ::
        (non_neg_integer() -> {:ok, Deposit.t()} | {:error, term()})

@type deposit_failure :: {:rejected, term()} | :unavailable

@spec price_with_deposit(
        BookCommand.t(),
        fee_schedule_for(),
        quote_deposit()
      ) :: {:ok, PricedBooking.t()} | {:error, deposit_failure()}
```

The two here are the kinds that rule names: which fee schedule to read
is not known until a rule has picked the treatment, and a deposit quote
is a call the provider charges for. The context function calls each
between two pure functions, and neither is handed to `Appointment` or to
any other module of the core. The amount is an integer of satang. The
instant is not a capability: it is a value, and the caller passes it.

A behaviour plus `mox` is the common Elixir alternative. It works, and
it is heavier: a behaviour is an interface with several members, which
is the wide-dependency smell from
[functional-applying-solid-functionally](../../functional-applying-solid-functionally/SKILL.md).
Prefer function values for the one or two capabilities that remain, as
above, and reserve behaviours for genuinely swappable adapters.
