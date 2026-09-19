# Architecture Shapes

Onion, hexagonal, ports and adapters, clean architecture: all of them are
the same rule seen from different angles. Dependencies point inward, and
the innermost layer is pure. In functional code the rule needs no
container, no interface hierarchy, and no framework, because a function
type is already the port and a function is already the adapter.

## The mapping

| Term in the literature | In functional code                    |
| ---------------------- | ------------------------------------- |
| Entity, value object   | Domain type with a constructor        |
| Aggregate root         | Opaque type with transition functions |
| Domain service         | A pure function taking what it needs  |
| Use case, interactor   | A workflow pipeline                   |
| Port                   | A function type declared inward       |
| Adapter                | A function that satisfies it          |
| Repository             | One or two function types             |
| Composition root       | The wiring function at the edge       |

Nothing on the right needs a class or an interface declaration. A port is
`alias SaveBooking = Booking -> AsyncResult<Unit, SaveError>`.

## The shell is not one thing

"Shell" is a role, not a folder. In practice it has four distinguishable
jobs, and keeping them separate keeps it thin.

**Transport.** Turns requests, messages, or CLI arguments into commands,
and results back into responses. Owns status codes, content types, and
serialisation. Knows nothing about storage.

**Storage.** Turns domain values into rows or documents and back. Owns
transactions, connections, and retries. Knows nothing about transport.

**Capabilities.** Clock, random, identifier generation, feature flags,
configuration. Small functions, supplied at wiring time.

**Composition.** The root that builds the wired workflows from the three
above. One function, no logic.

```text
-- transport
handlePost req =
  parseCommand req
    |> bind app.confirmBooking
    |> map toResponse

-- composition
buildApp pool clock =
  { confirmBooking =
      confirmBooking (checkTreatment pool) (getPrice pool) (saveBooking pool)
        (clock.now) }
```

## Where events go

The core returns events. The shell decides what happens to them, and that
decision is a real design choice:

| Delivery choice         | Consequence                          |
| ----------------------- | ------------------------------------ |
| In the same transaction | Consistent, but couples the consumer |
| Outbox table, then send | Consistent and decoupled; more parts |
| Fire and forget         | Simple; events can be lost           |
| Returned to the caller  | Caller decides; good for libraries   |

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
[enforcing-consistency-boundaries](../../enforcing-consistency-boundaries/SKILL.md).

## Long-running processes

A process that spans several workflows, waits for external events, and
may compensate is still shell work. Model its state as a domain type,
with pure transitions, and let the shell drive it:

```text
-- core
advance : Instant -> ProcessState -> Event -> (ProcessState, List<Command>)

-- shell
loop: read state, receive event, advance, persist state, dispatch commands
```

The core remains a pure function from state and event to new state and
instructions, which is testable as a table of cases.

## Frontend applications

The same shape applies. The core is state, actions, and a pure reducer or
transition function; the shell is the framework, the network, storage,
and the rendering. See
[functional-react-nextjs](../../functional-react-nextjs/SKILL.md).

## When the shell grows rules

It will try to. Two symptoms and their repair:

- **A conditional in the shell about business meaning.** Move the
  decision into the core and return an instruction instead.
- **A shell function that is hard to name.** It is doing two of the four
  jobs above. Split it.
