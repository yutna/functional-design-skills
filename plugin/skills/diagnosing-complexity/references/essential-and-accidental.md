# Essential and Accidental Complexity

A second diagnostic axis, applied before the one in the main skill.

The main skill asks a **locality** question: is the pain a dependency or
obscurity, and where is it? This file asks a **necessity** question: is
this complexity in the problem, or did we add it? The necessity question
comes first, because complexity you added should be deleted, and no
amount of refactoring deletes it.

## The distinction

**Essential complexity** is inherent in the problem, as stated by the
people who have the problem. A payroll system must handle the tax rules
that exist. A booking system must handle overlapping reservations. You
cannot design this away; you can only represent it clearly.

**Accidental complexity** is everything else: complexity arising from our
representations, our tools, our history, and our decisions. It is not in
the problem. It is in our solution.

The test for which one you are looking at:

> Would a domain expert, describing the requirement in their own words,
> mention this?

If the answer is no, it is accidental. A cache is accidental. A
`isProcessing` flag is accidental. A three-stage initialisation order is
accidental. None of them appear in any conversation about the business.

The important consequence: **accidental complexity has no defender.** You
do not need to negotiate its removal with the domain, because the domain
never asked for it.

## The three sources of accidental complexity

Almost all accidental complexity comes from three places, in this order
of harm.

| Source      | What it is               | Skill                             |
| ----------- | ------------------------ | --------------------------------- |
| State       | Mutable data, read later | `managing-state-immutably`        |
| Control     | Ordering not required    | `separating-pure-core-from-shell` |
| Code volume | Quantity to be read      | `designing-deep-modules`          |

### Why state is the worst

State destroys the ability to understand a piece of code by reading it.
With mutable state, the behaviour of a function depends on everything
that ran before it, so the unit of reasoning stops being the function and
becomes the whole history of the program.

It also multiplies. Two booleans and an optional field are not three
things to think about; they are twelve states, most of which nobody
intended and none of which the tests visit. This is the same observation
that
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md)
acts on from the other direction.

Two kinds of state, distinguished sharply:

- **Essential state.** The facts the business would still have on paper:
  the bookings that exist, their current status, the stock on hand. This is
  irreducible. Represent it plainly and hold it in one place.
- **Accidental state.** Everything derived, cached, memoised, flagged,
  or held mid-computation. Every item is a second copy of a fact, and can
  disagree with the first.

Most state in most systems is accidental. That is where to look first.

### Why control is second

Control is the specification of _order_: what runs, when, in what
sequence. Some order is essential — you cannot ship before you pack. Most
is not: it is the booking our implementation happens to need.

Accidental control shows up as an initialisation sequence, a setup call
that must precede a use, a flag consulted to decide whether an earlier
step already ran. The problem never mentioned any of it.

The functional answer is to make the booking either **irrelevant** (pure
functions over values, composed) or **explicit in the types** (a state
machine, where the previous step's output type is the next step's input).
See
[modeling-state-machines](../../modeling-state-machines/SKILL.md).

### Why code volume matters at all

All other things being equal, more code is worse: it must be read,
understood, tested, and kept true. This is the source most often
mistaken for a virtue — a large module can look like thoroughness.

It is last of the three because reducing volume is only a gain when the
code removed was not carrying information. Compressing readable code into
clever code trades one source of complexity for another. The legitimate
moves are removing duplication and deepening modules, not shortening
lines.

## Diagnosing with this axis

Add these three steps in front of the procedure in the main skill.

1. **State the requirement in the domain expert's words.** No
   implementation nouns. If you cannot, that is the finding.
2. **List what the code contains that did not appear in step 1.** Flags,
   caches, orderings, adapters, intermediate representations, defensive
   checks.
3. **For each item, ask what would break if it vanished.** The answers
   sort into three piles:

   | Answer                         | What to do                   |
   | ------------------------------ | ---------------------------- |
   | Nothing                        | Delete it                    |
   | A performance requirement      | Keep it, isolate it, name it |
   | A correctness rule lives there | Move the rule into a type    |

Only then run the locality procedure on what is left. Refactoring
accidental complexity is how it becomes permanent: once it has a clean
interface and a test suite, nobody deletes it.

## A worked example

A shipping module has an `isPriced` boolean, a `priceCalculatedAt`
timestamp, and a `recalculatePricing` method that early-returns when
`isPriced` is true.

Step 1, in the domain expert's words: "a booking gets a price before it
can be confirmed."

Step 2, what is in the code but not in that sentence: the boolean, the
timestamp, the early return, and the implicit rule that pricing must not
run twice.

Step 3: the boolean and the early return exist only because pricing is
mutating the booking in place. The timestamp is never read.

```text
-- accidental state and control, removed rather than tidied
type ValidatedBooking = { ... }
type PricedBooking = { booking: ValidatedBooking, price: Money, at: Instant }

priceBooking : Instant -> ValidatedBooking -> PricedBooking
```

`isPriced` is gone because the type answers it. The early return is gone
because pricing a `ValidatedBooking` produces a new value and cannot be
applied to an already-priced one. The timestamp survives, now with a
reader, because it turned out the finance report wanted it.

A refactor would have renamed `recalculatePricing` and extracted its
guard. The complexity would still be there.

## Taking the distinction into the architecture

An architecture can be built from this distinction alone, by giving each
of four parts its own compartment:

| Part                         | Contains                              |
| ---------------------------- | ------------------------------------- |
| Essential state              | The irreducible facts                 |
| Essential logic              | Derivations and constraints over them |
| Accidental state and control | Caches, indexes, ordering hints       |
| Edges                        | Input and output                      |

The shape is recognisable: it is this pack's pure core and imperative
shell, with the extra move of separating _accidental_ state from
essential and confining it to a labelled compartment where it can be
found and deleted later. See
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

Pushed all the way, the essential state in such a design is held as plain
relations rather than per-concept types, so any derivation can read any
fact without a wall in between. That is the data-first position taken to
its conclusion; see
[choosing-types-or-plain-data](../../choosing-types-or-plain-data/SKILL.md)
for when to follow it and when not to.

## The trap

The one thing to distrust is the word "essential" in your own mouth.

"This domain is genuinely complicated" is true of some domains and is
also the universal excuse. The check is step 1 above, done honestly and
out loud: state the requirement in the domain expert's words, and see how
much of the code you have just failed to account for.

If the requirement fits in three sentences and the module is nine hundred
lines, the domain is not what made it nine hundred lines.
