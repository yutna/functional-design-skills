---
name: functional-refactoring-toward-functional-design
description: Use when moving imperative or object-oriented code to functional design, when a code smell needs a move, or when a shape cannot absorb new requirements.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.2.0
---

# Refactoring Toward Functional Design

## Overview

Most functional codebases are not new. They are imperative or
object-oriented systems being moved, module by module, while they keep
running. The work is not a rewrite: it is a sequence of small,
behaviour-preserving moves, each of which pays for itself, applied to the
code you are already editing for another reason.

The second half of the job is keeping a design clean once it is right.
Designs decay by absorbing requirements they were not shaped for, one
reasonable-looking patch at a time.

## When to use

- Editing imperative or object-oriented code in a project moving to a
  functional style
- A new requirement does not fit the existing model
- A module has accumulated special cases
- Deciding whether to patch or restructure
- Planning an incremental migration

Not for: designing something new, which starts at
[functional-design](../functional-design/SKILL.md).

## Core rules

1. Rule. **Ask what breaks if the thing is deleted, before choosing a move
   for it.** A flag, a cache, a required call order or an unread field may be
   complexity you added, and refactoring it is how it becomes permanent. The
   test, and the outcomes it has, are in
   [essential-and-accidental.md](../functional-diagnosing-complexity/references/essential-and-accidental.md).
2. Default. **Refactor where you are already working.** Unrelated cleanup is
   hard to review and hides the real change.
3. Rule. **One move at a time, tests green between each.** A move that cannot be
   verified is a rewrite in disguise.
4. Default. **Choose the module you are editing**, not the centre of the
   system. Inside it, start where the move says (move 4 starts at the
   leaves) and finish at its boundary.
5. Default. **Make each move pay for itself.** If a step leaves the code no
   better, it is not one of the moves below.
6. Default. **Move rules inward, effects outward.** Every step should shrink the
   impure region.
7. Default. **Convert types before functions.** A precise type makes the
   function changes obvious and often mechanical.
8. Rule. **Never widen a type to hold a different concept.** A new case of
   the same kind of thing is added as a case; a different concept gets its
   own type.
9. Rule. **Never two moves in one commit, and tests green after each.**
   A commit is reviewable alone. A move may take more than one commit, as
   move 7 does where the reads have to move first, and the code works
   after every one. For a tactical move, if the tests are not green after
   the first edit and run, or the diff reaches outside the module, revert
   and take a smaller move. Moves 8 to 10 are module-scale and carry no
   time limit. A move left half-applied, with the tests red, is the worst
   state the code can be in.

## The ordered moves

Apply in this order unless a move is blocked;
[migration-moves.md](references/migration-moves.md) says which can come
early. Each one makes the next easier.

| Order   | Move                                         |
| ------- | -------------------------------------------- |
| 1       | Wrap primitives in domain types              |
| 2       | Replace status strings with choice types     |
| 3       | Collapse correlated optionals into cases     |
| 4       | Return `Result` instead of throwing          |
| 5       | Pass the clock, random, and identifiers in   |
| 6       | Turn a service parameter into function types |
| 7       | Extract the pure decision from the effects   |
| 8       | Give the workflow stage types                |
| 9       | Add a boundary mapping, split the DTO        |
| 10      | Make the aggregate opaque                    |

Each move, with its mechanics and its verification, is in
[migration-moves.md](references/migration-moves.md).

Move 1 has one exception. When a value's shape is decided outside the
code — by config, by a tenant, by an admin — wrapping it is the wrong
move. See
[functional-choosing-types-or-plain-data](../functional-choosing-types-or-plain-data/SKILL.md).

## Two tiers of move

The ten moves above are **strategic**: each changes the shape of the
design — what the types are, where effects live, what a module exposes.

Underneath them sit nineteen **tactical** moves that clean up inside a
shape that is already right: Split Phase, Replace Loop with Pipeline,
Remove Flag Argument, and the rest, in
[tactical-moves.md](references/tactical-moves.md).

Get the tier right. Tactical moves applied to a design with the wrong
types produce tidy code that is still wrong.

To find what needs moving in the first place,
[spotting-what-to-fix.md](references/spotting-what-to-fix.md) arranges
symptoms by what each one costs, and names where to go. Read its last two
sections before using the list: four things that are real defects in
object-oriented code are not defects here, and treating them as such
makes the design worse.

## Pattern

A typical starting point, shortened from
[worked-refactor.md](references/worked-refactor.md):

```text
class BookingService {
  async confirm(dto) {
    if (!dto.patientId) throw new Error("bad booking")

    let total = 0
    for (const treatment of dto.treatments) {
      const priced = await this.catalogue.find(treatment.code)
      if (!priced) throw new Error("unknown treatment " + treatment.code)
      total += priced.price * treatment.qty
    }

    const booking = (await this.repo.load(dto.id)) ?? { id: dto.id }
    if (booking.status === "confirmed") throw new Error("already confirmed")

    booking.status = "confirmed"
    booking.confirmedAt = new Date()
    booking.total = total
    await this.repo.save(booking)
    await this.mailer.send(dto.email, "Booking confirmed", render(booking))
    return booking
  }
}
```

