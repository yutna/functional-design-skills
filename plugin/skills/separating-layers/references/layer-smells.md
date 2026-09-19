# Telling a Boundary From a Pass-Through

Not every thin function is waste. This is the test set for deciding
whether a layer is doing work.

## Contents

- [The test](#the-test)
- [Worked cases](#worked-cases)
- [Decorators specifically](#decorators-specifically)
- [Counting hops](#counting-hops)
- [The second axis: how often each layer changes](#the-second-axis-how-often-each-layer-changes)

## The test

A function or module earns its layer if it does at least one of these:

1. **Translates vocabulary.** Types on the way in differ in meaning from
   types on the way out: `Request` to `BookingRequest`, `BookingRow` to
   `Booking`.
2. **Narrows an interface.** It exposes less than what it wraps, and the
   narrowing is deliberate: three functions instead of thirty, one error
   type instead of a library's hierarchy.
3. **Changes the failure model.** Exceptions become `Result`, or several
   error types collapse into one the caller can act on.
4. **Adds a guarantee.** Ordering, idempotency, validation, a
   transaction, a limit on concurrency.
5. **Isolates a dependency.** It is the only place a third-party type
   appears, so the rest of the system could survive replacing it.

If none of these apply, the layer is a pass-through. Delete it and let
callers call through.

## Worked cases

**Case: a repository that wraps an ORM one-to-one.**
Same names, same arguments, same types leaking through. No translation,
no narrowing, no isolation, since the ORM's entity types are what it
returns. Verdict: pass-through. Fix by making it return domain types, or
by deleting it.

**Case: a thin HTTP client wrapper with two functions.**
It sets the base URL, converts non-2xx into a `Result`, and exposes two
endpoints instead of a general request function. Narrows, changes the
failure model, isolates the library. Verdict: real boundary. Keep.

**Case: a service that calls one repository function per method.**
Same nouns as the repository, no extra guarantee. Verdict: pass-through.
The domain logic that would justify it either does not exist yet or is
sitting in the controller above. Move that logic here, or remove the
layer.

**Case: a decorator adding a log line around every call.**
Adds no guarantee the caller can rely on and doubles the call graph.
Verdict: pass-through. Log inside the function, or at the edge where the
request is already being observed.

## Decorators specifically

A decorator wraps something and adds behaviour without changing its
interface. In functional code it is a function that takes a function and
returns one of the same shape. Legitimate uses are narrow:

```text
-- legitimate: adds a guarantee callers rely on, at one place
withRetry : RetryPolicy -> (A -> AsyncResult<B, E>)
              -> (A -> AsyncResult<B, E>)
```

Before writing one, check three alternatives:

1. Put the behaviour inside the thing being wrapped, if it belongs to it.
2. Put it in the caller, if only one caller needs it.
3. Make it a parameter, if callers must vary it.

Reach for a decorator only when the behaviour is genuinely orthogonal,
applies to many functions, and callers must not have to remember it.

## Counting hops

A useful review metric: from the entry point, how many calls before real
work happens? Two or three is normal in a layered system. Five means at
least two of them are pass-throughs. Follow the chain and apply the test
above at each hop.

## The second axis: how often each layer changes

Vocabulary decides whether a boundary exists at all. It does not decide
which side of it a given function belongs on. For that, ask a different
question:

> What would have to happen in the world for this to need changing?

Sort the answers and the layers fall out, fastest-changing at the top:

| Answer                                     | Layer            |
| ------------------------------------------ | ---------------- |
| A pricing rule changes; a regulator rules  | Business rules   |
| The business adds a concept                | Domain concepts  |
| Never, unless the language changes         | General utility  |

The rule that makes this operational: **a function sits above
everything it calls and below everything that calls it.** A general
utility that reaches up into a business rule has inverted the order, and
the rule is now pinned by something that should have been free to move.
Two symptoms of exactly that:

- A date helper with a parameter named after one feature
- A "core" module that imports a policy from a feature module

Both are the special-general mixture in
[splitting-and-joining-code](../../splitting-and-joining-code/SKILL.md),
seen from the side of who depends on whom.

### Why this is worth checking separately

The vocabulary test passes on plenty of designs that fail this one,
because two layers can speak different languages and still change
together. The classic case is a module that translates correctly and
also encodes a threshold:

```text
-- storage layer, speaking rows: correct by the vocabulary test
selectActiveBookings : Instant -> AsyncResult<List<BookingRow>, DbError>
-- ...and, in the query, `where cancelled_at is null and starts_at > now`
```

"Active" is a business rule sitting in the slowest-changing layer. The
vocabulary is right and the rate of change is wrong, so the day the
definition of active gains a third condition, a storage module has to
be edited by someone reasoning about the business.

The repair is the direction rule again: pass the definition down rather
than burying it.

```text
selectBookingsMatching : BookingFilter -> AsyncResult<List<BookingRow>, DbError>
activeAt : Instant -> BookingFilter        -- lives with the rules
```

### The mixed-rate test

Run it on one module at a time. List what it contains, and write beside
each item what would change it. Two very different answers in one module
is the finding — usually a rule and a mechanism sharing a file, and
usually the rule is the one to move out, because it is the one that will
move again.
