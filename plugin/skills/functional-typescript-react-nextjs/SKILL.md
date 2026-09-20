---
name: functional-typescript-react-nextjs
description: Use when placing logic across the server and client boundary in Next.js, writing a Server Action, invalidating a cache after a mutation, or deciding what may cross.
license: MIT
metadata:
  pack: functional-design-skills
  version: 3.0.2
---

# Functional Next.js

## Overview

Next.js adds one thing to React that changes the design: a boundary
between server and client, with a network in the middle. That boundary
is the pure core and shell split, made physical. Where React lets you
put a rule in the wrong place, this makes the wrong place cost a round
trip, a serialisation, or a leaked secret.

Everything about components, state and derivation is unchanged and
lives in
[functional-typescript-react](../functional-typescript-react/SKILL.md).
This pack is only what the boundary adds.

## When to use

- Deciding whether something is a server component or a client one
- Writing a Server Action, or the form that calls it
- Choosing what data crosses the boundary and in what shape
- Deciding where a cache is invalidated
- Reviewing a change that moved logic across the boundary

Not for: React itself, deployment, or routing configuration.

## Core rules

1. Rule. **The boundary is the core and shell split.** Decisions and data
   access on the server; interaction on the client. A rule that runs in
   both places is a rule that will disagree with itself.
2. Rule. **Anything crossing is a transfer type.** It is serialised, so it
   is a plain record with no methods, no class instances, and no
   invariants the other side is trusting. Parse it back into a domain
   type on arrival. See
   [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md).
3. Rule. **Secrets and authorisation decisions never cross.** Not the key,
   not the token, and not the boolean the server computed from them
   where the client could have computed a different one.
4. Default. **A Server Action is a workflow**: a command arrives, the pure
   core decides, the shell performs, and the result is returned as data
   the form can render. Its failures are values in that result, not
   thrown.
5. Default. **Server by default; client where there is interaction.**
   Marking a component as client-side pulls its whole subtree across,
   so the mark belongs as far down the tree as it can go.
6. Default. **Revalidation is a decision about a cache, not about a
   screen.** Name what became stale, invalidate that, and let the
   rendering follow.
7. Judgement. **An optimistic update is a second source of truth** for as
   long as it is pending. Worth it when the operation almost always
   succeeds and the user is waiting; not worth it when reconciling the
   two costs more than the wait.

## Pattern

What belongs where:

- **Server.** Data access and secrets, business rules and pricing,
  authorisation decisions, composing the page's data.
- **Client.** Interaction state, optimistic updates, animation and
  focus, local and ephemeral form state.

A Server Action written as a workflow:

```tsx
"use server";

export async function confirmBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseBookingForm(formData);
  if (!parsed.ok) return { tag: "Invalid", errors: parsed.error };

  const result = await runConfirmBooking(deps)(parsed.value);
  return result.ok
    ? { tag: "Placed", ref: result.value.reference }
    : { tag: "Rejected", reason: result.error };
}
```

Parse at the boundary, decide purely, return a value the form can
render. The `(prevState, formData)` signature is what `useActionState`
calls, so the client reads
`useActionState(confirmBooking, { tag: "Idle" })` and gets the state,
the form action, and a pending flag together — no second piece of state
that can disagree with the first.

## Red flags

- A client component high in the tree with a server-only child below it
- A domain object passed across the boundary rather than a parsed record
- A rule implemented on both sides so the screen and the server agree
- An authorisation boolean computed on the server and trusted on the
  client
- A Server Action that throws instead of returning a failure case
- Revalidating everything because it is hard to say what went stale

## Common mistakes

- **Client components by default.** The mark spreads downward, so one
  careless `"use client"` near the root moves the whole page.
- **Treating the action's return as a transport detail.** It is the
  screen's next state; model it as a choice type, not as a nullable
  error string beside a nullable result.
- **Fetching in a client component because it was easier.** That is a
  waterfall the server could have composed in one pass.
- **Putting the domain type in the props of a client component.** It is
  serialised, so what arrives is its shape without its guarantees.
- **Reaching for a global store to share server data.** The server
  already composed it; the store is a second copy that goes stale.

## Related skills

- [functional-typescript-react](../functional-typescript-react/SKILL.md)
- [functional-separating-pure-core-from-shell](../functional-separating-pure-core-from-shell/SKILL.md)
- [functional-crossing-io-boundaries](../functional-crossing-io-boundaries/SKILL.md)
- [functional-designing-workflow-pipelines](../functional-designing-workflow-pipelines/SKILL.md)

## Further reading

- [server-boundary.md](references/server-boundary.md) covers server
  components, actions and the hook that calls them, forms and
  accumulated errors, optimistic updates, caching and revalidation, and
  how to test across the boundary.
