# Processes, Supervision and Tasks

A process is Elixir's way of holding changing state in memory over
time. Whether anything should is a design question, and the answer is
usually no: state that fits in the database belongs there. Mutability is
seldom the reason for a process. The usual reason, below, is isolation.

## Contents

- [Processes are the shell](#processes-are-the-shell)
- [When a process is the right home](#when-a-process-is-the-right-home)
- [A process is an isolation boundary](#a-process-is-an-isolation-boundary)
- [Supervision and failure](#supervision-and-failure)
- [What a restart cannot restore](#what-a-restart-cannot-restore)
- [Tasks and concurrency](#tasks-and-concurrency)
- [Testing processes](#testing-processes)

## Processes are the shell

A GenServer is a mutable cell with a mailbox. That makes it shell, not
core: the decisions it makes should be pure functions it calls, and the
process should hold only what genuinely needs to outlive a request.

```elixir
defmodule Clinic.Scheduling.HoldRegistry do
  use GenServer

  @impl true
  def init(holds), do: {:ok, holds}

  # shell: receives a message, calls a pure function, keeps the result
  @impl true
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

## A process is an isolation boundary

The reason to reach for a process is almost never that something needs
to be mutable. It is that something needs to be able to fail without
taking anything else with it.

That reframes the question. Instead of "does this need state", ask
**what should still be working after this fails**. The answer draws the
boundary:

- One slow external call should not stall the ten requests that do not
  need it. That is a `Task` per call, not a GenServer, and the caller
  awaits it.
- One customer's runaway import should not stop another customer's.
  That is a process per import, supervised, with its own lifetime, and
  its supervisor stops it, at shutdown or on request. Rule 8 of
  [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md)
  is the reason: work that outlives its command has an owner or a
  cancel.
- A cache that goes wrong should be able to die and come back empty
  without the request path noticing. That is a process whose death is
  survivable by design.

And where nothing needs to keep working independently, there is no
boundary to draw and no process to add. A GenServer wrapped around a
value that only ever has one caller is a mutable variable with a
mailbox, and it has bought serialisation nobody asked for.

## Supervision and failure

Letting a process crash is the Elixir form of
[functional-defining-errors-out-of-existence](../../functional-defining-errors-out-of-existence/SKILL.md):
for a condition that means the program is wrong, crashing and restarting
from a known state is more honest than handling.

Keep the distinction the core skill draws:

- **Business outcome**: `{:error, :slot_unavailable}`, returned.
- **Bug**: crash, and let the supervisor restart. A fault in something
  the code depends on, such as a database that cannot be reached, is not
  a bug: the function that called it returns `{:error, reason}`.

A `try/rescue` around domain logic is almost always the wrong shape;
domain functions should return tagged tuples and not raise.

**A supervision strategy is a design decision, not configuration.** The
three strategies each answer a different question about what depends on
what:

- `:one_for_one` says the children are independent. Restarting one
  says nothing about the others.
- `:one_for_all` says they share state or a protocol, so a survivor of
  a sibling's crash is holding a stale view and must be restarted too.
- `:rest_for_one` says they are ordered: later children were built on
  earlier ones and cannot outlive them.

Choosing the default without asking which of those is true is how a
tree comes to restart correctly in testing and incorrectly in
production. Write the dependency down as a sentence first; the
strategy follows from it.

## What a restart cannot restore

A restart returns a process to its initial state. That is the whole
guarantee, and it is worth being precise about what it excludes.

- **State the process was the only copy of is gone.** If losing it
  matters, it was not a process's to hold; it belongs in a database, or
  in the caller.
- **Work in flight is gone.** Messages already in the mailbox die with
  the process. A caller waiting on a reply gets an exit, not an answer,
  and has to decide what that means.
- **Effects already performed are not undone.** A process that crashed
  after charging a card restarts having charged the card. That is
  compensation, not supervision. See
  [functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

So the useful question before adding supervision is not "will it
restart" but **"what is the correct state to restart into, and who
notices that it did"**.

## Tasks and concurrency

A handler that needs a patient and a schedule can load both at once.
This is the middle of `book_appointment/2` in
[SKILL.md](../SKILL.md#pipelines-with-with), with the patient still
coming through its private `find_patient/1`, so the handler's error is
the same on both pages:

```elixir
[patient_result, schedule_result] =
  [
    fn -> find_patient(command.patient) end,
    fn -> load_schedule(command.doctor, command.slot) end
  ]
  |> Enum.map(&Task.async/1)
  |> Task.await_many()

with {:ok, patient} <- patient_result,
     {:ok, schedule} <- schedule_result do
  Appointment.book(command, patient, schedule, now)
end
```

`Task.await_many/1` waits for both tasks before the `with` looks at
either answer, so a patient who is not found leaves no task running. It
exits the caller when a task takes more than five seconds, so each load
carries a shorter timeout of its own and answers `{:error, :unavailable}`
first.

The fetches run concurrently; the decision stays pure and sequential.
This is dependency rejection: gather first, decide afterwards. See
[strategies.md](../../functional-parameterizing-dependencies/references/strategies.md).

## Testing processes

- Test the pure state function exhaustively, without a process.
- Test the GenServer's callbacks by calling `handle_call/3` directly with
  a state value; they are functions.
- Reserve `start_supervised!` tests for the lifecycle itself: restarts,
  timeouts, and supervision.
- Never `Process.sleep` to wait for a message; send a synchronous call or
  assert on a received message with a timeout.
