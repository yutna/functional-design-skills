# Stores, Selectors and Draft Updates

What belongs in a store, what does not, and the two libraries most
projects reach for when the answer is "something does".

## Contents

- [The store is one mutable cell](#the-store-is-one-mutable-cell)
- [What does not belong in it](#what-does-not-belong-in-it)
- [Selectors and derived data](#selectors-and-derived-data)
- [Normalising](#normalising)
- [Writing nested updates with a draft](#writing-nested-updates-with-a-draft)

## The store is one mutable cell

Redux is the shape this pack already recommends, given a name: one
mutable cell at the edge, a pure `(state, action) => state` deciding
every change, and readers that never write. Nothing about it conflicts
with anything here.

What a project gets wrong is not the mechanism but the scope. The
store's cost is that everything in it is global, and global state is
read by code you did not think about when you changed it.

## What does not belong in it

- **Server data.** It already has an owner and a freshness question. A
  query layer answers both; a store makes you answer them again, by
  hand, in reducers.
- **State one subtree uses.** Local state that was lifted to the root
  couples components that never needed to know about each other.
- **Anything derived.** See below.
- **Form state, until it is submitted.** It is ephemeral and it belongs
  where it is edited.

What is left is usually smaller than expected: session, cross-cutting
preferences, and a few genuinely shared lifecycles.

## Selectors and derived data

A selector is a read. It should compute, not store.

```ts
const selectUnpaidTotal = (s: State) =>
  s.bookings.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0);
```

Two rules follow from this pack's position on derived state:

- **Never put the result of a selector back into the store.** That is
  the duplicated fact this pack keeps warning about, with a dispatch in
  the middle to make it look deliberate.
- **Memoise on a measurement, not on principle.** A memoised selector
  is a cache with an invalidation rule, and the rule is "the inputs
  changed by reference". That is correct only while every write
  replaces rather than edits — which is the rule above, holding the
  optimisation up.

## Normalising

Storing a list of entities by id, with separate lists of ids for
order, is the same move as
[functional-enforcing-consistency-boundaries](../../functional-enforcing-consistency-boundaries/SKILL.md):
one owner per fact. Two copies of the same booking in two slices will
disagree.

It costs a lookup at every read, so it is worth it when an entity
appears in more than one place and not otherwise.

## Writing nested updates with a draft

A reducer that rebuilds four levels of object to change one field is
unreadable, and the depth is the problem rather than the immutability.
`immer` solves it, and Redux Toolkit's `createSlice` includes it, so
reducer bodies may be written as though mutating:

```ts
const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    slotHeld(state, action: PayloadAction<SlotId>) {
      state.booking.slot.id = action.payload;
    },
  },
});
```

That is still a pure transition: what leaves the reducer is a new
frozen value sharing everything untouched. What it is not is
permission to mutate anything reachable from outside the draft. See
[persistent-structures.md](../../functional-managing-state-immutably/references/persistent-structures.md).

`use-immer` is the same thing for `useState` and `useReducer` outside
a store, and the same caution applies: the draft is the only thing
that may be written.
