# Laziness in Practice

A lazy value is a computation that has not run. It runs when something
demands its result, and, in most implementations, at most once.

## What laziness is for

**Sequences without a fixed size.** Describe the sequence, consume a
prefix.

```text
fibs = unfoldForever (\(a, b) -> (a, (b, a + b))) (0, 1)
take 20 fibs
```

**Processing data larger than memory.** The pipeline reads like a list
operation but holds one element at a time.

```text
readLines path |> map parse |> filter valid |> fold count 0
```

**Work that may not be needed.** A fallback, a diagnostic message, an
alternative that is only computed when the first choice fails.

## What laziness is not for

Making strict code look tidier. A lazy value carries an allocation, an
indirection, and a reference to everything it closed over. In a strict
language, spreading laziness through a codebase costs more than it
returns.

## The leak pattern

```text
-- a lazy total, stored in a long-lived cache
cache = insert key (lazy (expensiveSum hugeList)) cache
```

The unevaluated computation holds `hugeList` alive for as long as the
cache holds the entry, which may be forever. This is the characteristic
lazy-language memory bug and it is easy to reproduce in strict languages
with closures.

Rules that prevent it:

1. Do not store unevaluated computations in long-lived structures. Force
   before inserting.
2. Force before crossing a boundary into the shell, so the cost and any
   failure appear where they can be attributed.
3. In an accumulator, force each step. A lazy accumulator builds a chain
   of unevaluated additions that overflows when finally demanded.

## Streams and effects

Streaming reads well until an effect is placed in the middle. Then the
order of the effects depends on the consumer's demand, which is invisible
from the pipeline.

```text
-- when does the write happen? how many times?
rows |> map (\r -> writeAudit r; transform r) |> take 10
```

Keep effects at the ends: a source that produces, pure transformations in
the middle, a sink that consumes. Where an effect genuinely belongs in
the middle, use the language's effectful stream type, which makes the
ordering explicit, rather than a lazy sequence with a side effect hidden
in a lambda.

## Traversing twice

Some lazy sequences are single-use: consuming them a second time either
recomputes everything or yields nothing, depending on the language. Both
are surprising.

```text
let results = expensivePipeline input
let count = length results          -- traversal one
let first = head results            -- traversal two: recomputed?
```

If a sequence is consumed more than once, materialise it into a list
first, and accept the memory cost knowingly.

## Choosing strict or lazy

| Situation                         | Choose |
| --------------------------------- | ------ |
| Collection fits in memory         | Strict |
| Every element will be used        | Strict |
| A value is stored for a long time | Strict |
| The sequence has no end           | Lazy   |
| Only a prefix will be consumed    | Lazy   |
| Data is larger than memory        | Lazy   |
| The computation may be unneeded   | Lazy   |

The default is strict. Reach for laziness when one of the last four rows
applies, and force at the boundary in every case.

## Laziness in strict languages

The idea survives without language support:

- A function of no arguments is a delayed computation.
- An iterator or generator is a lazy sequence.
- A memoised function of no arguments is a lazy value evaluated once.

The language packs give the concrete constructs. The rules above apply
unchanged, and the leak pattern is if anything easier to hit, because a
closure's captured references are less visible.
