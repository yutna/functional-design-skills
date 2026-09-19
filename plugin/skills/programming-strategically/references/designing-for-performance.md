# Designing for Performance

Performance is a design concern only where it is measured, and the
default design decision is the simple one. Simpler code is usually faster
than complex code, because it does less; and where it is not, it is
easier to change than complex code is.

## The method

1. **Do not guess.** Intuition about what is slow is wrong often enough
   that acting on it wastes both effort and design quality.
2. **Measure first, and measure the thing users wait for**, not a
   microbenchmark of the function you suspect.
3. **Find the critical path**: the minimum work that must happen for the
   common case. Write it out as a list of steps.
4. **Remove work from the critical path**, rather than making each step
   faster. The cheapest operation is the one that does not run.
5. **Measure again.** Keep the change only if the number moved.
6. **Keep the fast path behind the same interface.** A performance fix
   that leaks into callers has traded a measured win for unbounded
   complexity.

## What this means in functional code

| Concern                  | Design response                        |
| ------------------------ | -------------------------------------- |
| Copying whole structures | Persistent structures share, not copy  |
| Repeated pure work       | Memoise at one owner, not at callers   |
| Building large lists     | Stream or fold instead of materialise  |
| Work not always needed   | Laziness, but only where measured      |
| Deep recursion           | Tail calls, or an explicit accumulator |
| Chatty I/O               | Batch at the shell, keep the core pure |

The functional defaults are already reasonable: immutability enables
sharing, and pure functions are safe to cache and to reorder. Reach for
[using-recursion-and-laziness](../../using-recursion-and-laziness/SKILL.md)
and [folding-over-data](../../folding-over-data/SKILL.md) before reaching
for mutation.

## When mutation is the answer

Sometimes it is: a hot loop building one large structure, wholly inside
one function, where the mutable value never escapes. That is acceptable
because it is invisible from outside. Make sure it stays invisible:

- The mutable value is created and consumed in the same function
- No reference to it escapes, including into a closure or a callback
- The function's signature is unchanged and still total
- A comment records the measurement that justified it

If any of those fails, the optimisation has become a design change, and
must be judged as one.
