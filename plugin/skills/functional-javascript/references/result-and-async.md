# Result and Async in JavaScript

## The helpers

```js
export const ok = (value) => Object.freeze({ ok: true, value });
export const err = (error) => Object.freeze({ ok: false, error });

export const isOk = (r) => r.ok === true;

export const map = (f) => (r) => (r.ok ? ok(f(r.value)) : r);
export const bind = (f) => (r) => (r.ok ? f(r.value) : r);
export const mapError = (f) => (r) => (r.ok ? r : err(f(r.error)));

export const unwrapOr = (fallback) => (r) => (r.ok ? r.value : fallback);

export const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, f) => f(acc), x);
```

Usage:

```js
const confirmBooking = (raw) =>
  pipe(validate, bind(price(catalogue)), bind(acknowledge), map(toEvents))(raw);
```

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
[applicative-validation.md](../../handling-errors-with-results/references/applicative-validation.md).

## Accumulating field errors

```js
const validateCustomer = (raw) => {
  const results = {
    name: parseName(raw.name),
    email: parseEmail(raw.email),
    age: parseAge(raw.age),
  };
  const errors = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([field, r]) => ({ field, ...r.error }));

  return errors.length
    ? err(Object.freeze(errors))
    : ok(
        Object.freeze({
          name: results.name.value,
          email: results.email.value,
          age: results.age.value,
        }),
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
const handle = async (raw) => {
  const validated = validate(raw);
  if (!validated.ok) return validated;

  const priced = await priceWithService(validated.value);
  if (!priced.ok) return priced;

  return save(priced.value);
};
```

Early return on failure reads better than deep chaining in JavaScript,
and it is the same two-track model. Use whichever the file already uses.

## Converting at the boundary

Everything outside throws. Convert once, where the call is made.

```js
export const saveBooking = async (pool, booking) => {
  try {
    await pool.query(INSERT, toRow(booking));
    return ok(undefined);
  } catch (e) {
    return err(classify(e));
  }
};

const classify = (e) => {
  if (e.code === "23505") return { tag: "DuplicateBooking" };
  if (e.code === "57014") return { tag: "Transient", retryAfterMs: 1000 };
  return { tag: "Unexpected", cause: e };
};
```

Past this function, no caller knows which driver is in use, and the
`cause` is kept for logs without being something callers match on. See
[error-taxonomy.md](../../handling-errors-with-results/references/error-taxonomy.md).

## Parallel work

```js
const [customer, catalogue] = await Promise.all([
  loadCustomer(id),
  loadCatalogue(),
]);
if (!customer.ok) return customer;
if (!catalogue.ok) return catalogue;
```

`Promise.all` rejects on the first rejection, which is why the operations
must return `Result` rather than throwing: both results are then
available, and the caller decides which failure to report.

## What to throw

Reserve `throw` for programmer errors: an unhandled tag, a broken
invariant, an impossible state. Those should crash the request, be logged
with context, and be fixed. See
[defining-errors-out-of-existence](../../defining-errors-out-of-existence/SKILL.md).
