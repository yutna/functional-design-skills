---
name: defining-errors-out-of-existence
description: Use when error handling dwarfs the happy path, when the same failure is handled in many places, or when an interface forces callers to handle rare cases.
---

# Defining Errors Out of Existence

## Overview

Exception handling is one of the largest sources of complexity in
software. Each failure a caller must handle is a branch, a test, and a
piece of knowledge; and the handling code is executed rarely, so it is
the least tested part of the system.

The most effective response is not better handling. It is to change what
the operation means so that the situation is no longer an error. A great
many failures exist only because someone defined the interface in a way
that made them possible.

## When to use

- Error handling is longer than the logic it protects
- The same failure is caught in several places
- A caller must handle a case it has no sensible response to
- Designing a new interface, before its failures multiply
- A `Result` case that every caller maps to "do nothing"

Not for: failures the business names and acts on, which belong in the
type. See
[handling-errors-with-results](../handling-errors-with-results/SKILL.md).

## The four techniques

**1. Define the error out of existence.** Change the semantics so the
condition is normal.

```text
-- deleting a range that does not exist is an error
delete : Range -> Text -> Result<Text, RangeNotFound>

-- deleting an empty range simply changes nothing
delete : Range -> Text -> Text
```

Nothing is lost: a caller that deletes nothing wanted nothing deleted.
Every caller loses a branch.

**2. Mask it.** Handle the condition at a low level so higher levels
never see it.

```text
-- every caller retries
send : Message -> Result<Ack, ConnectionLost>

-- the transport reconnects; callers see success or real failure
send : Message -> Result<Ack, SendFailed>
```

Masking is right when the recovery is always the same and belongs to the
lower module's expertise. It is wrong when callers would choose
differently.

**3. Aggregate the handling.** Let many failures flow to one place that
handles them uniformly, instead of handling each where it arises.

```text
-- the edge renders every domain error once
handleRequest =
  runWorkflow >> either renderError renderSuccess
```

**4. Crash.** For conditions that are rare, unrecoverable, and not the
caller's business, stop. A process that continues in an unknown state
produces damage that is worse and harder to trace.

## Core rules

1. **Count the failures in an interface, and challenge each one.** For
   each, ask what a caller could sensibly do. If the answer is nothing,
   or always the same thing, it should not be there.
2. **Prefer changing the definition to adding handling.** The best error
   handling is an interface where the error is impossible or harmless.
3. **Mask only where the recovery is universal.** If two callers would
   choose differently, the choice belongs to them.
4. **Aggregate at the edge.** One place turns errors into responses,
   messages, or retries.
5. **Crash on impossible states.** Do not model programmer bugs as
   values.
6. **Do not define away a failure the business cares about.** Silently
   returning a default for an unknown treatment code hides a real problem.

## Pattern

Interface that manufactures errors:

```text
type CacheError = KeyMissing | Expired | Evicted
get : Key -> Result<Value, CacheError>
```

Every caller writes the same three branches, and all three mean "fetch it
from the source". The distinctions are real inside the cache and
meaningless outside it.

Interface with the errors defined away:

```text
get : Key -> Option<Value>
-- absent for whatever reason; the reason was never actionable
```

One case remains, and it is the only one a caller could act on. The three
internal reasons stay internal, where they are useful for metrics.

## Deciding what to remove

| Failure case                     | Likely action   |
| -------------------------------- | --------------- |
| Every caller does the same thing | Mask it         |
| No caller can do anything        | Remove or crash |
| Distinctions callers never use   | Collapse to one |
| Empty or missing input           | Make it a no-op |
| Callers would genuinely differ   | Keep it         |
| The business has a word for it   | Keep it, named  |

## Red flags

- A function with more error cases than a caller can name reasons for
- Error handling code that is longer than the operation
- Two error cases that every caller treats identically
- A caller that catches an error and continues as if nothing happened
- A `Result` whose failure is ignored everywhere in the codebase
- An interface that reports "not found" for something optional

## Common mistakes

- **Confusing this with swallowing errors.** Defining an error away means
  changing the operation's meaning so the case is legitimate. Ignoring a
  failure and carrying on is the opposite.
- **Masking a failure callers must know about.** A payment retry that
  hides "card declined" costs money.
- **Collapsing cases that carry different data.** If one failure has an
  amount and another has a field name, callers may need both.
- **Defining away input validation.** Accepting anything and defaulting
  silently produces corrupt data instead of a clear rejection.
- **Crashing on ordinary business outcomes.** An expired quote is not an
  emergency.

## Related skills

- [handling-errors-with-results](../handling-errors-with-results/SKILL.md)
- [separating-layers](../separating-layers/SKILL.md)
- [designing-deep-modules](../designing-deep-modules/SKILL.md)
- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)

## Further reading

- [techniques.md](references/techniques.md) works each technique through
  real interfaces, including where each one goes wrong.
