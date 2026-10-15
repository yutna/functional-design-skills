# Result and Async in JavaScript

## Contents

- [The helpers](#the-helpers)
- [Collections](#collections)
- [Accumulating field errors](#accumulating-field-errors)
- [Promises](#promises)
- [Converting at the boundary](#converting-at-the-boundary)
- [Parallel work](#parallel-work)
- [What to throw](#what-to-throw)

## The helpers

```js
export const ok = (value) => Object.freeze({ ok: true, value });
export const err = (error) => Object.freeze({ ok: false, error });

export const isOk = (r) => r.ok === true;

export const map = (f) => (r) => (r.ok ? ok(f(r.value)) : r);
export const bind = (f) => (r) => (r.ok ? f(r.value) : r);
export const mapError = (f) => (r) => (r.ok ? r : err(f(r.error)));

export const unwrapOr = (fallback) => (r) => (r.ok ? r.value : fallback);

export const pipe = (x, ...fns) => fns.reduce((acc, f) => f(acc), x);
```

`unwrapOr` is for a default that the operation's own definition makes an
ordinary answer. It is never the way to drop a failure the caller has to
notice.

Usage:

```js
const validation = (cause) => Object.freeze({ tag: "Validation", cause });
const pricing = (cause) => Object.freeze({ tag: "Pricing", cause });
const bookingConfirmed = (booking) =>
  Object.freeze({ tag: "BookingConfirmed", booking });

const confirmBooking = (catalogue, now, raw) =>
  pipe(
    raw,
    validateBooking(catalogue),
    mapError(validation),
    bind((booking) =>
      pipe(booking, priceBooking(catalogue), mapError(pricing)),
    ),
    map(issueConfirmation(now)),
    map((booking) => Object.freeze([bookingConfirmed(booking)])),
  );
```

Everything the steps need is an argument, and each step's error is lifted
with `mapError` into the `Validation` or the `Pricing` case, so the
workflow's signature carries one error type and a list of events.

The three tagged values are built by constructors that freeze, which is
what rules 1 and 2 of the pack ask.

## Collections

```js
// stop at the first failure
export const traverse = (f) => (xs) => {
  const out = [];
  for (const x of xs) {
    const r = f(x);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(Object.freeze(out));
};

// collect every failure
export const traverseAll = (f) => (xs) => {
  const out = [];
  const errors = [];
  for (const x of xs) {
    const r = f(x);
    if (r.ok) out.push(r.value);
    else errors.push(r.error);
  }
  return errors.length ? err(Object.freeze(errors)) : ok(Object.freeze(out));
};
```

Use `traverseAll` for form fields and batch imports, `traverse` inside a
sequential pipeline. See
[applicative-validation.md](../../functional-handling-errors-with-results/references/applicative-validation.md).

## Accumulating field errors

```js
const problemIn = (field, r) => (r.ok ? [] : [{ field, ...r.error }]);

const validatePatient = (raw) => {
  const name = parseName(raw.name);
  const email = parseEmail(raw.email);
  const age = parseAge(raw.age);

  return name.ok && email.ok && age.ok
    ? ok(
        Object.freeze({
          name: name.value,
          email: email.value,
          age: age.value,
        }),
      )
    : err(
        Object.freeze([
          ...problemIn("name", name),
          ...problemIn("email", email),
          ...problemIn("age", age),
        ]),
      );
};
```

Every field is reported, each carrying its own name, which is what a form
needs.

## Promises

A `Promise<Result<T, E>>` is the async shape. Do not use promise
rejection for expected failures: rejection is JavaScript's exception
mechanism, and it has the same invisibility problem.

```js
export const mapAsync = (f) => async (pr) => {
  const r = await pr;
  return r.ok ? ok(await f(r.value)) : r;
};

export const bindAsync = (f) => async (pr) => {
  const r = await pr;
  return r.ok ? f(r.value) : r;
};
```

```js
const rejected = (cause) => Object.freeze({ tag: "Rejected", cause });
const unavailable = (cause) => Object.freeze({ tag: "Unavailable", cause });

const handleConfirmBooking = async (pool, now, raw) => {
  const catalogue = await loadCatalogue(pool);
  if (!catalogue.ok) return err(unavailable(catalogue.error));

  const decided = confirmBooking(catalogue.value, now, raw);
  if (!decided.ok) return err(rejected(decided.error));

  const saved = await saveEvents(pool, decided.value);
  return saved.ok ? saved : err(unavailable(saved.error));
};
```

This is a handler: it reads, decides, and writes. Only the read and the
write are awaited; `confirmBooking` is the pure workflow above and takes
plain values. Early return on failure reads better than deep chaining in
JavaScript, and it is the same two-track model. Use whichever the file
already uses.

## Converting at the boundary

Everything outside throws. Convert once, where the call is made.

```js
export const insertBooking = async (pool, booking) => {
  try {
    await pool.query(INSERT, toRow(booking));
    return ok(undefined);
  } catch (e) {
    return err(classify(e));
  }
};

const classify = (e) => {
  if (e?.code === "23505") return Object.freeze({ tag: "DuplicateBooking" });
  if (e?.code === "57014") {
    return Object.freeze({ tag: "Transient", retryAfter: seconds(1) });
  }
  return Object.freeze({ tag: "Unexpected", cause: e });
};
```

`catch` can be handed anything, `undefined` included, which is why
`classify` reads the code with `?.`. Past this function, no caller needs
to know which driver is in use. An exception it does not recognise is
the opaque `Unexpected`: the `cause` is kept for logs, and no caller
matches on it.
A save that checks a version has two cases of its own, `Conflict` and
`Failed`, in
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md).
See
[error-taxonomy.md](../../functional-handling-errors-with-results/references/error-taxonomy.md).

## Parallel work

```js
const loadForBooking = async (pool, id) => {
  const [patient, catalogue] = await Promise.all([
    loadPatient(pool, id),
    loadCatalogue(pool),
  ]);
  if (!patient.ok) return patient;
  if (!catalogue.ok) return catalogue;
  return ok({ patient: patient.value, catalogue: catalogue.value });
};
```

`Promise.all` rejects on the first rejection, which is why the operations
must return `Result` rather than throwing: both results are then
available, and the caller decides which failure to report.

## What to throw

Reserve `throw` for programmer errors: an unhandled tag, a broken
invariant, an impossible state. Those should crash the request, be logged
with context, and be fixed. See
[functional-defining-errors-out-of-existence](../../functional-defining-errors-out-of-existence/SKILL.md).
