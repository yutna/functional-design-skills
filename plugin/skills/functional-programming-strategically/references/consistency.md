# Consistency

Consistency lowers cognitive load: if two things look the same, a reader
can assume they behave the same, and can carry knowledge from one part of
the system to another. It is one of the few design properties that costs
nothing to maintain and everything to restore once lost.

## What to be consistent about

| Area           | Make identical across the codebase      |
| -------------- | --------------------------------------- |
| Names          | One word per concept, everywhere        |
| Types          | One representation per domain concept   |
| Errors         | One error mechanism per layer           |
| Effects        | One way to express asynchrony           |
| Module shape   | Same file layout, same export style     |
| Pipelines      | Same step order and naming convention   |
| Validation     | Same place, same direction, same result |
| Data direction | Same mapping strategy at every boundary |

## Rules

1. **Match the surrounding code before expressing a preference.** A worse
   convention applied uniformly beats a better one applied in patches.
   Where the project states its conventions, those are what "uniformly"
   means: code contradicting a written rule is debt, not a second
   convention, and a codebase carrying grandfathered lint findings holds
   both at once.
2. **When a convention is wrong, change it everywhere or nowhere.** Two
   conventions in one codebase are worse than either alone.
3. **Enforce mechanically where possible.** A formatter or lint rule
   never argues, never forgets, and costs no review time.
4. **Document the conventions that tools cannot enforce.** Where errors
   go, what a pipeline step is allowed to do, which layer may touch I/O.
5. **Do not vary for variety.** Similar things should look identical.
   Different things must look different, so reserve variation to signal
   real difference.

## The dangerous kind of inconsistency

Similar things that behave differently. Two functions named `parseX` and
`readX` where one returns `Result` and the other throws teaches a reader
a rule that is false, and the false rule will cause a bug in a third
place. Prefer a name that signals the difference, or make them the same.

## Introducing a new convention

- Say what it replaces, or it becomes a third way of doing the thing.
- Apply it to at least the module you are in, not just your new lines.
- Write it where the agent and the humans both look: the project's
  instructions file, not only a wiki page.
