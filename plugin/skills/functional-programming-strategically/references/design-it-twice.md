# Design It Twice

The first design that comes to mind is rarely the best one, and the cost
of trying a second is minutes of thought against months of living with
the first. Doing it twice also teaches you the space of designs, which
makes your first ideas better over time.

## When it is worth it

Do it for anything whose shape other code will depend on: a module
interface, a workflow's step boundaries, a domain type, an error model, a
concurrency approach. Skip it for a bug fix inside one function.

## The procedure

1. Write the first design as a set of type signatures only. No bodies.
2. Write down what you dislike about it, even if it is only a feeling.
3. Produce a second design that is **radically** different, not a tidied
   version of the first. If you cannot, use the prompts below.
4. Compare the two against explicit criteria (also below).
5. Choose one, and take the best idea from the loser into the winner.
6. Record in a comment why the rejected design was rejected, if the
   reason is not obvious from the code.

## Prompts for a genuinely different second design

- Invert the dependency: what if the caller supplied the behaviour?
- Move the decision: what if the choice were made at parse time instead
  of at use time, or the reverse?
- Change the data: what if this were one choice type instead of three
  optional fields, or a list instead of a map?
- Change the split: what if these two modules were one, or this one were
  two?
- Push the effect: what if the I/O happened one layer out?
- Make it total: what if the failure case were impossible by
  construction rather than handled?

## Criteria for comparing

| Criterion            | Question to ask                            |
| -------------------- | ------------------------------------------ |
| Interface simplicity | Which is easier to use correctly?          |
| Depth                | Which hides more behind the same surface?  |
| Illegal states       | Which lets fewer bad values exist?         |
| Testability          | Which needs less setup to test?            |
| Change absorption    | Which absorbs the likely next requirement? |
| Failure clarity      | Which makes failure modes visible?         |

Interface simplicity outranks implementation simplicity. A harder
implementation behind an easier interface is a good trade; the reverse
never is.

## Worked comparison

Requirement: a report can be produced as CSV, JSON, or PDF.

**Design A, one function per format.** Three exported functions, each
taking the report data. Callers pick. Adding a format adds a function and
every caller that offers "all formats" changes.

**Design B, a format as a value.** One exported function taking a
`Format` choice type. Adding a format is one new case, and the compiler
or test suite lists every place that must handle it.

B wins on change absorption and illegal states; A wins on nothing except
that it is what came to mind first. Take from A the idea that each format
lives in its own module, and have B dispatch to those.

## Common failure

Producing a "second design" that is the first with renamed parts. The
test: if the two designs would fail on different requirements, they are
genuinely different. If they would fail on the same one, you have one
design written twice.
