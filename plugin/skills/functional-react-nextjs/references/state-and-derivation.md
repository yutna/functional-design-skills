# State and Derivation

## What to store

Store the smallest set of facts from which everything on screen follows.
Everything else is computed during render.

| Value                          | Store it? |
| ------------------------------ | --------- |
| What the user typed            | Yes       |
| Which tab is selected          | Yes       |
| Server data, as fetched        | Yes, once |
| A filtered view of that data   | No        |
| A total, a count, a percentage | No        |
| Whether a form is valid        | No        |
| Whether a list is empty        | No        |
| A formatted string             | No        |

The test: if two pieces of state can disagree, one of them should be
derived.

```tsx
// disagreeable
const [query, setQuery] = useState("");
const [results, setResults] = useState<Item[]>([]);
const [hasResults, setHasResults] = useState(false);

// single source
const [query, setQuery] = useState("");
const results = useMemo(() => search(items, query), [items, query]);
const hasResults = results.length > 0;
```

`useMemo` here is optional; add it when a profile says the search is
expensive. Correctness came from removing the duplicate state, not from
the memo.

## Reducers as pure state machines

When a screen has several states and several events, a reducer is the
state machine from
[modeling-state-machines](../../modeling-state-machines/SKILL.md).

```tsx
type State =
  | { tag: "Idle" }
  | { tag: "Editing"; draft: Draft; errors: readonly FieldError[] }
  | { tag: "Submitting"; draft: Draft }
  | { tag: "Done"; reference: BookingRef };

type Event =
  | { tag: "Started"; draft: Draft }
  | { tag: "Changed"; field: FieldName; value: string }
  | { tag: "Submitted" }
  | { tag: "Succeeded"; reference: BookingRef }
  | { tag: "Failed"; errors: readonly FieldError[] };

const reduce = (state: State, event: Event): State => { ... };
```

The reducer is a pure function of two values. It can be tested as a
table, exhaustively, with no rendering and no framework. That is the
single highest-value move available in a complex React screen.

Keep the reducer free of effects. When a transition should cause one,
return a state the component reacts to, or return commands alongside the
state and let the shell run them.

`useReducer` takes this as it stands, and that is the default: the
reducer is a plain function and needs nothing else. Reach for `xstate`
only when the machine has features a plain reducer genuinely lacks —
hierarchical or parallel states, delayed transitions, an actor per
row — and accept in exchange that the machine is now a library value
rather than a function you can call from a test with two arguments.
Most screens never get there.

## When an effect is right

`useEffect` synchronises React with something outside it. Legitimate
uses:

- Subscribing to an event source, a socket, or a store, and
  unsubscribing on cleanup
- Setting up a timer or an observer
- Imperatively focusing an element after a state change
- Logging or analytics on a real transition

Everything else is usually one of these mistakes:

| Effect that...        | Should be...                                 |
| --------------------- | -------------------------------------------- |
| Derives state         | A computation during render                  |
| Fetches data          | A server component, loader, or query library |
| Resets on prop change | A `key` on the component                     |
| Transforms props      | A computation during render                  |
| Syncs two states      | One state, and a derivation                  |

Before writing an effect, ask what external system it synchronises with.
If the answer is "another piece of React state", delete it.

## Fetching

Fetch at the edge, not in the middle of the tree:

- **Next.js**: fetch in server components, or in a route handler, and
  pass data down as props.
- **Client-only apps**: `@tanstack/react-query` or `swr` at a route or
  page boundary, with its cache as the single source of server state.

Naming those matters more than it looks. "Use a query library" reads as
optional; the point is that server data has a cache whether you write
one or not, and the choice is between one you configured and one made
of scattered `useState` and `useEffect` pairs. Either library gives you
that cache, request de-duplication, and a loading state you did not
hand-roll.

What none of them decide for you is the screen's own state. A cache
entry is `pending | success | error`; the four-case `ScreenState` in
the skill is still yours to write, and still the thing that stops a
screen rendering a spinner over stale data.

A component several levels deep that fetches is the temporal
decomposition smell: it couples a leaf to the network and makes the
subtree untestable. See
[hiding-information](../../hiding-information/SKILL.md).

## Keeping rules out of components

```tsx
// rules in the handler: untestable, unreusable
const onSubmit = () => {
  if (booking.total > 5000 && !customer.isVerified) { ... }
};

// rules in a pure module, tested without React
const decision = decideCheckout(customer, booking);
const onSubmit = () => dispatch({ tag: "Submitted", decision });
```

The pure function is testable with two plain values, reusable on the
server, and reviewable by someone who does not know React. See
[separating-pure-core-from-shell](../../separating-pure-core-from-shell/SKILL.md).

## Components as deep modules

A component's props are its interface, and the same depth rule applies.

```tsx
// shallow: the caller assembles everything
<BookingTable
  rows={rows} columns={columns} sortKey={sortKey} sortDir={sortDir}
  onSort={onSort} page={page} pageSize={pageSize} onPage={onPage}
  isLoading={isLoading} error={error} emptyText={emptyText}
/>

// deep: one thing to know
<BookingTable bookings={bookings} onSelect={onSelect} />
```

Sorting, paging, and empty handling are the table's job. Pull that
complexity down. See
[separating-layers](../../separating-layers/SKILL.md).

## Immutability

React compares by reference to decide what to re-render, so mutation both
breaks the design rules and breaks rendering.

```tsx
setItems((xs) => [...xs, item]); // not xs.push
setBooking((o) => ({ ...o, status })); // not o.status = ...
const sorted = [...items].sort(byDate); // sort mutates
```

See
[immutability.md](../../functional-javascript/references/immutability.md).
