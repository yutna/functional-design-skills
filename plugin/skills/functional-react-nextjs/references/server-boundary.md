# The Server Boundary

In Next.js the server and client split is a real boundary, with
serialisation across it. Treat it exactly as
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md)
describes: two type families, an explicit mapping, and validation on the
way in.

## What goes where

| Concern                    | Side   |
| -------------------------- | ------ |
| Database and secrets       | Server |
| Business rules             | Server |
| Authorisation decisions    | Server |
| Composing a page's data    | Server |
| Formatting for the locale  | Either |
| Interaction state          | Client |
| Optimistic updates         | Client |
| Focus, animation, gestures | Client |

The default is a server component. Mark a component as client-side only
when it needs state, an event handler, or a browser API, and mark it as
far down the tree as possible, because the directive applies to
everything it imports.

## Passing data across

Props crossing the boundary are serialised, so they are DTOs whether you
call them that or not.

```tsx
// server component
const bookings = await loadBookings(customerId); // domain values
return <BookingList bookings={bookings.map(toListItem)} />;
```

`toListItem` is the outward mapping: plain, serialisable, and shaped for
the screen rather than for the rules. Branded types, class instances,
functions, and dates all lose or change meaning across the boundary, so
convert deliberately rather than discovering it at runtime.

A view type per screen is usually better than sending the aggregate. See
[persistence-patterns.md](../../crossing-io-boundaries/references/persistence-patterns.md).

## Server Actions as workflows

An action is a workflow with an HTTP shape: a command in, a result out.

```tsx
"use server";

type FormState =
  | { tag: "Idle" }
  | { tag: "Invalid"; errors: readonly FieldError[] }
  | { tag: "Rejected"; reason: ConfirmBookingError }
  | { tag: "Placed"; reference: BookingRef };

export async function confirmBookingAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const session = await requireSession(); // shell
  const parsed = parseBookingForm(form); // boundary
  if (!parsed.ok) return { tag: "Invalid", errors: parsed.error };

  const result = await confirmBooking(deps)(session.customer, parsed.value);
  return result.ok
    ? { tag: "Placed", reference: result.value.reference }
    : { tag: "Rejected", reason: result.error };
}
```

Four rules for actions:

1. **Never trust the client.** An action is a public endpoint. Parse
   every field and re-check every authorisation decision, whatever the
   interface allowed.
2. **Return a value, do not throw.** The form renders the result, so the
   failure must be data.
3. **Keep the rules out.** The action parses, calls the workflow, and
   maps the result. Any conditional about business meaning belongs in the
   workflow.
4. **Return a state the form can render**, as a choice type, so the
   client cannot show two outcomes at once.

## Forms and accumulated errors

A form should report every problem at once, which is applicative
validation.

```tsx
const parseBookingForm = (
  form: FormData,
): Result<BookingRequest, readonly FieldError[]> => {
  const results = {
    customer: parseCustomerId(form.get("customer")),
    quantity: parseQuantity(form.get("quantity")),
    code: parseTreatmentCode(form.get("code")),
  };
  const errors = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([field, r]) => ({ field, problem: r.error }));
  return errors.length ? err(errors) : ok(assemble(results));
};
```

Each error carries its field, so the form can highlight the right input.
See
[applicative-validation.md](../../handling-errors-with-results/references/applicative-validation.md).

## Optimistic updates

An optimistic update is a client-side prediction of the server's
decision. Keep the prediction pure and reconcilable.

```tsx
const [optimistic, addOptimistic] = useOptimistic(
  bookings,
  (current, added: Booking) => [...current, added],
);
```

Two rules: the reducer is pure, and the server's answer is authoritative.
Never let the optimistic path apply a rule the server does not, or the
two will disagree in ways users notice.

## Caching and revalidation

Caching is a shell concern. Decide, per data source, how staleness is
handled, and write it down next to the fetch. An action that changes data
must invalidate what it affected; that invalidation is part of the
action's contract, and forgetting it is the most common cause of a screen
that shows old data after a successful write.

## Testing across the boundary

- **Workflows**: tested as pure functions with stubbed capabilities, with
  no framework at all.
- **Actions**: a thin test that parsing and mapping work; the rules were
  already covered.
- **Components**: rendered with props, asserting on output for each case
  of the state union.
- **End to end**: a handful, for the journeys that matter.

If a rule can only be tested by rendering a page, it is in the wrong
place. See
[testing-functional-code](../../testing-functional-code/SKILL.md).
