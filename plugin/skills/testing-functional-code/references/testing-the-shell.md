# Testing the Shell

The shell is where tests are expensive, so the goal is few of them, each
proving something the core tests cannot.

## What the shell tests must prove

1. **The wiring is right.** The composition root supplies the intended
   implementations, and the workflow runs end to end.
2. **The mapping matches reality.** The storage adapter's rows really do
   round-trip through the real database, with its real types and
   constraints.
3. **Transactions behave.** A failure mid-workflow rolls back, and a
   concurrent update is detected.
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

## Fakes for capabilities

For workflow-level tests that are not full integration tests, replace
each capability with an in-memory implementation.

```text
-- an in-memory store, thirty lines, shared by every workflow test
makeFakeStore : Unit -> { save: SaveBooking, load: LoadBooking,
                          contents: Unit -> List<Booking> }
```

A fake behaves like the real thing for the operations used, so tests read
naturally and assert on outcomes rather than on calls. Keep one fake per
capability, maintained as real code, rather than ad hoc stubs per test.

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
test "a stale write is rejected and retried" =
  let store = fakeStoreWithVersionBump ()
  -- the fake bumps the version between read and write once
  in expect (handleCancel store cmd) toBeOk
     and expect (store.writeAttempts ()) toBe 2
```

Reserve real concurrency tests for the storage layer's guarantees, and
keep them few.

## How many is enough

A working ratio for a service:

| Layer                  | Share of tests |
| ---------------------- | -------------- |
| Domain types and rules | Most           |
| Workflows with fakes   | Many           |
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
