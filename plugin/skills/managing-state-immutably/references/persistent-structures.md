# Persistent Data Structures

A persistent structure produces a new version on every change while
sharing everything unchanged with the previous version. That is what
makes immutability affordable: "copying" a large map to change one key
does not copy the map.

## Structural sharing

A list built by prepending shares its whole tail:

```text
a = [2, 3, 4]
b = cons 1 a        -- b is [1, 2, 3, 4]
                    -- b's tail IS a; nothing was copied
```

Trees behave the same way with more branching. Updating one key in a
persistent map rebuilds only the path from the root to that key, which is
a handful of small nodes, and shares every other branch.

The consequences that matter in practice:

- Old versions stay valid and cost nothing to keep
- Readers never see a partially updated structure
- Passing a structure to another thread needs no copy and no lock
- Undo, history, and snapshots become trivial

## Choosing the structure

| Need                       | Structure                 |
| -------------------------- | ------------------------- |
| Add and remove at one end  | Linked list               |
| Index by key               | Persistent map or trie    |
| Append and index by number | Persistent vector         |
| Ordered iteration by key   | Balanced tree map         |
| Membership only            | Persistent set            |
| A queue                    | Two lists, front and back |

Do not hand-roll these; they are a source of subtle bugs. Where to get
them differs more than the design does, and this is the one place the
neutral advice would be wrong:

| Stack                    | Where the structures come from          |
| ------------------------ | --------------------------------------- |
| Elixir, Erlang           | The language: lists, maps, `MapSet`     |
| Clojure                  | The language: every core collection     |
| Haskell, F#, Scala       | The standard library                    |
| JavaScript, TypeScript   | Nothing built in; add `immutable`       |

The last row is why the table exists. JavaScript's `Object.freeze`,
spread, and the `toSorted` family produce a new value by copying, not by
sharing structure, so "immutable" there costs linear time and memory on
every change. That is fine for a record with six fields and wrong for a
map with fifty thousand entries updated per request.

Two ways out, and they are not the same thing:

- **`immutable`** gives real persistent collections — `Map`, `List`,
  `Set` — with structural sharing. Its values are not plain objects, so
  keep them inside the module that owns the data and convert at that
  module's edge.
- **`immer`** does not. It gives you a mutable-looking draft and
  produces a frozen plain object, sharing the parts you did not touch.
  That removes the nested-spread problem and keeps plain objects, which
  is usually what a domain type wants; it does not make a large map
  cheap to update in a loop.

Reach for the first when a profile shows copying costs, and the second
when the pain is nested updates rather than size.

## Cost model

| Operation                 | Typical cost           |
| ------------------------- | ---------------------- |
| Prepend to list           | Constant               |
| Append to list            | Linear; use a vector   |
| Update one key in a map   | Logarithmic, small     |
| Read any key              | Logarithmic, small     |
| Copy the whole structure  | Free; share it         |
| Convert to a native array | Linear; do it at edges |

The pattern that hurts is repeatedly appending to a list inside a loop.
The fix is to build in reverse and reverse once, or to use a vector, or
to fold. See [folding-over-data](../../folding-over-data/SKILL.md).

## Batch updates

When many changes are applied at once, most libraries provide a transient
or builder mode: a mutable version, used locally, frozen at the end.

```text
bigMap
  |> transient
  |> applyAll thousandsOfChanges
  |> persistent
```

This is legitimate local mutation: the mutable value never escapes, and
the function's signature is unchanged. It is the one case where mutating
inside a pure function is safe, and it should be justified by a
measurement. See
[designing-for-performance.md](../../programming-strategically/references/designing-for-performance.md).

## Immutability in languages without persistent collections

Most mainstream languages have arrays and maps that copy on write, or
libraries that add persistent versions. Rules that work everywhere:

1. Never mutate a value a caller gave you.
2. Never return a reference to internal mutable state; return a copy, or
   an immutable view.
3. Freeze at construction where the language allows it, and freeze deeply
   or not at all.
4. Prefer building a new value from a fold over mutating an accumulator
   in a loop.
5. Where copying a large structure per change is genuinely too slow,
   introduce a persistent collection library rather than reverting to
   mutation.

The language packs give the concrete choices for each ecosystem.

## Recursion and old versions

Because previous versions remain valid, algorithms that need to backtrack
become simple: keep the earlier value and return to it. No undo log, no
inverse operation, no snapshot mechanism.

```text
search state =
  match nextMoves state with
  | [] -> Nothing
  | moves -> tryEach (\m -> search (apply m state)) moves
  -- `state` is untouched by any recursive call
```

This is the same property that makes pure functions safe to run in
parallel, viewed from a different angle.
