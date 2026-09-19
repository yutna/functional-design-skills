# Depth Audit

A repeatable pass to decide whether a module is deep enough to keep as it
stands.

## Step 1: write the interface out

List, on one page:

- every exported function's signature
- every type that appears in those signatures, expanded one level
- every failure case a caller must handle
- every rule a caller must obey that is not in a type

The last group is the one people forget, and it is usually the largest.

## Step 2: write the purpose in one sentence

State what the module does, without "and", without listing functions. If
you cannot, the module has more than one purpose; see
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md).

## Step 3: score it

| Signal                                              | Points |
| --------------------------------------------------- | ------ |
| Purpose stated in one sentence, no "and"            | +2     |
| Common case is one call                             | +2     |
| Implementation is substantially larger than surface | +2     |
| Every export is meant for callers                   | +1     |
| Failure cases are in types, not prose               | +1     |
| No required call order outside the types            | +1     |
| Exports map one-to-one onto internal steps          | -2     |
| Callers must combine exports to do anything useful  | -2     |
| A caller must know the storage or wire format       | -2     |
| Any export exists only for tests                    | -1     |
| Purpose sentence needs "and"                        | -1     |

## Step 4: act on the score

| Score     | Verdict and action                                   |
| --------- | ---------------------------------------------------- |
| 6 or more | Deep. Leave it alone.                                |
| 3 to 5    | Adequate. Fix the negatives you scored.              |
| 0 to 2    | Shallow. Merge it into its caller.                   |
| Below 0   | The boundary is wrong. Redesign before adding to it. |

## Worked audit

A module exporting `parseDate`, `formatDate`, `addDays`, `diffDays`,
`isWeekend`, `startOfMonth`, `TZ_DEFAULT`.

Purpose in one sentence: "date utilities". That is a category, not a
purpose, so it scores -1. Exports map one-to-one onto their
implementations: -2. No required call order: +1. Every export is meant
for callers: +1. Common case is one call: +2. Total: 1. Shallow.

The verdict is not "delete it": general date handling is genuinely
reusable. The verdict is that this is not a domain module, and no domain
concept should be built out of it in a caller. The fix is a domain module
above it, deep in the way this one cannot be:

```text
-- BillingPeriod: one thing to know, real work hidden
periodFor : Instant -> Plan -> BillingPeriod
daysRemaining : BillingPeriod -> Instant -> Days
```

Callers now speak about billing periods. The date library stays, used by
one module instead of twenty.
