# Telling a Boundary From a Pass-Through

Not every thin function is waste. This is the test set for deciding
whether a layer is doing work.

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
