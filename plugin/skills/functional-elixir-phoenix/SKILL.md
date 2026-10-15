---
name: functional-elixir-phoenix
description: Use when designing a Phoenix context, an Ecto schema or changeset, a LiveView's assigns, or deciding what belongs in the domain rather than in the web layer.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.1
---

# Functional Phoenix

## Overview

Phoenix contributes a boundary that maps cleanly onto the core and shell
split: the domain structs and their pure functions are the core; a
context is where the handlers live, and controllers and LiveViews are
the shell around it. Ecto contributes a parser at the edge that most
projects mistake for a domain model.

The language itself, and OTP, are unchanged and live in
[functional-elixir](../functional-elixir/SKILL.md). This pack is only
what Phoenix and Ecto add.

**Check the installed version before writing code.** The shapes below
target Phoenix 1.8, LiveView 1.2 and Ecto 3.

## When to use

- Designing a context, a schema, or a changeset
- Deciding whether a rule belongs in a changeset or in the domain
- Structuring a LiveView's assigns and events
- Publishing something other parts of the system react to
- Reviewing a controller or LiveView that has grown rules

Not for: the Elixir language, OTP, routing, or deployment.

## Core rules

1. Rule. **Contexts are bounded contexts**, not folders. Each owns its
   structs and exposes functions; none reaches into another's schemas.
2. Rule. **An Ecto schema is a boundary artefact, not the domain type.**
   It carries nullable columns, associations and `__meta__`. Map it into
   a domain struct and work with that. A screen that only reads and
   enforces no rule may use the rows as they are, as
   [contexts-and-ecto.md](references/contexts-and-ecto.md) has it.
3. Rule. **A changeset parses; it does not decide.** Format, presence and
   length belong there. "A discount over twenty per cent needs approval"
   belongs in the domain, where it can be tested without Ecto.
4. Default. **One assign for the screen state**, as a tagged tuple, or an atom
   for a state that carries nothing. Several booleans permit screens that
   cannot exist. Flags that vary independently,
   where every combination is a screen that exists, stay assigns of their own.
5. Rule. **No business rules in a controller or a LiveView.** They hand
   the request's or the event's params to the context and store the
   outcome. A LiveView may also send other screens a hint that something
   changed.
6. Rule. **Return events; let the shell deliver them.** The pure function
   returns the events it decided, and the context writes them with the state.
   Broadcasting from inside the decision couples it to every subscriber and
   makes it untestable.
7. Default. **The transaction belongs to the function that writes.** A context
   function reads, calls the pure function, and then calls one private function
   that writes what was decided; `Repo.transact/2` around a `with` goes inside
   that one, so that a failing step rolls back and reaches the caller. Reach
   for `Ecto.Multi` when the set of steps is built at run time, or when the
   caller has to learn which step failed. Before Ecto 3.13 there is no
   `Repo.transact/2`, and the same shape is written with `Repo.transaction/2`
   and `Repo.rollback/1`.

## Pattern

The changeset parses untrusted input; the core receives a command whose
shape is already parsed and applies the rules.

```elixir
# parse: the boundary turns untrusted input into a checked shape
@spec booking_changeset(map()) :: Ecto.Changeset.t()
def booking_changeset(params) do
  %BookingParams{}
  |> cast(params, [:patient_id, :doctor_id, :slot_id, :reason])
  |> validate_required([:patient_id, :doctor_id, :slot_id])
  |> validate_length(:reason, max: 200)
  |> validate_format(:patient_id, @uuid)
end

# handler, in Clinic.Scheduling: parses, reads, calls the core, writes
@spec book_appointment(map(), DateTime.t()) ::
        {:ok, Appointment.t(), [Appointment.event()]}
        | {:error, booking_failure()}
def book_appointment(params, now) do
  with {:ok, command} <- parse_command(params),
       {:ok, patient} <- find_patient(command.patient),
       {:ok, schedule} <- load_schedule(command.doctor, command.slot),
       {:ok, appointment, events} <-
         Appointment.book(command, patient, schedule, now),
       :ok <- save_booking(appointment, events) do
    {:ok, appointment, events}
  end
end

# core: receives a command whose shape is already parsed
@spec book(BookCommand.t(), Patient.t(), Schedule.t(), DateTime.t()) ::
        {:ok, Appointment.t(), [event()]} | {:error, booking_error()}
```

A changeset accumulates every error at once, which is what a form needs.
That is applicative validation with an Ecto name; see
[functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md).

The context function the web layer calls, `Scheduling.book_appointment/2`,
sits between the two. `parse_command/1` runs `booking_changeset/1` and
answers `{:error, {:invalid, changeset}}` when it is not valid.
Otherwise it builds the command from the changeset's data: in this pack
the changeset is the parser, it has checked what `BookCommand.new/1`
would, and it is the only source of `{:invalid, _}`. The function then
calls `Appointment.book/4`. The failure the handler returns holds that
`{:invalid, changeset}`, the rules' refusal, `:patient_not_found` when a
read finds nothing, and `:unavailable` when the database cannot be
reached.

## Where each layer stops

- **Controller or LiveView.** Receives the request or the event, calls
  one context function with its params, renders the outcome. A LiveView
  may also tell other screens that something changed. No rules, no
  queries.
- **Context.** The public surface of a bounded context, and where its
  handlers live. Parses the params into a command, reads what the core
  needs, calls the core, writes what it decided, and returns
  `{:ok, value, events}` or `{:error, reason}`.
- **Schema and changeset.** The parser between the database or the form
  and the domain. Nothing depends on it inward.
- **Domain struct.** Invariants, transitions, decisions. Knows nothing
  about Ecto, Plug, or the socket.

The test that this holds: the pure function is callable from `iex` with
plain values and no connection, and testable with Ecto uninstalled. The
context function needs the database, and its tests are the few that
touch it.

## Red flags

- Ecto schemas passed into business logic as the domain model
- Business rules inside a controller, a LiveView, or a query
- A context calling another context's schema module
- A changeset containing a rule a domain expert would recognise
- `Repo` called from anywhere but a context
- A LiveView assign per boolean, for flags that depend on each other,
  instead of one state tuple
- `Phoenix.PubSub.broadcast` inside a context function

## Common mistakes

- **Treating the Ecto schema as the domain type.** It is shaped by the
  table, and the table is shaped by storage compromises.
- **Contexts as folders.** A context that exposes another's schema is
  one context with two names.
- **Preloading to make the domain work.** If a domain function needs an
  association loaded, it is taking a schema where it should take a
  value.
- **A LiveView that queries.** The context composes what the screen
  needs; the LiveView asks for it once.
- **Broadcasting from the domain.** Return the event. Delivery,
  ordering and failure belong where they can be handled.

## Related skills

- [functional-elixir](../functional-elixir/SKILL.md)
- [functional-capturing-the-domain](../functional-capturing-the-domain/SKILL.md)
- [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md)
- [functional-enforcing-consistency-boundaries](../functional-enforcing-consistency-boundaries/SKILL.md)
- [functional-designing-workflow-pipelines](../functional-designing-workflow-pipelines/SKILL.md)

## Further reading

- [contexts-and-ecto.md](references/contexts-and-ecto.md) covers
  contexts as bounded contexts, changesets as boundary parsers, and
  transactions with `Repo.transact/2` and `Ecto.Multi`.
- [liveview.md](references/liveview.md) covers assigns as one state
  value, where events are handled, and returning events for the shell
  to broadcast.
