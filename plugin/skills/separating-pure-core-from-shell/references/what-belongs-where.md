# What Belongs Where

A decision procedure for the cases people argue about.

## The test

For any piece of code, ask three questions:

1. **Does it decide anything the business cares about?** If yes, it is
   core.
2. **Does it need the world to run?** If yes, it is shell.
3. **Both?** It is two things. Split it: the shell fetches, the core
   decides, the shell performs.

Nothing is genuinely both. When it feels that way, the fetch and the
decision are simply written in the same function.

## Ambiguous cases

**Validation that needs a lookup.** "Does this treatment code exist?" needs
storage; "is this quantity in range?" does not. Split them: pure field
validation in the core, existence checks as a capability passed in, or
fetched first. See
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

**Uniqueness.** "Is this email already registered?" is not a domain
invariant a value can hold; it is a property of a collection at a moment.
The check is a workflow step with a capability; the enforcement is a
database constraint. Both, deliberately.

**Money formatting.** Formatting for display is presentation, so it lives
at the edge, where locale and audience are known. Rounding rules are
business rules and live in the core.

**Identifier generation.** Generating is shell. Validating the format,
and knowing which entity an identifier belongs to, is core.

**Sorting and paging.** If the ordering is a business rule ("urgent
first"), the comparison lives in the core. Pagination mechanics belong to
the query in the shell.

**Authorisation.** "May this user perform this action?" is usually a
domain rule over roles and ownership: core, taking the actor as a
parameter. Authentication, sessions, and tokens are shell.

**Caching.** Shell. A pure function's result can be cached anywhere
precisely because it is pure; the core should not know that it is.

**Retries and timeouts.** Shell. A domain step that retries hides latency
and makes its own behaviour depend on time.

**Logging.** Shell. The core returns what happened; the shell records it.
A pure function that logs is not pure, and its tests will notice.

**Feature flags.** The flag's value is shell, read once and passed in.
What the flag changes is core, expressed as a parameter or a policy
value, not as a lookup inside a rule.

**Audit records.** Deciding what must be audited is core: return it as an
event. Writing it is shell.

## The signature test

A quick check that needs no discussion. Look at the function's type:

- Contains `Async`, `IO`, `Task`, or a connection type: shell.
- Returns the same output for the same input, with no effect: core.
- Contains a driver, framework, or transport type: shell, and probably
  leaking. See
  [hiding-information](../../hiding-information/SKILL.md).

If a function is meant to be core and its signature says otherwise, the
signature is right and the intention is wrong.

## The test-cost test

An even quicker check: how hard is it to test?

| Test needs                   | Where the code is      |
| ---------------------------- | ---------------------- |
| Plain values only            | Core, correctly        |
| A stub function or two       | Core with capabilities |
| A running database or server | Shell                  |
| A mocking framework          | Shell, or badly split  |

The last row is the important one. Needing a mocking framework to test a
business rule means the rule is entangled with an effect. Move the rule.
