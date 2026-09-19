# Keeping a Design Clean

A design decays by absorbing requirements it was not shaped for. Each
patch is locally reasonable; the sum is a module nobody can describe.

## The question for every new requirement

**Is this an instance of what the module already does?**

Answer it before writing code, by stating the module's purpose in one
sentence and checking whether the new case is covered by that sentence
unchanged.

| Answer                              | Action                       |
| ----------------------------------- | ---------------------------- |
| Yes, exactly                        | Add it in the existing idiom |
| Yes, if the sentence gets wider     | Widen deliberately           |
| No, it is a different kind of thing | Give it its own home         |
| Only with a flag                    | It is a different thing      |

## Widening well

Widening is right when the new case is genuinely the same kind of thing.
Do it by generalising the concept, not by adding an alternative path.

```text
-- narrow
type Discount = Percent of Percentage

-- widened well: the concept grew
type Discount = Percent of Percentage | FixedAmount of Money

-- widened badly: a second path bolted on
type Discount = { percent: Option<Percentage>,
                  amount: Option<Money> }
```

After widening, re-read every function over the type. Exhaustive matching
will list them; that list is the work, and skipping it with a wildcard is
how the second case silently misbehaves.

## Signals of decay

| Signal                                | What it means              |
| ------------------------------------- | -------------------------- |
| A boolean parameter selects behaviour | Two functions in one       |
| A new optional field for one caller   | A special case leaked in   |
| The purpose sentence grew an "and"    | Two modules in one         |
| A wildcard added to a match           | A case nobody considered   |
| A type widened to hold a new shape    | A different concept merged |
| A comment explaining an exception     | The abstraction is wrong   |
| Copy of a function with one change    | A missing parameter        |

Any two of these in one module is worth stopping for.

## The upkeep rules

1. **Fix the comment and the name in the same edit.** A stale name is a
   lie the next reader will believe.
2. **Delete what the change made dead.** Unused exports, obsolete cases,
   superseded helpers. Dead code is read as if it were live.
3. **Re-read the purpose sentence after each change.** It is the cheapest
   design check there is.
4. **Take the extra step when it is small.** If the same flaw sits in the
   neighbouring function, fix it now, unless it is a project.
5. **Record deferred work where it will be found.** In the module, next
   to the code, saying what the right design is and what blocked it.

## Recording debt

```text
-- The expiry rule is duplicated in the billing module. It belongs
-- here, but moving it needs billing's storage migration, scheduled
-- for Q3. Until then, change both. See billing/expiry.
```

Three things: what is wrong, what the right design is, and what is
blocking it. Without the third, the next reader cannot tell whether it
was a decision or an oversight, and will preserve it either way.

## When the abstraction is simply wrong

Sometimes the honest answer is that the module was shaped for a world
that no longer exists. Then:

1. State what the right abstraction would be, in one sentence.
2. Check whether the change under way is a natural place to move towards
   it. Usually it is, partially.
3. Do the part that fits inside the current change; record the rest.
4. Do not open a separate refactoring branch. See
   [migration-moves.md](migration-moves.md) for how to move a module
   incrementally while it stays in use.

## The test that catches decay early

Ask a colleague, or re-read after a break: **describe what this module
does, without looking at the function list.** A module whose description
has become a list is a module that has lost its abstraction, and it will
keep absorbing whatever arrives next.
