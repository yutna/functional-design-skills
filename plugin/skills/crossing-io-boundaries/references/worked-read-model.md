# A Read Model, Worked

Not every feature is a decision. This one is a screen, and applying the
aggregate rules to it makes everything worse. The example shows where the
write-path discipline stops and what replaces it.

## The request

> The clinic's front desk needs a board of today's appointments: patient
> name, doctor, time, status, whether the patient has arrived, and what
> they owe. It refreshes every thirty seconds and shows about two hundred
> rows. They want to filter by doctor and sort by time.

## The wrong first answer

The write path already has aggregates, so reuse them:

```text
listToday : Date -> AsyncResult<List<Appointment>, LoadError>
listToday date =
  findAppointmentIds date
    |> traverse loadAppointment          -- each rebuilds an aggregate
    |> map (map toBoardRow)
```

What that costs, in order of severity:

1. **Two hundred aggregate loads**, each reading several tables and
   reconstructing invariants nobody is about to change.
2. **`fromRow` returns `Result`**, so one legacy row makes the whole
   board fail. A screen should not go blank because one appointment from
   2019 has a null field.
3. **Patient name and balance live in other contexts.** Reaching for them
   through the appointment aggregate either pulls those aggregates in
   too, or adds fields to `Appointment` that no booking rule reads.
4. **The screen's shape now constrains the domain type.** The next column
   the front desk asks for becomes a field on the aggregate.

## Why the rules do not apply here

The aggregate exists to keep invariants true **while something changes**.
Nothing changes here. The board is a question, not a command, and the
guarantees it needs are different:

| Write path needs  | Read path needs                |
| ----------------- | ------------------------------ |
| Invariants hold   | The screen renders             |
| One transaction   | Consistent enough, cheap       |
| Reject bad input  | Tolerate imperfect stored data |
| Domain vocabulary | The screen's vocabulary        |
| Reconstruct fully | Only the fields displayed      |

Separating the two paths is not a violation of the model. It is the
recognition that reading and deciding are different jobs, and it is what
[persistence-patterns.md](persistence-patterns.md) means by commands and
queries.

## The view type

Name it for the screen, hold exactly what the screen shows, and make it
serialisable as it stands.

```text
type BoardRow = {
  appointment: AppointmentId,
  time: LocalTime,
  patientName: Text,
  doctorName: Text,
  status: BoardStatus,          -- the screen's vocabulary, not the domain's
  arrived: Boolean,
  balance: Money,
}

type BoardStatus = Upcoming | InProgress | Done | NoShow | Cancelled
```

`BoardStatus` is deliberately not `Lifecycle`. The board collapses
several domain states into `Done` and does not distinguish the three
kinds of cancellation, because the front desk does not act on the
difference. Mapping the domain type into a screen type is a design
decision, made once, here.

## The query

One query, projecting straight into the view type.

```text
listBoard :
  Date -> Option<DoctorId> -> Async<List<BoardRow>>
```

Three properties worth noting:

1. **It returns `Async`, not `AsyncResult`.** A missing row is an empty
   board, not an error. Storage failures still propagate as exceptions at
   the very edge, where they become a 500; there is no per-row failure to
   model because there is no per-row validation.
2. **It joins across contexts in the query**, not in the domain. Patient
   name comes from the records context and the balance from billing. That
   is legitimate because nothing here enforces a rule; it is a report.
   The join lives in the read module, which is the only place that knows
   both schemas.
3. **Filtering and sorting are the query's job**, not the caller's. The
   database does it on two hundred rows better than any code above will.

## Tolerating imperfect data

The write path rejects a row it cannot understand. The read path must
not.

```text
toBoardStatus : Text -> BoardStatus
toBoardStatus s =
  match s with
  | "confirmed" -> Upcoming
  | "in_progress" -> InProgress
  | "completed" -> Done
  | "no_show" -> NoShow
  | "cancelled" -> Cancelled
  | _ -> Upcoming            -- unknown legacy value: show it, flag it
```

This is the one place in the pack where a permissive fallback is right,
and it needs the reason written next to it: the board must render, and an
unknown status is better shown pessimistically than not at all. Pair it
with a counter so the unknown values are visible rather than silent. See
[designing-what-to-observe](../../designing-what-to-observe/SKILL.md).

## Where the read model lives

```text
module Scheduling.Board          -- read only
  type BoardRow
  type BoardStatus
  listBoard : Date -> Option<DoctorId> -> Async<List<BoardRow>>
```

Rules for the module:

- It may query storage directly, including tables owned by the write
  path.
- It exports no function that changes anything.
- Nothing in the write path imports it.
- When the screen changes, only this module changes.

## When to go further

This example uses a plain query. Two heavier options exist, and neither
is needed here:

| Option                  | When it earns its cost              |
| ----------------------- | ----------------------------------- |
| Materialised view       | The query is slow at real volume    |
| Event-driven projection | The read side must scale on its own |

Both add a staleness window and a rebuild procedure. Start with the
query, measure, and move only when the number says so. See
[designing-for-performance.md](../../programming-strategically/references/designing-for-performance.md).

## What this bought

| Decision                        | What it removed                    |
| ------------------------------- | ---------------------------------- |
| A view type per screen          | Screen fields on the aggregate     |
| Query instead of reconstruct    | 200 aggregate loads per refresh    |
| `Async`, not `AsyncResult`      | A blank board from one bad row     |
| Screen vocabulary in the type   | The front desk reading `Lifecycle` |
| Cross-context join in the query | Two more aggregates pulled in      |
| A read-only module              | Any risk of a write sneaking in    |

The write path is unchanged, and every invariant it enforces still holds.
That is the point: the discipline stays where decisions are made.
