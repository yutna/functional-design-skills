# Recursion Recipes

## Contents

- [Turning a non-tail call into a tail call](#turning-a-non-tail-call-into-a-tail-call)
- [When the recursion is not linear](#when-the-recursion-is-not-linear)
- [Trampolines](#trampolines)
- [Mutual recursion](#mutual-recursion)
- [Unfold: recursion that builds](#unfold-recursion-that-builds)
- [Structural recursion and termination](#structural-recursion-and-termination)
- [Testing recursive functions](#testing-recursive-functions)

## Turning a non-tail call into a tail call

Move the work that happens after the call into an accumulator passed
forward.

```text
-- after the call: append happens on the way back up
reverse [] = []
reverse (x :: rest) = append (reverse rest) [x]     -- also quadratic

-- accumulator: nothing happens after the call
reverse xs = go xs []
  where go [] acc = acc
        go (x :: rest) acc = go rest (x :: acc)
```

The accumulator holds the partial answer. This transformation works for
most linear recursions and turns them into tail calls, which are loops
where the language eliminates them.

## When the recursion is not linear

A tree walk makes two calls, so only one can be in tail position. Options,
in order of preference:

1. **Use the type's fold.** It is written once and tested once.
2. **Bound the depth.** A balanced tree of a million nodes is twenty
   levels deep; direct recursion is fine. Say so in a comment.
3. **Explicit stack.** Replace the call stack with a list you control.

```text
walk root =
  reverse (go [root] [])
  where
    go [] acc = acc
    go (n :: rest) acc =
      match n with
      | Leaf v -> go rest (v :: acc)
      | Node (l, r) -> go (l :: r :: rest) acc
```

The call stack stays constant, and the traversal order is explicit
rather than implied by the language. The pending nodes now live in a
list on the heap, which grows with the tree. Leaves are prepended, so
`reverse` restores the left-to-right order once at the end. Termination
depends on the list of pending nodes, not on a smaller argument: each
step removes one node and adds only its children, so the walk ends when
the tree does.

## Trampolines

When a language has no tail-call elimination and the recursion is deep or
mutual, return a description of the next step instead of calling it, and
let a driver loop run the steps.

```text
type Step<A> = Done of A | More of (Unit -> Step<A>)

run : Step<A> -> A
run s =
  match s with
  | Done a -> a
  | More f -> run (f ())        -- a `while` loop in a real language
```

The notation has no loop, so `run` is written recursively here. In a
language without tail-call elimination it has to be a loop with one
local variable: a recursive driver would need the very thing the
trampoline stands in for. Each `More` returns to the driver, so the
stack never grows. Termination
depends on each step leading closer to a `Done`; say so in a comment,
and bound the number of steps where that is not evident. The cost is
an allocation per step, which is usually acceptable next to a crash.

## Mutual recursion

Two functions calling each other are one recursion with two entry points.
The same techniques apply, and trampolining is often the only practical
one because neither call can be optimised independently.

```text
-- n is a non-negative Integer; a negative n would never reach 0
isEven n = if n == 0 then true else isOdd (n - 1)
isOdd n = if n == 0 then false else isEven (n - 1)
```

For a real example, expression evaluation over mutually recursive types:
give the pair of types one fold, taking one function per case of both.

## Unfold: recursion that builds

The mirror image of a fold. A fold consumes a structure into a value; an
unfold produces a structure from a seed.

```text
unfold : (S -> Option<(A, S)>) -> S -> List<A>

-- the slots of a clinic day, from its opening hours
type Cursor = { next: Instant, closes: Instant }

daySlots : OpeningHours -> List<Slot>
daySlots hours =
  unfold step { next: hours.opens, closes: hours.closes }
  where
    step c =
      let end = c.next + slotLength
      in if end > c.closes
         then None
         else Some ({ start: c.next, end }, { ...c, next: end })
```

Retry schedules and slot generation are unfolds. Recognising the shape
avoids a hand-written loop with a mutable cursor.

Reading the pages of a remote source until there are no more is not an
unfold in the core, because each read is an effect that can fail. It is
a loop in an adapter, with an effect type, such as
`readAllPages : PageToken -> AsyncResult<List<Record>, StoreError>`.

## Structural recursion and termination

A recursion terminates if every call is on a strictly smaller piece of
the input. Two habits make that visible:

1. When recursing over the input's own structure, recurse on a
   **component** of a value, never on a value you constructed inside the
   function. The explicit stack and the trampoline above recurse on
   something else, and each carries its own termination note.
2. When recursing on a number, make it decrease, and handle the negative
   case explicitly rather than assuming it cannot happen.

Where termination depends on something other than the structure, say so
in a comment and add a bound, because "this always terminates" has been
wrong many times.

## Testing recursive functions

- Base case, with the empty or minimal input.
- One step, where the recursion runs exactly once.
- A deep input, at least one order of magnitude beyond production data,
  to prove the stack behaviour.
- A property: the result of the recursion equals the result of an obvious
  but slow implementation.
