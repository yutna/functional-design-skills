# Event Storming

A discovery session that produces a model in hours instead of weeks. It
works because events are concrete: people who cannot describe a process
in the abstract can always say what happened.

## Contents

- [Setup](#setup)
- [Step 1: events, past tense](#step-1-events-past-tense)
- [Step 2: order them, and find the gaps](#step-2-order-them-and-find-the-gaps)
- [Step 3: what caused each event](#step-3-what-caused-each-event)
- [Step 4: group into workflows](#step-4-group-into-workflows)
- [Step 5: mine the disagreements](#step-5-mine-the-disagreements)
- [Step 6: turn it into types](#step-6-turn-it-into-types)
- [What to do with the output](#what-to-do-with-the-output)
- [Running it alone](#running-it-alone)

## Setup

Everyone who knows part of the process in one place, with one shared
surface. Developers, domain experts, and whoever handles the exceptions,
because the exceptions are where the design lives. With no room and no
experts, see [Running it alone](#running-it-alone).

## Step 1: events, past tense

Ask: what happens in this business? Write each answer as a past-tense
event.

```text
Booking confirmed
Confirmation sent
Payment declined
Referral letter sent
Quote expired
Refund approved
```

Rules for this step: no discussion of causes, no ordering, no filtering.
Duplicates are fine and informative. Stop when the flow of new events
slows, not when the surface is full.

## Step 2: order them, and find the gaps

Arrange the events on a timeline. Two things surface immediately:

- **Gaps** where an event must exist but nobody named it
- **Branches** where the same point leads to different events, which are
  the business rules

## Step 3: what caused each event

For each event, ask what triggered it. There are exactly three answers,
and each maps to a different design:

| Trigger              | Design consequence                     |
| -------------------- | -------------------------------------- |
| A person did a thing | A command, and a workflow to handle it |
| Another event        | A reaction: one workflow feeds another |
| Time passed          | A scheduled process at the edge        |

A reaction starts from the event, and a scheduled process from a tick,
the event that the time has come. Each is handled as a command is: one
trigger in, one workflow, events out.

Write the command for the first case, in the imperative: "Confirm booking",
"Approve refund".

## Step 4: group into workflows

A workflow is one command or one event, one unit of work, and the events
it produces. Draw the box.

```text
Confirm booking  ->  [ confirm booking ]  ->  Booking confirmed
```

The wall also holds "Confirmation sent". The box lists only what the
workflow decides, and the sending is the work of the handler that
receives `BookingConfirmed`, so it stays outside.

If a box has two unrelated commands going in, it is two workflows. If a
box produces an event that nobody consumes, either the event is not real
or a consumer is missing.

## Step 5: mine the disagreements

The most valuable moments are:

- Two experts using the same word differently
- "It depends" followed by conditions nobody had written down
- "That never happens" followed by someone describing when it happened
- A step everyone does manually because the system cannot express it

Each of these is either a business rule that belongs in a type, or a
context boundary. Record them verbatim; the wording matters.

## Step 6: turn it into types

Convert directly, without an intermediate document.

```text
-- from the wall
type ConfirmBooking = { patient: PatientId,
                        treatments: NonEmptyList<BookedTreatment> }

type BookingConfirmed = { booking: Booking, confirmedAt: Instant }

confirmBooking :
  Instant -> BookingId -> ConfirmBooking
    -> Result<BookingConfirmed, ConfirmBookingError>
```

The shell supplies the instant and the new identifier, and the command
carries neither. A refusal is the `Error` of the result, so there is no
separate rejection type. This is the first sketch of `confirmBooking`,
in the shape the wall suggests. The pipelines skill refines it: the
input becomes the form nobody has checked, the function takes the
catalogue it needs, and the result is a list of events. See
[pipeline-anatomy.md](../../functional-designing-workflow-pipelines/references/pipeline-anatomy.md).

Then read the types back to the room, in English: "confirming a booking takes
a patient and at least one treatment, and either confirms the booking or
fails with one of the errors the type names". Every correction at this
point costs nothing.

## What to do with the output

- Events and commands become types.
- Workflows become functions, one per box.
- Rules discovered in step 5 become types that make the violation
  unbuildable, or errors in a `Result`.
- Boundaries discovered in step 5 become bounded contexts.

## Running it alone

If there is no room and no experts available, run the same steps against
whatever evidence exists: support tickets, log lines, screen flows, the
API's endpoints. It is weaker, because it captures the current system
rather than the business, so mark every assumption for confirmation.
The read-back goes to the user, with the list of assumptions, and the
order of substitutes is in
[working-alone.md](../../functional-design/references/working-alone.md).
