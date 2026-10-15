# LiveView and PubSub

## Contents

- [LiveView](#liveview)
- [PubSub and events](#pubsub-and-events)

## LiveView

A LiveView is the same split again: `assigns` are the state,
`handle_event` is the shell that calls the context, tells other
screens, and stores the outcome, `render` is a pure function of assigns.

```elixir
def handle_event("submit", params, socket) do
  case Scheduling.book_appointment(params, DateTime.utc_now()) do
    {:ok, appt, events} ->
      broadcast(events)
      {:noreply, assign(socket, state: {:booked, appt})}

    {:error, {:invalid, changeset}} ->
      {:noreply, assign(socket, state: {:editing, changeset})}

    {:error, :unavailable} ->
      {:noreply, assign(socket, state: :unavailable)}

    {:error, reason} when reason in [:patient_not_found, :slot_unavailable] ->
      {:noreply, assign(socket, state: {:rejected, reason})}
  end
end
```

Rules that keep it clean:

1. **One assign for the screen state**, as a tagged tuple, rather than
   several booleans. `:loading`, `{:editing, changeset}`,
   `{:booked, appt}` cannot occur at once, which several booleans can.
2. **No business rules in the LiveView.** It hands the event's params to
   the context and stores the outcome; the one other thing it does is
   send the hint below.
3. **Derive in `render`, do not store.** A total, a count, or a
   formatted string is computed, not assigned.
4. **Keep assigns small.** Everything in assigns stays in the memory of a
   live process for as long as the page is open; large collections
   belong in a stream.
5. **`handle_info` is the shell reacting to the outside**: PubSub
   messages, timers, task completions. Not a place for decisions.

## PubSub and events

A context that returns events, as
[functional-designing-workflow-pipelines](../../functional-designing-workflow-pipelines/SKILL.md)
describes, lets the shell decide who hears about them. The
`handle_event/3` above hands the events it was given to this, which sends
other screens a hint and not the event:

```elixir
# the shell tells other screens that something changed
defp broadcast(events) do
  Enum.each(events, fn {_what, appt} ->
    Phoenix.PubSub.broadcast(Clinic.PubSub, topic(appt), {:changed, appt.id})
  end)
end
```

Broadcasting from inside the domain function makes it untestable and
couples it to every subscriber. Returning events keeps the decision pure
and puts delivery, ordering, and failure where they can be handled.

A broadcast made this way can be lost: the process may stop between the
save and the broadcast, and PubSub keeps nothing. That is acceptable for
what this one is, a hint to other screens to read again, because a
screen that misses it shows the stored state the next time it loads. An
event that another context acts on is a different thing. It is written
in the same transaction as the state, as the `:outbox` step in
[contexts-and-ecto.md](contexts-and-ecto.md) shows, and rule 4 of
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md)
says why.
