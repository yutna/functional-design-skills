# Architecture Shapes

Onion, hexagonal, ports and adapters, clean architecture: all of them are
the same rule seen from different angles. Dependencies point inward, and
the innermost layer is pure. In functional code the rule needs no
container, no interface hierarchy, and no framework, because a function
type is already the port and a function is already the adapter.

## Contents

- [The mapping](#the-mapping)
- [The shell is not one thing](#the-shell-is-not-one-thing)
- [Where events go](#where-events-go)
- [Where transactions go](#where-transactions-go)
- [Long-running processes](#long-running-processes)
- [Frontend applications](#frontend-applications)
- [When the shell grows rules](#when-the-shell-grows-rules)

## The mapping

| Term in the literature | In functional code                    |
| ---------------------- | ------------------------------------- |
| Entity, value object   | Domain type with a constructor        |
| Aggregate root         | Opaque type with transition functions |
| Domain service         | A pure function taking what it needs  |
| Use case, interactor   | A handler and the workflow it calls   |
| Port                   | A capability's function type          |
| Adapter                | A function that satisfies it          |
| Repository             | One or two function types             |
| Composition root       | The wiring function at the edge       |

Nothing on the right needs a class or an interface declaration. A port is
`alias SaveBooking = Booking -> AsyncResult<Unit, SaveError>`.

## The shell is not one thing

"Shell" is a role, not a folder. In practice it has five
distinguishable jobs, and keeping them separate keeps it thin.

**Transport.** Turns requests, messages, or CLI arguments into commands,
and results back into responses. Owns status codes, content types, and
serialisation. Knows nothing about storage.

**Handlers.** One for each command: read, call the core, write. Knows
nothing about HTTP or SQL.

**Storage.** Turns domain values into rows or documents and back. Owns
transactions, connections, and retries. Knows nothing about transport.

**Capabilities.** Clock, random, identifier generation, feature flags,
configuration. Small functions, supplied at wiring time, and called by
handlers and entry points.

**Composition.** The root that builds the wired handlers from the four
above. One function, no logic.

```text
-- transport: the entry point is given the instant read for this request
handlePost : App -> Instant -> Request -> Async<Response>
handlePost app now request =
  match parseCommand request with
  | Error problem -> done (badRequest problem)  -- an Async, finished
  | Ok command -> app.confirmBooking now command |> respondTo

-- composition: wires handlers, never a workflow with capabilities
buildApp pool =
  { confirmBooking = handleConfirmBooking pool }
```

`respondTo` turns the handler's `AsyncResult` into a response, and
`handleConfirmBooking` is the handler shown in
[functional-designing-workflow-pipelines](../../functional-designing-workflow-pipelines/SKILL.md).

## Where events go

The core returns events. The shell decides what happens to them, and that
decision is a real design choice:

| Delivery choice         | Consequence                          |
| ----------------------- | ------------------------------------ |
| In the same transaction | Consistent, but couples the consumer |
| Outbox table, then send | Consistent and decoupled; more parts |
| Fire and forget         | Simple; events can be lost           |
| Returned to the caller  | Caller decides; good for libraries   |

"Fire and forget" is acceptable only for an event whose loss is
acceptable. Any other event follows rule 4 of
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

Make the choice explicitly and write it down next to the workflow. The
core is unaffected either way, which is the point.

## Where transactions go

In the shell, wrapping one aggregate's read-decide-write cycle.

```text
withTransaction pool (\tx ->
  loadBooking tx id
    |> map (applyDecision decision)
    |> bind (saveBooking tx))
```

The pure function in the middle knows nothing about the transaction. It
cannot start one, cannot commit one, and cannot be affected by a
rollback. See
[functional-enforcing-consistency-boundaries](../../functional-enforcing-consistency-boundaries/SKILL.md).

## Long-running processes

A process that spans several workflows, waits for external events, and
may compensate is still shell work. Model its state as a domain type,
with pure transitions, and let the shell drive it:

```text
-- core
advance :
  Instant -> BookingProcess -> ProcessEvent
    -> (BookingProcess, List<Instruction>)
```

The shell, for each event, reads the state, calls `advance`, and saves
the new state and the instructions together. A relay dispatches the
instructions afterwards.

The core remains a pure function from state and event to new state and
instructions, which is testable as a table of cases.

## Frontend applications

The same shape applies. The core is state, actions, and a pure reducer or
transition function; the shell is the framework, the network, storage,
and the rendering. See
[functional-typescript-react](../../functional-typescript-react/SKILL.md).

## When the shell grows rules

It will try to. Two symptoms and their repair:

- **A conditional in the shell about business meaning.** Move the
  decision into the core and return an instruction instead.
- **A shell function that is hard to name.** It is doing two of the five
  jobs above. Split it.
