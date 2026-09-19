---
name: testing-functional-code
description: Use when writing tests for functional code, when tests need heavy mocking or a database to check a rule, or when deciding what to test and how.
---

# Testing Functional Code

## Overview

Testing a functional system is mostly easy and occasionally hard, and the
split is exactly the split between core and shell. Pure functions are the
easiest things in software to test: call them with values, assert on
values, no setup and no teardown. Effects are genuinely hard to test, so
the design goal is to have few of them, all at the edges.

That makes test difficulty a design instrument. When a business rule is
hard to test, the test is not the problem; the rule is entangled with an
effect, and the fix is in the design.

## When to use

- Writing tests for a workflow, a domain type, or a pipeline
- A test needs a mocking framework to exercise a business rule
- Deciding how much to test and at which level
- A test suite is slow, brittle, or ignored
- Choosing between example tests and property tests

Not for: deciding what the design should be, though the tests will tell
you when it is wrong.

## Core rules

1. **Test the core with values.** No framework, no doubles, no setup. If
   that is not possible, fix the design first.
2. **Test the shell with a few integration tests.** Prove the wiring, the
   mapping, and the transactions; do not re-test business rules there.
3. **Stub capabilities with plain functions.** A dependency that needs a
   mocking library is too wide. See
   [applying-solid-functionally](../applying-solid-functionally/SKILL.md).
4. **Assert on returned values, not on interactions.** A test that checks
   which functions were called is testing the implementation.
5. **Use properties where the rule is general.** Round trips, invariants,
   and totality are better stated as properties than as examples.
6. **Test the design, not the coverage number.** A suite that covers
   every line and no failure mode is worse than an honest smaller one.
7. **Let a hard test change the design.** Difficulty is information.

## What to test where

| Subject                      | Kind of test                       |
| ---------------------------- | ---------------------------------- |
| Smart constructor            | Examples plus a property           |
| Pure decision or calculation | Examples, one per rule             |
| State transition             | Table of legal and illegal         |
| Workflow pipeline            | Examples with stubbed capabilities |
| Boundary mapping             | Round-trip property                |
| Storage adapter              | Integration, few                   |
| Transport adapter            | Integration, few                   |
| Concurrency                  | Simulated conflict, not threads    |

## Pattern

Untestable without infrastructure:

```text
-- needs a database, a clock, and a mail server to check one rule
test "refunds over sixty days are rejected" =
  seedDatabase ...
  freezeClock ...
  startMailServer ...
  expect (processRefund request) toBe rejected
```

Testable with values:

```text
test "refunds over sixty days are rejected" =
  let booking = bookingConfirmedOn (daysAgo 61)
  in expect (decideRefund now booking request)
       toBe (Reject TooOld)
```

The second runs in microseconds, has no setup, and fails for exactly one
reason. Achieving it is a design change, not a testing technique. See
[separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md).

## Stubs, not mocks

A capability is a function type, so a stub is a function.

```text
let stubPrice = \code -> Money 1000
let stubExists = \_ -> true

test "prices every treatment" =
  expect (priceBooking stubPrice validBooking) toBeOk
```

No framework, no expectations, no verification of calls. If a test needs
to assert that a dependency was called, ask what observable outcome that
call produces, and assert on that instead. Where the call itself is the
outcome, return it as an event and assert on the event.

## Properties worth stating

| Property          | Statement                              |
| ----------------- | -------------------------------------- |
| Round trip        | `parse (render x) == Ok x`             |
| Totality          | Never raises for any input of the type |
| Invariant         | The constructor's rule always holds    |
| Idempotence       | Applying twice equals applying once    |
| Monoid laws       | Identity and associativity             |
| Model equivalence | Matches a slow obvious implementation  |
| Reachability      | Every state is reachable               |

See
[property-testing.md](references/property-testing.md).

## On test-driven development

Writing a test first is a good way to work: it forces you to use the
interface before implementing it, and it produces a regression suite as a
side effect. What it does not do is produce a design. Tests drive
attention to units, one at a time, and a system designed one unit at a
time acquires the structure of its increments.

The workable combination: design the module's interface deliberately
first, using the techniques in
[designing-deep-modules](../designing-deep-modules/SKILL.md) and
[writing-useful-comments](../writing-useful-comments/SKILL.md); then work
test-first inside that interface. Keep design decisions at the level of
the module, not at the level of the next failing test.

## Red flags

- A mocking framework used to test a business rule
- A test that asserts a function was called
- A test suite that needs a container to run at all
- Tests changed to match the code after a change
- One test asserting six unrelated things
- Coverage as the reported measure of quality
- A rule with no test because "it is obvious"

## Common mistakes

- **Testing through the shell.** Slow, brittle, and it does not tell you
  which rule broke.
- **Mocking what you do not own.** Wrap the third party in a function
  type and stub that instead.
- **Asserting on interactions.** It welds the test to the implementation,
  so refactoring breaks tests without breaking behaviour.
- **Property tests with no shrinking or no seed control.** A failure you
  cannot reproduce is a rumour.
- **Testing generated code, mappings, or the framework.** Test what you
  decided, not what a library does.
- **Skipping the failure cases.** Error paths are the least exercised
  code in production and the most worth testing.

## Related skills

- [separating-pure-core-from-shell](../separating-pure-core-from-shell/SKILL.md)
- [parameterizing-dependencies](../parameterizing-dependencies/SKILL.md)
- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [reviewing-functional-design](../reviewing-functional-design/SKILL.md)

## Further reading

- [property-testing.md](references/property-testing.md) covers choosing
  properties, generators, and shrinking.
- [testing-the-shell.md](references/testing-the-shell.md) covers what to
  cover in integration tests, and how few are enough.
