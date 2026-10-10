---
name: functional-elixir-phoenix
description: Use when designing a Phoenix context, an Ecto schema or changeset, a LiveView's assigns, or deciding what belongs in the domain rather than in the web layer.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.0.4
---

# Functional Phoenix

## Overview

Phoenix contributes a boundary that maps cleanly onto the core and shell
split: contexts hold the domain, controllers and LiveViews hold the
shell. Ecto contributes a parser at the edge that most projects mistake
for a domain model.

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
   a domain struct and work with that.
3. Rule. **A changeset parses; it does not decide.** Format, presence and
   length belong there. "A discount over twenty per cent needs approval"
   belongs in the domain, where it can be tested without Ecto.
4. Default. **One assign for the screen state**, as a tagged tuple.
   Several booleans permit screens that cannot exist.
5. Rule. **No business rules in a controller or a LiveView.** They hand
   the request's or the event's params to the context and store the
   outcome.
6. Default. **Return events; let the shell broadcast them.** Broadcasting
   from inside a context couples the decision to every subscriber and
   makes it untestable.
7. Default. **`Repo.transact/2` around a `with` for a transaction's
   steps.** A failing step ends the `with`, rolls the transaction back
   and reaches the caller. Reach for `Ecto.Multi` when the set of steps
   is built at run time, or when the caller has to learn which step
   failed.

## Pattern

The changeset parses untrusted input; the domain receives values whose
invariants already hold.

```elixir
# boundary: parses and validates untrusted input
def changeset(params) do
  %BookingParams{}
  |> cast(params, [:patient_id, :doctor_id, :slot_id, :reason])
  |> validate_required([:patient_id, :doctor_id, :slot_id])
  |> validate_length(:reason, max: 200)
end

# domain: receives a command whose values are already valid
@spec book(BookCommand.t(), deps()) ::
        {:ok, Appointment.t(), [event()]} | {:error, booking_error()}
```

A changeset accumulates every error at once, which is what a form needs.
That is applicative validation with an Ecto name; see
[functional-handling-errors-with-results](../functional-handling-errors-with-results/SKILL.md).

The context function the web layer calls,
`Scheduling.book_appointment/2`, sits between the two: it runs the
changeset, builds the command from the valid params, and calls `book/2`.

## Where each layer stops

- **Controller or LiveView.** Receives the request or the event, calls
  one context function with its params, renders the outcome. No rules,
  no queries.
- **Context.** The public surface of a bounded context. Parses the
  params into a command, calls the domain, and returns
  `{:ok, value, events}` or `{:error, reason}`.
- **Schema and changeset.** The parser between the database or the form
  and the domain. Nothing depends on it inward.
- **Domain struct.** Invariants, transitions, decisions. Knows nothing
  about Ecto, Plug, or the socket.

The test that this holds: a context function should be callable from
`iex` with plain values and no connection, and a domain function should
be testable with Ecto uninstalled.

## Red flags

- Ecto schemas passed into business logic as the domain model
- Business rules inside a controller, a LiveView, or a query
- A context calling another context's schema module
- A changeset containing a rule a domain expert would recognise
- `Repo` called from anywhere but a context
- A LiveView assign per boolean instead of one state tuple
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
