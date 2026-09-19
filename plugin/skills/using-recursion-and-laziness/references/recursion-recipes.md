# Recursion Recipes

## Turning a non-tail call into a tail call

Move the work that happens after the call into an accumulator passed
forward.

```text
-- after the call: cons happens on the way back up
reverse [] = []
reverse (x :: rest) = append (reverse rest) [x]     -- also quadratic

-- accumulator: nothing happens after the call
reverse xs = go xs []
  where go [] acc = acc
        go (x :: rest) acc = go rest (x :: acc)
```

The accumulator holds the partial answer. This transformation works for
most linear recursions and turns them into loops.

## When the recursion is not linear

A tree walk makes two calls, so only one can be in tail position. Options,
in order of preference:

1. **Use the type's fold.** It is written once and tested once.
2. **Bound the depth.** A balanced tree of a million nodes is twenty
   levels deep; direct recursion is fine. Say so in a comment.
3. **Explicit stack.** Replace the call stack with a list you control.

```text
walk root =
  go [root] []
  where
    go [] acc = acc
    go (n :: rest) acc =
      match n with
      | Leaf v -> go rest (v :: acc)
      | Node l r -> go (l :: r :: rest) acc
```

Constant stack, and the traversal order is explicit rather than implied
by the language.

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
  | More f -> run (f ())        -- a loop, not a nested call
```

Each `More` returns to the driver, so the stack never grows. The cost is
an allocation per step, which is usually acceptable next to a crash.

## Mutual recursion

Two functions calling each other are one recursion with two entry points.
The same techniques apply, and trampolining is often the only practical
one because neither call can be optimised independently.

```text
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

pageAll : PageToken -> List<Record>
pageAll = unfold (\token ->
  match fetchPage token with
  | Page rows (Some next) -> Some (rows, next)
  | Page rows None -> Some (rows, Stop)
  | Stop -> None)
```

Pagination, retry schedules, and sequence generation are all unfolds.
Recognising the shape avoids a hand-written loop with a mutable cursor.

## Structural recursion and termination

A recursion terminates if every call is on a strictly smaller piece of
the input. Two habits make that visible:

1. Recurse on a **component** of a value, never on a value you
   constructed inside the function.
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
