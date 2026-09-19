# Tactical Moves

The ten moves in [migration-moves.md](migration-moves.md) change the
_shape_ of a design: what the types are, where effects live, what a module
exposes. The nineteen here clean up _inside_ a shape. They are smaller,
they are mechanical, and each should take a couple of minutes.

Use them after the strategic moves have decided the shape, or on their
own when the shape is already right and the code is merely awkward.

## Shaping a function's body

### Extract Function

**When.** A fragment of a function can be given a name that says what it
does rather than how.
**Mechanics.** Copy the fragment out, pass every value it reads as an
argument, return every value it produces, call it from the original.
**Verify.** The new function is pure unless the fragment was not. If you
cannot name it without "and", the fragment was not one thing.
**Counter-pressure.** Do not extract a fragment that only makes sense in
place — two functions neither of which reads alone is worse than one long
one. See
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

### Inline Function

**When.** The body is as clear as the name, or the function only
forwards.
**Mechanics.** Replace each call with the body; delete the function.
**Verify.** No caller was relying on the name to mean something the body
does not say.

### Slide Statements

**When.** Related lines are separated by unrelated ones.
**Mechanics.** Move declarations next to their use. In functional code
this is almost always legal, because expressions have no side effects to
reorder.
**Verify.** Nothing moved across an effect. If reordering changed
behaviour, you found a hidden effect — go to
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

### Split Phase

**When.** One function does two things in sequence, with a value passing
between them — parse then evaluate, gather then decide, decide then
apply.
**Mechanics.** Name the intermediate value, give it a type, and split at
that line into two functions.
**Verify.** The intermediate type is meaningful on its own. This is the
single most valuable move in this file: it is how pipelines get built,
and how a pure decision gets separated from its effects.

### Combine Functions into Transform

**When.** Several functions each derive a value from the same input, and
callers call them all.
**Mechanics.** Write one function returning a record of the derived
values; have the old functions read from it, then retire them.
**Verify.** Every caller wanted all the fields. If most want one, leave
them separate.

### Substitute Algorithm

**When.** A clearer algorithm exists for the same function.
**Mechanics.** Write the new body beside the old, test both against the
same cases, then swap and delete.
**Verify.** Not a behaviour change — if the results differ anywhere, this
is a bug fix and belongs in its own commit.

## Removing intermediate state

### Split Variable

**When.** One name is assigned more than once for more than one purpose.
**Mechanics.** Give each purpose its own immutable binding, named for
what it holds.
**Verify.** No binding is assigned twice. A name that means two things is
the smallest form of mutable state.

### Replace Temp with Query

**When.** A local holds a value derived from other locals.
**Mechanics.** Replace it with a function of those values, called where
the local was read.
**Verify.** The function is pure. This trades a value for a computation;
take it when the derivation is the interesting part.

### Replace Derived Variable with Query

**When.** A field holds something computed from other fields, kept in
step by hand.
**Mechanics.** Delete the field; expose a function that computes it.
**Verify.** No writer of the deleted field remains. This removes
accidental state, so the two copies can no longer disagree. See
[essential-and-accidental.md](../../diagnosing-complexity/references/essential-and-accidental.md).

### Replace Loop with Pipeline

**When.** A loop accumulates into a variable.
**Mechanics.** Name each stage — filter, then map, then fold — and chain
them.
**Verify.** No mutation survives. If a stage needs the accumulator so
far, it is a fold and should say so. See
[folding-over-data](../../folding-over-data/SKILL.md).

## Shaping a signature

### Change Function Declaration

**When.** The name is wrong, or the parameters are.
**Mechanics.** Add the new signature beside the old, make the old one
call the new one, migrate callers, delete the old.
**Verify.** Never the name and the parameters in one commit — you lose
the ability to tell which broke something.

### Introduce Parameter Object

**When.** The same group of arguments travels together.
**Mechanics.** Define a record for the group, take it instead.
**Verify.** The record has a domain name, not `Params`. If you cannot
name it, the group is not a concept and this move is premature.

