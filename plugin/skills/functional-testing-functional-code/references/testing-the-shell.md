# Testing the Shell

The shell is where tests are expensive, so the goal is few of them, each
proving something the core tests cannot.

## Contents

- [What the shell tests must prove](#what-the-shell-tests-must-prove)
- [What they must not do](#what-they-must-not-do)
- [Which tool](#which-tool)
- [Fakes for capabilities](#fakes-for-capabilities)
- [Time, randomness, identifiers](#time-randomness-identifiers)
- [Testing concurrency without threads](#testing-concurrency-without-threads)
- [How many is enough](#how-many-is-enough)
- [End-to-end tests](#end-to-end-tests)

## What the shell tests must prove

1. **The wiring is right.** The composition root supplies the intended
   implementations, and the handler runs end to end.
2. **The mapping matches reality.** The storage adapter's rows really do
   round-trip through the real database, with its real types and
   constraints.
3. **Transactions behave.** A failure partway through a handler rolls
   back, and a concurrent update is detected.
4. **The transport contract holds.** Requests parse, responses serialise,
   status codes are right.

Everything else belongs in core tests.

## What they must not do

- Re-test business rules. If a shell test is the only place a rule is
  checked, the rule is in the wrong layer.
- Enumerate cases. One happy path and one representative failure per
  adapter is usually enough; the combinations were covered by the core.
- Mock the database. A test against a mock of a driver proves that the
  mock behaves like the mock.

## Which tool

- **Elixir.** `ExUnit` runs the tests. `Ecto.Adapters.SQL.Sandbox` runs
  each test in a database transaction that is rolled back when the test
  ends, which suits the storage adapter. In a Phoenix service,
  `Phoenix.ConnTest` builds a request with `build_conn` and `get` or
  `post`, and `json_response` or `response` checks the body and the
  status code.
- **JavaScript and TypeScript.** `vitest` is the runner that
  `@fast-check/vitest` extends; `node:test`, run with `node --test`, is
  the runner built into Node. A service under test is called with the
  global `fetch`. The storage adapter is tested against a real database
  of the same kind as production, started for the test run.

## Fakes for capabilities

A stub and a fake are defined in
[the testing skill](../SKILL.md). For handler tests that are not full
integration tests, replace a store that many tests share with a fake: an
in-memory implementation.

```text
-- an in-memory store, thirty lines, shared by every handler test;
-- `contents` is a test-only read of what it holds
makeFakeStore :
  { bumpVersionOnce: Boolean }
    -> { save: SaveBooking, load: LoadBooking,
         contents: Unit -> List<Versioned<Booking>> }
```

`SaveBooking`, `LoadBooking` and `Versioned` are declared in
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md).
The option is for the conflict test further down.

A fake behaves like the real thing for the operations used, so tests read
naturally and assert on outcomes rather than on calls. Keep one fake per
store, maintained as real code, rather than ad hoc stubs per test. A
handler with few capabilities still takes stubs.

The risk is that a fake drifts from the real implementation. Mitigate it
with a **contract test**: one suite of assertions run against both the
fake and the real adapter.

```text
storeContract : SaveBooking -> LoadBooking -> TestSuite
-- run against the fake in unit tests, against the database in CI
```

## Time, randomness, identifiers

These are capabilities, so tests supply them.

```text
let fixedNow = instant "2026-03-01T09:00:00Z"
let ids = sequenceOf [id1, id2, id3]
```

A test that sleeps, or that depends on the real clock, is a flaky test
waiting for a slow machine.

## Testing concurrency without threads

Most concurrency bugs in this architecture are conflict handling, and
that can be tested deterministically.

```text
-- the fake changes the stored version once, between a read and the
-- write that follows it, as a concurrent writer would
test "a stale write is refused, and nothing is overwritten" =
  let store = makeFakeStore { bumpVersionOnce: true }
  in expect (handleCancel store.load store.save now bookingId reason)
       toFinishWith (Error VersionChanged)
     and expect (store.contents ()) toBe [asTheOtherWriterLeftIt]
```

The assertions are on what the handler finished with and on what the
store now holds, not on how many times anything was called. Running the
handler again after a conflict is the entry point's work, and it gets a
second test: the same fake, the handler run twice, and the booking
cancelled.

Reserve real concurrency tests for the storage layer's guarantees, and
keep them few.

## How many is enough

A working ratio for a service:

| Layer                  | Share of tests |
| ---------------------- | -------------- |
| Domain types and rules | Most           |
| Handlers, stubs, fakes | Many           |
| Adapters, integration  | Few            |
| End to end, full stack | A handful      |

The shape follows from the design: if the shell needs a lot of tests, it
contains logic that belongs in the core. Use the ratio as a diagnostic,
not as a target.

## End-to-end tests

Keep a small number that exercise the real path for the most important
journeys. Their job is to catch wiring and configuration mistakes that no
unit can see. Their cost is that they are slow and they fail for reasons
unrelated to the change, so every one of them must earn its place.
