# SRP and OCP in Functional Code

## Single responsibility: separate by audience

A module has one reason to change when exactly one group of people can
ask for that change. The unit of separation is the requester, not the
topic.

### The classic collision

```text
-- payroll module
calculateHours : List<TimeCard> -> Hours    -- asked for by Operations
calculatePay   : Hours -> Rate -> Pay       -- asked for by Finance
reportHours    : List<TimeCard> -> Report   -- asked for by Compliance
```

All three concern time cards, and two of them compute hours in ways that
look identical today. They answer to three different departments. When
Compliance changes how overtime is reported, Operations must not be
affected, and the shared helper is exactly how it would be.

The repair is not to delete the similarity but to stop sharing the
decision:

```text
module Timesheets    -- owns what a time card is
  parse : RawCard -> Result<TimeCard, CardError>

module Scheduling    -- Operations
  workedHours : List<TimeCard> -> Hours

module Payroll       -- Finance
  payableHours : List<TimeCard> -> Hours
  pay : Rate -> Hours -> Pay

module Compliance    -- Compliance
  reportableHours : List<TimeCard> -> Report
```

Three `...Hours` functions with similar bodies is the correct answer.
They are three rules that agree today, owned by three people who may
change them independently.

### The test

For each function, name the person who would ask for it to change. Two
names on one module means two modules, unless one of them is clearly
downstream of the other.

### What SRP does not mean

It does not mean small. A module that owns "everything about how a booking
is priced" is one responsibility even if it is six hundred lines. Slicing
it into one function per file distributes a single decision, which is the
opposite of what the principle asks for.

## Open-closed: the mechanisms

Adding behaviour without editing what exists. Ranked by cost.

### 1. Pass a function

The cheapest extension point in any language.

```text
sortBy : (A -> Key) -> List<A> -> List<A>
retryWith : RetryPolicy -> Action -> Action
priceWith : GetRate -> Booking -> Priced
```

New behaviour is a new function at the call site. Nothing existing is
touched. Use this unless you need more.

### 2. Pass a small record of functions

When a variant needs several related operations that must vary together.

```text
alias Formatter = {
  header : ReportMeta -> Text,
  row    : ReportRow -> Text,
  footer : ReportTotals -> Text,
}

render : Formatter -> Report -> Text
```

Adding CSV output is a new value, not an edit. Adding a fourth operation
is an edit to every formatter, which is the closed axis. Keep such
records small for exactly that reason.

### 3. Dispatch on data

A table from a tag to behaviour, when the set of variants is loaded at
runtime or comes from configuration.

```text
alias Handlers = Map<EventTag, Event -> AsyncResult<Unit, Error>>
dispatch : Handlers -> Event -> AsyncResult<Unit, Error>
```

Open to new variants without recompiling. The cost is that nothing checks
the table is complete, so it needs a test that asserts coverage.

### 4. Exhaustive choice type

When the set of cases belongs to the business and is not open at all.

```text
type Shape = Circle of Radius | Rect of W * H | Triangle of B * H
area : Shape -> Area
```

Adding `Hexagon` is an edit, and the compiler or an exhaustiveness test
lists every place to edit. This is the right trade whenever a missed case
would be a bug, which is most of the time in a domain model.

### Choosing

| The thing that grows           | Mechanism           |
| ------------------------------ | ------------------- |
| One behaviour, many variations | Pass a function     |
| A family of related operations | Record of functions |
| Variants from config or plugin | Dispatch table      |
| Business cases, fixed set      | Choice type         |

### The anti-pattern

An `if` ladder over a string tag, spread across several modules. It has
the costs of the choice type (edits when a case is added) and none of the
benefits (nothing tells you where the other ladders are). Convert to a
choice type first, then decide whether an open mechanism is needed.
