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

**Impurity spreads upward.** A function that calls something impure is
itself impure, whatever its own body does. So one lookup buried three
levels down makes every caller above it impure too, all the way to the
entry point — and none of those callers changed. They did not have to.

```text
-- before: one pure chain
priceBooking  : PriceList -> Booking -> Priced
applyDiscount : Priced -> Priced
buildReceipt  : Priced -> Receipt

-- someone adds a lookup inside applyDiscount
applyDiscount : Priced -> Async<Priced>      -- now impure
-- and the type of everything above it has to follow
buildReceipt  : Priced -> Async<Receipt>     -- for no reason of its own
```

Nothing about receipts became asynchronous. The signature changed
because of a decision made two functions away, and every test of
`buildReceipt` now needs an await and a stub.

That is the whole mechanic, and it explains three things people
otherwise treat as separate complaints: why "just one query here" is
never just one query, why a codebase ends up asynchronous everywhere,
and why the fix is always the same shape — return the need instead of
satisfying it.

```text
-- applyDiscount says what it needs and stays pure
applyDiscount : DiscountPolicy -> Priced -> Priced

-- or it returns the question, and the shell answers it
applyDiscount : Priced -> Either<NeedsPolicy, Priced>
```

**The drill.** Read one function, line by line, and mark each line as
one of three things: it performs an effect, it computes a value from its
inputs, or it is a value. Then look at where the first kind sits. If the
effects are at the top and the bottom and the middle is computation, the
function is already split and only needs cutting. If they are
interleaved, the interleaving is the work, and it is usually one
reordering rather than a rewrite: gather first, decide second, perform
last.

Run the drill upward too. When a function is impure, ask whether it is
impure for its own reason or because of something it calls. The second
kind is the one to fix, and fixing it un-does the drift for every caller
above at once.

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
[functional-parameterizing-dependencies](../../functional-parameterizing-dependencies/SKILL.md).

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
  [functional-hiding-information](../../functional-hiding-information/SKILL.md).

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
