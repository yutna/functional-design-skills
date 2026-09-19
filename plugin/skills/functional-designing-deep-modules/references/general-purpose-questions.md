# Finding the Right Generality

The target is "somewhat general purpose": the interface is general enough
to serve more than today's caller, while the implementation solves only
the problems that actually exist. Fully special purpose leaks the
caller's assumptions into the module. Fully general costs interface that
nobody uses.

## The questions

Ask these in order, about the module you are designing.

1. **What is the simplest interface that covers all my current needs?**
   Reducing the number of functions is only progress if the total
   interface shrinks. Three functions that each do a clear thing beat one
   function with a mode flag.

2. **In how many situations will this be used?**
   If the answer is one, and it will stay one, the general version is
   speculation. If a second caller is visible today, design for both.

3. **Is this easy to use for my current needs?**
   If pushing towards generality made today's use awkward, the
   generalisation is wrong. Awkwardness at the only real call site is a
   design error, not a price worth paying.

4. **Does the interface mention anything only one caller cares about?**
   A parameter that exists because of one screen, a field named after one
   report. That is the caller's assumption leaking in.

5. **Could a second, different caller use this without changing it?**
   Imagine a concrete second caller, not a hypothetical one. If it would
   need a new parameter, the interface is too special. If it would need
   to ignore three parameters, too general.

## Worked example

Requirement: a scheduling screen must move an appointment to the next
free slot.

**Special purpose.** `moveToNextFreeSlot : AppointmentId -> Calendar ->
Calendar`. Every new scheduling action adds another such function, each
one knowing about slots, working hours, and clashes.

**Too general.** `apply : Calendar -> Change -> Result<Calendar, Error>`
where `Change` is an open-ended script. Every caller must now build
changes, and the module cannot say which are valid.

**Somewhat general.** A small set of primitives over intervals:

```text
place     : Interval -> AppointmentId -> Calendar
                     -> Result<Calendar, Clash>
remove    : AppointmentId -> Calendar -> Calendar
freeAfter : Instant -> Duration -> Calendar -> Option<Interval>
```

`moveToNextFreeSlot` becomes three lines in the caller, and rescheduling,
cancel-and-refill, and drag-to-move are all expressible without new
interface. This is the shape to aim for: primitives at the level of the
domain, not at the level of the current feature.

## Two failure signatures

**The one-caller parameter.** A function takes `includeArchived: Boolean`
because one screen needs archived rows. Every other caller must decide
about something irrelevant to it. Fix: two functions, or a filter the
caller composes.

**The configuration escape hatch.** A module takes an options record with
eleven fields, none required, because generality was reached for without
deciding anything. Fix: choose the defaults, and expose the two options
that callers actually vary.

## The relationship to depth

Generality and depth pull the same way. A somewhat general interface is
usually smaller than a set of special-purpose ones, and hides more. When
they conflict, depth wins: prefer a smaller interface over a more general
one.
