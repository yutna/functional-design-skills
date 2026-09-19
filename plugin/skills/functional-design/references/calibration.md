# Calibrating Design Effort

These skills describe what good design looks like when design is
warranted. They do not, on their own, say when it is not. That question
comes first, because applying the whole pack to a small task produces
exactly the thing the pack exists to remove: structure the problem did
not ask for.

## The rule

**Design effort is chosen from what the change will be depended on by,
not from how interesting it is.** A type that only one function will ever
see needs almost nothing. A type that appears in an exported signature
will be read by everyone, forever, and deserves the full treatment.

## The four sizes

### An answer, not code you keep

A one-off script, a data probe, a migration run once, a spike that
answers "can we". The output is knowledge.

- Write it directly. No wrapper types, no `Result`, no module boundary.
- Say in the first line what it is and that it is throwaway.
- Delete it, or move it out of the source tree.

The one rule that still applies: if you keep it, it stops being this
size, and you re-classify it.

### One function, inside a module that already exists

- **Do:** give it an honest signature, make it total, name it precisely.
- **Do not:** invent a wrapper type for a local intermediate, add an
  error union nobody branches on, or create a module for it.
- **Match what is there.** The module already decided how it handles
  errors and effects; a second convention inside one module is worse
  than either.

A local value that lives and dies inside one function is not worth a
type. The threshold is whether it appears in a signature someone else
reads.

### A feature in a flow that already exists

- **Do:** follow the flow's existing pipeline and stage types; add a new
  case to an existing choice type; extend the error union with the
  failure the feature really introduces; leave the module slightly
  better than you found it.
- **Do not:** introduce a bounded context, a new aggregate, a second
  error mechanism, or a boundary mapping that the flow does not have.
- **Watch for the exception:** if the feature does not fit the flow's
  abstraction, that is a design finding, and it is the moment to
  restructure rather than to add a flag. See
  [working-in-existing-code.md](../../programming-strategically/references/working-in-existing-code.md).

### A new module, workflow, or context

The full loop earns its cost here, because the shape you choose is what
other code will depend on. This is also where designing it twice pays,
and where the interface deserves a comment written before the body.

## Over-applying: what it looks like

| Symptom                              | Right size            |
| ------------------------------------ | --------------------- |
| A branded type for a local variable  | A plain value         |
| An aggregate around a config file    | A record and a parser |
| A `Result` whose error nobody reads  | Return the value      |
| A workflow pipeline of two steps     | One function          |
| A bounded context for one screen     | A module              |
| Dependency parameters never varied   | Call it directly      |
| A choice type with one case          | Delete the wrapper    |
| An interface with one implementation | The concrete thing    |

Each of these adds interface, a name to learn, and a hop to follow, in
exchange for nothing. The cost is real and it is paid by every future
reader.

## Under-applying: what it looks like

The failure is not symmetrical, so do not read the list above as licence
to skip the work. These are the cases where "keeping it simple" is the
expensive choice:

| Symptom                                  | What it will cost      |
| ---------------------------------------- | ---------------------- |
| A status string that reaches two modules | Silent divergence      |
| A domain value passed as `String`        | Transposed arguments   |
| A thrown exception across a module edge  | An unhandled branch    |
| A rule enforced in the caller            | A caller that forgets  |
| I/O inside a decision                    | A rule nobody can test |
| A record with correlated optionals       | Illegal states         |

The asymmetry: over-applying costs reading effort, which is recoverable
by deleting the excess. Under-applying costs correctness, and it is
usually discovered from a bug report.

## Deciding in the moment

Three questions, in order:

1. **Will anything outside this file depend on the shape?** If no, keep
   it plain. If yes, the type and the name matter.
2. **Can this hold a value the business forbids?** If yes, fix that,
   whatever the size of the task. This is the one rule that applies at
   every size.
3. **Would a reader need to be told something to use it correctly?** If
   yes, put it in the type, the name, or a comment, in that order.

Anything that survives all three is worth the design effort. Anything
that does not is finished.

## Re-classifying

Sizes ratchet upward, never down. A script that gets scheduled is no
longer throwaway; a helper that gains a second caller now has an
interface. When that happens, say so and apply the heavier row then —
not at the beginning "just in case", which is how speculative generality
gets built.
