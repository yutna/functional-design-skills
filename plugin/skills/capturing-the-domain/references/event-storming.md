# Event Storming

A discovery session that produces a model in hours instead of weeks. It
works because events are concrete: people who cannot describe a process
in the abstract can always say what happened.

## Setup

Everyone who knows part of the process in one place, with one shared
surface. Developers, domain experts, and whoever handles the exceptions,
because the exceptions are where the design lives.

## Step 1: events, past tense

Ask: what happens in this business? Write each answer as a past-tense
event.

```text
Booking confirmed
Payment declined
Shipment dispatched
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

Write the command for the first case, in the imperative: "Confirm booking",
"Approve refund".

## Step 4: group into workflows

A workflow is one command, one unit of work, and the events it produces.
Draw the box.

```text
Confirm booking  ->  [ confirm booking ]  ->  Booking confirmed
                                      Acknowledgement sent
```

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
type BookingRequest = { customer: CustomerId,
                    treatments: NonEmptyList<BookedTreatment> }

type BookingConfirmed = { booking: Booking, confirmedAt: Instant }
type BookingRejected = { reason: RejectionReason }

confirmBooking :
  BookingRequest -> Result<BookingConfirmed, ConfirmBookingError>
```

Then read the types back to the room, in English: "confirming a booking takes
a customer and at least one treatment, and either places the booking or fails
with one of these reasons". Every correction at this point costs nothing.

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
