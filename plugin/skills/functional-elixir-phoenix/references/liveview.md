# LiveView and PubSub

## Contents

- [LiveView](#liveview)
- [PubSub and events](#pubsub-and-events)

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
[functional-designing-workflow-pipelines](../../functional-designing-workflow-pipelines/SKILL.md)
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