After moves 1 to 7 the decision is a pure function and the service is
the handler around it. Each move was one commit except the seventh,
which took two: moving the reads in front of the checks is a change a
caller can see, so it was made alone. The aliases `LoadCatalogue`,
`LoadBooking`, `SaveBooking` and `SendMail` are the function types of
commits 6 and 7 there, and `ConfirmFailure` has the cases `Rejected`,
`Unavailable` and `NotSent`.

```text
-- pure
decideConfirmation :
  Instant -> Catalogue -> Booking -> BookingDto
    -> Result<Booking, ConfirmError>

-- shell
handleConfirm :
  LoadCatalogue -> LoadBooking -> SaveBooking -> SendMail
    -> Instant -> BookingDto -> AsyncResult<Booking, ConfirmFailure>
handleConfirm loadCatalogue loadBooking saveBooking sendMail now dto =
  loadCatalogue ()                                             -- read
    |> bind (\catalogue ->
         loadBooking dto.id |> map (\found -> (catalogue, found)))
    |> mapError Unavailable
    |> bind (\(catalogue, found) ->
         decideConfirmation now catalogue (orDraft dto.id found) dto
           |> mapError Rejected)                               -- decide
    |> bind (\booking ->
         saveBooking booking                                   -- write
           |> mapError Unavailable
           |> bind (\_ ->
                sendMail (confirmationFor dto.email booking)
                  |> mapError NotSent)
           |> map (\_ -> booking))
```

No step required understanding the whole system, and each was
individually reviewable.

## Deciding: patch or restructure

When a new requirement arrives, ask whether it is an instance of what the
module already claims to do.

| Situation                                        | Action                 |
| ------------------------------------------------ | ---------------------- |
| The new case fits the abstraction                | Add it, in the idiom   |
| It is the same kind of thing, wider              | Widen the abstraction  |
| It is a different kind of thing                  | Split it out           |
| It fits only if a flag selects the new behaviour | Split it out           |
| The restructure is not bounded                   | Patch, record the debt |

Bounded means the restructure stays inside the module and its direct
callers and fits one commit. When it is not bounded, tell the user what
you would restructure, make the minimal change, and record the debt as
[keeping-design-clean.md](references/keeping-design-clean.md) describes.

The flag row is the one people get wrong. A boolean parameter added to
select behaviour is the standard sign that two things have been merged.
See
[functional-splitting-and-joining-code](../functional-splitting-and-joining-code/SKILL.md).

## Keeping it clean afterwards

- What each change owes the module is stated in
  [functional-programming-strategically](../functional-programming-strategically/SKILL.md).
- When a comment becomes false, fix it in the same edit.
- When a name stops matching, rename it in the same edit.
- When the purpose sentence acquires an "and", split before adding more.
- Record every knowingly deferred improvement in the module, not in a
  ticket. See
  [keeping-design-clean.md](references/keeping-design-clean.md).

## Red flags

- A refactoring branch that has outlived the limit in
  [keeping-design-clean.md](references/keeping-design-clean.md)
- A commit that changes behaviour and structure together
- A migration that requires the whole team to stop
- A new adapter layer added before anything is moved through it
- Both the old and the new shape in use with no plan to remove one
- A "temporary" flag distinguishing old and new code paths

## Common mistakes

- **Rewriting instead of moving.** A rewrite reproduces the design unless
  you can say what was wrong with it.
- **Building the target architecture first.** Folders and interfaces
  named after the destination, with the old code still inside.
- **Converting everything to `Result` at once.** Do it module by module,
  converting at each boundary as you reach it.
- **Migrating code nobody edits.** Effort is best spent where the change
  rate is highest.
- **Leaving two idioms in place.** Finish each module; do not leave half.
- **Refactoring without tests.** Pin the current behaviour first, by
  asserting something false and letting the failure tell you what the
  code actually returns. Those tests need not be pretty and can be
  deleted afterwards. See
  [migration-moves.md](references/migration-moves.md).

## Related skills

- [functional-programming-strategically](../functional-programming-strategically/SKILL.md)
- [functional-reviewing-functional-design](../functional-reviewing-functional-design/SKILL.md)
- [functional-diagnosing-complexity](../functional-diagnosing-complexity/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)

## Further reading

- [migration-moves.md](references/migration-moves.md) is each move with
  its mechanics, its verification, and its payoff, preceded by how to
  pin untested behaviour and where to stand while you do.
- [tactical-moves.md](references/tactical-moves.md) is the nineteen
  tactical moves, with the commit discipline they depend on.
- [spotting-what-to-fix.md](references/spotting-what-to-fix.md) arranges
  symptoms by what they cost, and names the four that are not defects
  here at all.
- [keeping-design-clean.md](references/keeping-design-clean.md) covers
  absorbing new requirements without decay.
- [worked-refactor.md](references/worked-refactor.md) moves one legacy
  service through the ten moves, with the verification at each commit.
