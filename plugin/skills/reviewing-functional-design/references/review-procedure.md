# The Review Pass in Detail

Work through the steps in order. Record findings; do not repair as you
go. Each step lists the question, what a bad answer looks like, and where
the fix is.

## Step 1: types

- **Can any type hold a state the business forbids?** Count the states.
  Correlated optional fields, a status field beside data that only some
  statuses use, an empty collection where one element is required.
- **Are domain values primitives?** Identifiers, codes, quantities,
  money, dates as raw strings and numbers.
- **Does a type mix domain and transport concerns?** Nullable fields the
  database needs, framework annotations, field names from JSON.

Fixes:
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md),
[constraining-primitive-values](../../constraining-primitive-values/SKILL.md),
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Step 2: signatures

- **Is every exported function total?** Search for throws, nulls, and
  sentinel returns.
- **Are the failures named?** A `Result` with a string error is barely
  better than an exception.
- **Are effects visible in the type?** A function that reads a clock or
  writes a row must say so.
- **Could two parameters be transposed?** Adjacent parameters of the same
  type will be swapped eventually.

Fixes:
[composing-functions](../../composing-functions/SKILL.md),
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Step 3: interfaces

- **Write the module's purpose in one sentence.** If it needs "and",
  record a finding.
- **Is the interface much smaller than what it hides?** Include the
  informal parts: required call order, value constraints, idempotency.
- **Is anything exported that no outside caller uses?** Especially
  anything exported for tests.

Fixes:
[designing-deep-modules](../../designing-deep-modules/SKILL.md),
[hiding-information](../../hiding-information/SKILL.md).

## Step 4: dependencies

- **Does the domain import infrastructure?** One import is enough to
  record the finding.
- **Does any function take more than it uses?** A repository, a service,
  a context object.
- **Is a value threaded through functions that never read it?**
- **Which way do the arrows point?** The volatile code must depend on the
  stable code.

Fixes:
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md),
[applying-solid-functionally](../../applying-solid-functionally/SKILL.md).

## Step 5: duplicated knowledge

- **Search for repeated literals**: strings compared for equality,
  numeric thresholds, format patterns.
- **Ask of each pair: would they need the same edit?** Same edit means
  duplication. Different edits mean two rules that happen to agree.

Fixes:
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md),
[hiding-information](../../hiding-information/SKILL.md).

## Step 6: names and comments

- **Any name that could apply to anything?**
- **Any name whose meaning needs the comment beside it?**
- **Any comment that restates the code?**
- **Any comment the change just made false?**
- **Any exported function with a non-obvious contract and no comment?**

Fixes:
[choosing-precise-names](../../choosing-precise-names/SKILL.md),
[writing-useful-comments](../../writing-useful-comments/SKILL.md).

## Step 7: effects

- **Any I/O, clock, or randomness inside a decision?**
- **Any business conditional inside the shell?**
- **Does the workflow perform effects, or return them?**
- **Are retries, transactions, and logging at the edge?**

Fixes:
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

## Step 8: tests

- **Does any business rule need infrastructure to test?** That is a
  design finding, not a testing one.
- **Does any test assert on interactions rather than outcomes?**
- **Are the failure paths tested at all?**
- **Was a test changed to match the code rather than the requirement?**

Fixes:
[testing-functional-code](../../testing-functional-code/SKILL.md).

## Producing the output

Group findings by rank, not by file. For each:

```text
Rank 2  skills/bookings/pricing: the discount threshold 5000 also
        appears in reporting/summary. One of them will change alone.
        Fix: export `qualifiesForDiscount` from pricing and call it.
        Skill: hiding-information
```

Three lines: where and what, the smallest fix, the rule. Anything longer
is a redesign proposal, which is a separate conversation.

## Calibrating effort

| Change under review      | Depth of pass                 |
| ------------------------ | ----------------------------- |
| One-line fix             | Steps 2 and 6                 |
| A new function           | Steps 1, 2, 6                 |
| A new module or workflow | All eight                     |
| A refactor               | All eight, plus the purpose   |
| An unfamiliar codebase   | Steps 1, 3, 4 locate the rest |

For a refactor, write the module's one-sentence purpose before and after
the change; if the sentence did not get shorter or clearer, ask what the
refactor bought.
