# OTP and LiveView

## Processes are the shell

A GenServer is a mutable cell with a mailbox. That makes it shell, not
core: the decisions it makes should be pure functions it calls, and the
process should hold only what genuinely needs to outlive a request.

```elixir
defmodule Clinic.Scheduling.HoldRegistry do
  use GenServer

  # shell: receives a message, calls a pure function, keeps the result
  def handle_call({:hold, slot, now}, _from, state) do
    case Holds.take(state, slot, now) do        # pure
      {:ok, hold, next} -> {:reply, {:ok, hold}, next}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end
end
```

`Holds.take/3` is a pure function from state and inputs to a new state
and a result. It is tested as a table of cases, with no process, no
sleeping, and no message passing. The GenServer contributes serialisation
and lifetime, which is all it should contribute.

## When a process is the right home

| Situation                                 | Process?            |
| ----------------------------------------- | ------------------- |
| State must survive between requests       | Maybe               |
| State must be shared across requests      | Yes                 |
| State has a lifecycle and can crash alone | Yes                 |
| Work must be serialised per entity        | Yes                 |
| Work is periodic or scheduled             | Yes                 |
| State fits in the database                | Prefer the database |
| State belongs to one request              | No                  |
| A value just needs to be computed         | No                  |

The default is no process. A GenServer holding derived data that the
database already has is a cache with a supervision tree, and it will
disagree with the database eventually.

## Supervision and failure

Letting a process crash is the Elixir form of
[defining-errors-out-of-existence](../../defining-errors-out-of-existence/SKILL.md):
for a condition that means the program is wrong, crashing and restarting
from a known state is more honest than handling.

Keep the distinction the core skill draws:

- **Business outcome**: `{:error, :slot_unavailable}`, returned.
- **Bug or unrecoverable fault**: crash, and let the supervisor restart.

A `try/rescue` around domain logic is almost always the wrong shape;
domain functions should return tagged tuples and not raise.

## Tasks and concurrency

```elixir
[patient_task, catalogue_task] =
  [fn -> load_patient(id) end, fn -> load_catalogue() end]
  |> Enum.map(&Task.async/1)

with {:ok, patient} <- Task.await(patient_task),
     {:ok, catalogue} <- Task.await(catalogue_task) do
  {:ok, decide(patient, catalogue)}
end
```

The fetches run concurrently; the decision stays pure and sequential.
This is dependency rejection: gather first, decide afterwards. See
[strategies.md](../../parameterizing-dependencies/references/strategies.md).

## LiveView

A LiveView is the same split again: `assigns` are the state, `handle_event`
is the transition, `render` is a pure function of assigns.

```elixir
def handle_event("submit", params, socket) do
  case Booking.book(params, socket.assigns.deps) do
    {:ok, appt} ->
      {:noreply, assign(socket, state: {:booked, appt})}

    {:error, {:invalid, changeset}} ->
      {:noreply, assign(socket, state: {:editing, changeset})}

    {:error, reason} ->
      {:noreply, assign(socket, state: {:rejected, reason})}
  end
end
```

Rules that keep it clean:

1. **One assign for the screen state**, as a tagged tuple, rather than
   several booleans. `{:loading}`, `{:editing, changeset}`,
   `{:booked, appt}` cannot occur at once, which several booleans can.
2. **No business rules in the LiveView.** It parses the event, calls the
   context, and stores the outcome.
3. **Derive in `render`, do not store.** A total, a count, or a
   formatted string is computed, not assigned.
4. **Keep assigns small.** Everything in assigns is serialised state for
   a live process; large collections belong in a stream.
5. **`handle_info` is the shell reacting to the outside**: PubSub
   messages, timers, task completions. Not a place for decisions.

## PubSub and events

A context that returns events, as
[designing-workflow-pipelines](../../designing-workflow-pipelines/SKILL.md)
describes, lets the shell decide who hears about them.

```elixir
# context returns what happened
{:ok, appt, events} = Booking.book(params, deps)

# shell delivers
Enum.each(events, &Phoenix.PubSub.broadcast(Clinic.PubSub, topic(&1), &1))
```

Broadcasting from inside the domain function makes it untestable and
couples it to every subscriber. Returning events keeps the decision pure
and puts delivery, ordering, and failure where they can be handled.

## Testing processes

- Test the pure state function exhaustively, without a process.
- Test the GenServer's callbacks by calling `handle_call/3` directly with
  a state value; they are functions.
- Reserve `start_supervised!` tests for the lifecycle itself: restarts,
  timeouts, and supervision.
- Never `Process.sleep` to wait for a message; send a synchronous call or
  assert on a received message with a timeout.