### Preserve Whole Object

**When.** A caller pulls several fields out of a value to pass them in
separately.
**Mechanics.** Pass the whole value; read the fields inside.
**Verify.** The callee genuinely belongs to that concept. Otherwise you
have widened a dependency, not narrowed one — see
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

### Remove Flag Argument

**When.** A boolean parameter selects behaviour.
**Mechanics.** Split into one function per branch, named for what it
does.
**Verify.** Neither new function takes the flag. This is the strongest
signal in the catalogue: a behaviour-selecting boolean is two functions
that were merged.

### Parameterize Function

**When.** Two functions differ only by a literal value.
**Mechanics.** Add a parameter for the value; keep thin named wrappers if
callers read better with them.
**Verify.** The bodies are now identical. If they are merely similar, do
not merge them.

### Separate Query from Modifier

**When.** One function both returns a value and changes something.
**Mechanics.** Split into a pure function that computes and an effectful
one that applies.
**Verify.** The query is pure and the modifier returns nothing
interesting. This is command-query separation, and in this pack it is a
rule rather than a refactoring.

## Shaping a conditional

### Replace a Repeated Conditional with a Sum Type

**When.** A conditional branches on a kind-of-thing, in several places.
**Mechanics.** Define a sum type with one case per branch and replace
each conditional with an exhaustive match. The object-oriented form of
this move creates a subclass per case instead; the sum type is the
functional equivalent and keeps the dispatch total.
**Verify.** The match is total, with no wildcard. This is the same move as
Replace status strings with choice types in
[migration-moves.md](migration-moves.md); this is its local form.

### Introduce Special Case

**When.** Callers repeatedly check for the same special value — usually
null, absent, or unknown.
**Mechanics.** Give the special case a representation: `Option`, or a
named case on the sum type, or a value that behaves correctly by default.
**Verify.** The checks are gone from the callers, not merely moved. This
is how errors get defined out of existence: see
[defining-errors-out-of-existence](../../defining-errors-out-of-existence/SKILL.md).

### Replace Function with Command

**When.** An operation needs its own arguments assembled over time, or
must be queued, retried, logged, or authorised.
**Mechanics.** Represent the request as data — a record with everything
the operation needs — and have one function interpret it.
**Verify.** The command is a value with no behaviour attached. Reaching
for this without one of those needs is speculative generality. It is also
the prerequisite for anything in
[making-effects-reliable](../../making-effects-reliable/SKILL.md), which
needs a request it can identify and replay.

## The discipline

The process matters more than any individual move, and it is the part
most often skipped.

1. **Confirm the code should exist before you tidy it.** A move applied
   to complexity that should have been deleted makes the deletion harder
   forever. See
   [essential-and-accidental.md](../../diagnosing-complexity/references/essential-and-accidental.md).
2. **Tests green before you start.** If they are not, you are debugging,
   not refactoring.
3. **One move per commit.** A commit that changes behaviour and structure
   together cannot be reviewed or reverted usefully.
4. **If a move takes more than a few minutes, it was too big.** Revert
   and take a smaller one. Do not push through — a half-applied move is
   the worst state the code can be in.
5. **Never mix a refactoring commit with a fix.** If the results differ,
   that is a behaviour change and it needs its own commit and its own
   test.
6. **Refactor where you are already working.** Unrelated cleanup is hard
   to review and hides the real change.

## Choosing a tier

| The problem is                        | Tier      |
| ------------------------------------- | --------- |
| The types are wrong                   | strategic |
| Effects are tangled with decisions    | strategic |
| A module exposes too much             | strategic |
| The shape is right, the code is messy | tactical  |
| A function is hard to read            | tactical  |
| A signature is awkward to call        | tactical  |

Applying tactical moves to a design with the wrong types produces tidy
code that is still wrong. Start at
[migration-moves.md](migration-moves.md) when in doubt.
