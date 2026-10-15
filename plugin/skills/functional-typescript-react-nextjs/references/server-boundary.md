# The Server Boundary

In Next.js the server and client split is a real boundary, with
serialisation across it. Treat it exactly as
[functional-crossing-io-boundaries](../../functional-crossing-io-boundaries/SKILL.md)
describes: two type families, an explicit mapping, and validation on the
way in.

## Contents

- [What goes where](#what-goes-where)
- [Passing data across](#passing-data-across)
- [Server Actions as handlers](#server-actions-as-handlers)
- [Forms and accumulated errors](#forms-and-accumulated-errors)
- [Optimistic updates](#optimistic-updates)
- [Caching and revalidation](#caching-and-revalidation)
- [Testing across the boundary](#testing-across-the-boundary)

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
// app/bookings/page.tsx, a server component
export default async function BookingsPage() {
  const patient = await signedInPatient(); // redirects when signed out
  const bookings = await loadBookings(patient); // domain values
  return <BookingList bookings={bookings.map(toListItem)} />;
}
```

`toListItem` is the outward mapping: plain, serialisable, and shaped for
the screen rather than for the rules. Branded types, class instances,
functions, and dates all lose or change meaning across the boundary, so
convert deliberately rather than discovering it at runtime.

An async server component is shell code: it reads the session and the
store, then returns markup from those values, once for each request.
Rule 1 of the React pack, that render does not fetch, is about a
component React may render again at any time.

A view type per screen is usually better than sending the aggregate. See
[persistence-patterns.md](../../functional-crossing-io-boundaries/references/persistence-patterns.md).

## Server Actions as handlers

An action is a handler with an HTTP shape: a form in, a result the form
can render out.

```tsx
"use server";

import { updateTag } from "next/cache";

type FormState =
  | { tag: "Idle" }
  | { tag: "SignedOut" }
  | { tag: "Invalid"; errors: readonly FieldError[] }
  | { tag: "Rejected"; refusal: Refusal }
  | { tag: "Unavailable" }
  | { tag: "Confirmed"; reference: BookingRef };

export async function confirmBookingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await currentSession(); // shell: who is calling
  if (!session) return { tag: "SignedOut" };

  const parsed = parseBookingForm(formData); // boundary
  if (!parsed.ok) return { tag: "Invalid", errors: parsed.error };

  const catalogue = await loadCatalogue(); // shell: read
  if (!catalogue.ok) return { tag: "Unavailable" };

  const now = new Date();
  const decided = confirmBooking(catalogue.value, now, {
    ...parsed.value,
    patient: session.patient,
    requestedBy: session.patient,
  }); // core: pure, not awaited
  if (!decided.ok) {
    return { tag: "Rejected", refusal: toRefusal(decided.error) };
  }

  const saved = await saveEvents(decided.value); // shell: write
  if (!saved.ok) return { tag: "Unavailable" };

  updateTag(`bookings:${session.patient}`); // shell: what went stale
  return { tag: "Confirmed", reference: confirmedReference(saved.value) };
}
```

`saveEvents` hands the events back, and `confirmedReference` reads the
booking's reference out of the `BookingConfirmed` one.

`FormState` is the form's own type, and it crosses to the client, so
everything in it is a transfer type. The action builds it from what the
handler met. `toRefusal` is the outward mapping of the workflow's error,
as `toListItem` is of a booking, and the store's fault stays on the
server: `Unavailable` carries nothing. A `BookingRef` arrives as the
string it is: the brand is erased, and the client only shows it.

The `(previousState, formData)` signature is not arbitrary: it is what
React 19's `useActionState` calls, and it is why the action is shaped
like a reducer, though it is a handler: its effects happen on the
server.

```tsx
"use client";

const [state, formAction, isPending] = useActionState(confirmBookingAction, {
  tag: "Idle",
});
```

`state` is the `FormState` the action returned, `formAction` goes
straight on `<form action={...}>`, and `isPending` is the loading flag.
React keeps it, so nobody holds one in a `useState` that can disagree
with the action. The outcome is one value and the action is the only
thing that writes it, so an error beside a success stops being
representable. While `isPending` is true, `state` still holds the
previous outcome, and the form reads the flag before it shows that.

Four rules for actions:

1. **Never trust the client.** An action is a public endpoint: it can be
   called directly, by someone who never loaded the page. Work out who
   is calling inside the action, parse every field, and let the workflow
   decide whether this caller may do this. A check made when the page
   was rendered does not cover the action.
2. **Return a value, do not throw.** The form renders the result, so the
   failure must be data.
3. **Keep the rules out.** The action reads, parses, calls the pure
   workflow with values, writes, and maps the result. Any conditional
   about business meaning belongs in the workflow.
4. **Return a state the form can render**, as a choice type, so the
   client cannot show two outcomes at once.

## Forms and accumulated errors

A form should report every problem at once, which is applicative
validation.

```tsx
const problemIn = <T,>(field: string, r: Result<T, string>): FieldError[] =>
  r.ok ? [] : [{ field, problem: r.error }];

const parseBookingForm = (
  form: FormData,
): Result<BookingForm, readonly FieldError[]> => {
  const slot = parseSlotId(form.get("slot"));
  const treatment = parseTreatmentCode(form.get("treatment"));
  return slot.ok && treatment.ok
    ? ok({ slot: slot.value, treatment: treatment.value })
    : err([...problemIn("slot", slot), ...problemIn("treatment", treatment)]);
};
```

Each error carries its field, so the form can highlight the right input.
This form books one treatment in one slot, so the command the action
builds from it is narrower than the `UnvalidatedBooking` of
[pipeline-anatomy.md](../../functional-designing-workflow-pipelines/references/pipeline-anatomy.md),
which carries a list of lines.
The patient is not a field. Who is booking comes from the session, and a
patient sent with the form would be a claim the action cannot trust.
See
[applicative-validation.md](../../functional-handling-errors-with-results/references/applicative-validation.md).

## Optimistic updates

An optimistic update is a client-side prediction of the server's
decision. Keep the prediction pure and reconcilable.

```tsx
const [optimistic, addOptimistic] = useOptimistic(
  bookings,
  (current, added: BookingListItem) => [...current, added],
);
```

Two rules: the reducer is pure, and the server's answer is authoritative.
Never let the optimistic path apply a rule the server does not, or the
two will disagree in ways users notice.

## Caching and revalidation

Caching is a shell concern. Decide, per data source, how staleness is
handled, and write it down next to the read: in Next.js 16 that is a
`cacheTag` inside the function that caches it.

```ts
export async function loadBookings(patient: PatientId) {
  "use cache";
  cacheTag(`bookings:${patient}`);
  return bookingStore.forPatient(patient);
}
```

An action that changes data must invalidate what it affected; that
invalidation is part of the action's contract, and forgetting it is the
most common cause of a screen that shows old data after a successful
write. Three functions from `next/cache` do it, and they differ in what
the next reader sees:

- **`updateTag(tag)`** expires the tag at once, so whoever made the
  change sees it on the next render. It works only in a Server Action,
  and the action above calls it.
- **`revalidateTag(tag, "max")`** marks the tag stale and refreshes it in
  the background, so the next reader may still be served the old value.
  It also works in a Route Handler, which is where a webhook arrives.
  The second argument is required.
- **`revalidatePath(path)`** invalidates everything a route cached. It
  answers "I cannot say what went stale", so prefer a tag.

```ts
// app/api/clinic-import/route.ts: nobody is waiting to see this one
export async function POST() {
  revalidateTag("appointment-board", "max");
  return new Response(null, { status: 204 });
}
```

These shapes are the Cache Components model, which a project turns on
with `cacheComponents: true` in `next.config.ts`. The package carries
its own documentation: when `node_modules/next/dist/docs/` exists, read
`01-app/01-getting-started/09-revalidating.md` there before writing
cache code, and `01-app/02-guides/caching-without-cache-components.md`
when the project has that option off. It matches the installed version,
which this page may not.

## Testing across the boundary

- **Workflows**: tested with plain values, and no framework at all.
- **Actions**: a thin test that parsing and mapping work; the rules were
  already covered.
- **Components**: rendered with props, asserting on output for each case
  of the state union.
- **End to end**: a handful, for the journeys that matter.

If a rule can only be tested by rendering a page, it is in the wrong
place. See
[functional-testing-functional-code](../../functional-testing-functional-code/SKILL.md).
