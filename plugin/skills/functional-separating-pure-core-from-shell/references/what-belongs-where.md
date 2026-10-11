# What Belongs Where

A decision procedure for the cases people argue about.

## Contents

- [Why the split drifts on its own](#why-the-split-drifts-on-its-own)
- [The test](#the-test)
- [Ambiguous cases](#ambiguous-cases)
- [The signature test](#the-signature-test)
- [The test-cost test](#the-test-cost-test)

## Why the split drifts on its own

Placing effects at the edges is not a thing you do once. It is a thing
that comes undone, and it comes undone in one specific way that is worth
being able to name.

**An effect spreads upward.** A function that calls something with an
effect has an effect itself, whatever its own body does. So one lookup
buried three levels down gives every caller above it an effect type too,
all the way to the entry point, and none of those callers changed. They
did not have to.

```text
-- before: one pure chain
applyDiscount : Priced -> Priced
buildReceipt  : Priced -> Receipt
buildReceipt priced = receiptFor (applyDiscount priced)

-- someone adds a lookup inside applyDiscount
applyDiscount : Priced -> Async<Priced>      -- now has an effect
-- and the type of everything above it has to follow
buildReceipt  : Priced -> Async<Receipt>     -- for no reason of its own
```

Nothing about receipts needed an effect. The signature changed because
of a decision made one function away, and every test of `buildReceipt`
now needs an await and a stub.

That is the whole mechanic, and it explains three things people
otherwise treat as separate complaints: why "just one query here" is
never just one query, why a codebase ends up with an effect type
everywhere, and why the fix is always the same shape: take the value as
a parameter instead of fetching it inside.

```text
-- applyDiscount says what it needs and stays pure
applyDiscount : DiscountPolicy -> Priced -> Priced
```

**The drill.** Read one function, line by line, and mark each line as
one of three things: it performs an effect, it computes a value from its
inputs, or it is a value. Then look at where the first kind sits. If the
effects are at the top and the bottom and the middle is computation, the
function is already split and only needs cutting. If they are
interleaved, the interleaving is the work, and it is usually one
reordering rather than a rewrite: gather first, decide second, perform
last.

Run the drill upward too. When a function has an effect type, ask
whether it has one for its own reason or because of something it calls.
The second kind is the one to fix, and fixing it un-does the drift for
every caller above at once.

## The test

For any piece of code, ask three questions:

1. **Does it decide anything the business cares about?** If yes, it is
   core.
2. **Does it need the world to run?** If yes, it is shell.
3. **Both?** It is two things written in one function. Split it: the
   handler reads, a pure function decides, the handler writes.

Sometimes the two alternate, because a rule decides what to read next.
The deciding is still pure: write it as two pure functions, and let the
handler read between them.

## Ambiguous cases

**Validation that needs a lookup.** "Does this treatment code exist?"
needs storage; "is this quantity in range?" does not. The handler reads
what the check needs, the treatment codes the clinic offers, and a pure
function checks against them. See
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).

**Uniqueness.** "Is this email already registered?" is not a domain
invariant a value can hold; it is a property of a collection at a
moment. The handler reads whether the value is taken and passes that
fact to the pure function that decides. The database constraint still
enforces it, because another request can take the value between the
read and the write. Both, deliberately.

**Money formatting.** Formatting for display is presentation, so it lives
at the edge, where locale and audience are known. Rounding rules are
business rules and live in the core.

**Identifier generation.** Generating is shell. Validating the format,
and knowing which entity an identifier belongs to, is core. The one
identifier the shell must not generate is a command's key, which the
caller creates before its first attempt; see
[functional-making-effects-reliable](../../functional-making-effects-reliable/SKILL.md).

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

- Has an effect type, or takes a capability or a connection: shell.
- Has no effect type, and states a rule or builds a domain type: core.
- Contains a driver, framework, or transport type: shell, and probably
  leaking. See
  [functional-hiding-information](../../functional-hiding-information/SKILL.md).
- In a language whose types do not mark effects, the signature cannot
  tell you. Read the body for a clock, a random source, a file, a
  socket, or a call to something that has one.

If a function is meant to be core and its signature says otherwise, the
signature is right and the intention is wrong.

## The test-cost test

An even quicker check: how hard is it to test?

| Test needs                   | Where the code is      |
| ---------------------------- | ---------------------- |
| Plain values only            | Core, correctly        |
| A stub for a capability      | A handler              |
| A running database or server | Shell                  |
| A mocking framework          | Shell, or badly split  |

The last row is the important one. Needing a mocking framework to test a
business rule means the rule is entangled with an effect. Move the rule.
