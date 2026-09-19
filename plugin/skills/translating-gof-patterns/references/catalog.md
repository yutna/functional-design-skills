# Pattern Catalogue

For each: what it solves, the functional form, and when it is still worth
naming.

## Strategy

**Solves:** letting one step of an algorithm vary.

```text
sortBy : (A -> A -> Ordering) -> List<A> -> List<A>
priceBooking : GetTreatmentPrice -> Booking -> Priced
```

A parameter. Name the function type when it means something to the
domain. There is no interface and no implementation class.

## Command

**Solves:** representing an action as a value, so it can be queued,
logged, undone, or sent elsewhere.

```text
type Command =
  | ConfirmBooking of BookingRequest
  | CancelBooking of { id: BookingId, reason: Reason }

execute : Command -> AsyncResult<List<Event>, Error>
```

Still worth naming. A command as data is the basis of queues, audit
trails, and replay.

## Factory and Abstract Factory

**Solves:** creating values without the caller knowing which concrete
thing it gets.

```text
-- factory: a function
makeBookingId : Unit -> BookingId

-- abstract factory: a record of constructors
alias Renderer = {
  text : Text -> Node,
  image : Url -> Node,
}
```

A single factory is a function; there is no reason to name it a pattern.
The record form is useful when a family of constructors must vary
together.

## Template Method

**Solves:** a fixed algorithm with varying steps.

```text
runImport : (Row -> Result<A, E>) -> (A -> AsyncResult<Unit, E>)
              -> List<Row> -> AsyncResult<Report, E>
```

Pass the varying steps. Inheritance is not needed and couples the caller
to a base type.

## Decorator

**Solves:** adding behaviour without changing an interface.

```text
withRetry : Policy -> (A -> AsyncResult<B,E>) -> (A -> AsyncResult<B,E>)
withTiming : Metric -> (A -> B) -> (A -> B)
```

A function of the same shape. Use sparingly; see the alternatives in
[layer-smells.md](../../separating-layers/references/layer-smells.md).

## Adapter

**Solves:** making one interface usable where another is expected.

```text
fromStripeCharge : StripeCharge -> Result<Payment, MappingError>
```

A conversion function at the boundary. Always explicit, always named.

## Facade

**Solves:** a simple interface over a complicated subsystem.

A module with a small export list. This is just a deep module, and the
pattern name adds nothing. See
[designing-deep-modules](../../designing-deep-modules/SKILL.md).

## Observer

**Solves:** notifying interested parties without coupling to them.

```text
-- the decision returns what happened
confirmBooking : BookingRequest -> Result<List<BookingEvent>, ConfirmBookingError>

-- the shell decides who hears about it
dispatch : List<BookingEvent> -> AsyncResult<Unit, DispatchError>
```

Returning events beats registering callbacks: the decision stays pure,
failure of delivery is the shell's problem, and the listeners are visible
in one place instead of wherever someone subscribed.

## Iterator

**Solves:** traversing a collection without exposing its structure.

A lazy sequence, or the language's own iteration protocol. See
[using-recursion-and-laziness](../../using-recursion-and-laziness/SKILL.md).

## State

**Solves:** behaviour that depends on which state an object is in.

```text
type Quote = IsDraft of Draft | IsSent of Sent | IsAccepted of Accepted
send : Draft -> Result<Sent, SendError>
```

A choice type and one function per transition. See
[modeling-state-machines](../../modeling-state-machines/SKILL.md).

## Composite

**Solves:** treating an individual and a group uniformly.

```text
type Node =
  | Leaf of Content
  | Group of { name: Name, children: List<Node> }

render : Node -> Output
render n =
  match n with
  | Leaf c -> renderContent c
  | Group g -> wrap g.name (map render g.children)
```

A recursive choice type, consumed by a fold. Still worth naming, because
recognising the shape tells you a fold is available.

## Visitor

**Solves:** adding an operation over a structure without editing the
structure.

Exhaustive matching, or a fold that takes one function per case:

```text
foldShape : (Radius -> R) -> (W -> H -> R) -> Shape -> R
```

The double dispatch of the object-oriented version exists to work around
the absence of matching. Where the case set is fixed, matching is
strictly better; where it is open, pass a record of functions.

## Singleton

**Solves:** one instance, reachable everywhere.

A value, created at the composition root and passed in. Global mutable
state is what the pattern actually provides, and that is what a
functional design removes. See
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

## Builder

**Solves:** constructing a value with many optional parts.

```text
defaultOptions : Options
run { ...defaultOptions, timeout = Seconds 5 }
```

A record with defaults, or a smart constructor that validates. A builder
class adds a mutable intermediate that can be in an invalid state, which
is the opposite of what is wanted.

## Chain of Responsibility

**Solves:** letting several handlers try, in order, until one succeeds.

```text
firstMatch : List<A -> Option<B>> -> A -> Option<B>
```

A list of functions and a fold. No linked handler objects.

## Memento

**Solves:** capturing state so it can be restored.

The previous immutable value. Keep it; restoring is using it again. See
[persistent-structures.md](../../managing-state-immutably/references/persistent-structures.md).

## Flyweight

**Solves:** sharing common data between many objects.

Automatic. Immutable values are shared by default, and persistent
structures share unchanged parts.

## Interpreter

**Solves:** representing a small language and evaluating it.

```text
type Expr = Lit of Number | Add of Expr * Expr | Mul of Expr * Expr
eval : Expr -> Number
```

A genuine functional pattern, and the basis for the interpretation
strategy in
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).
Several evaluators over one type is where it earns its keep: evaluate,
pretty-print, optimise, cost.

## Mediator

**Solves:** coordinating several components without them knowing each
other.

A workflow function. See
[designing-workflow-pipelines](../../designing-workflow-pipelines/SKILL.md).
