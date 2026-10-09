// "XState 5 types one context for every state, so the type says
// `SlotId | null` and cannot say more": reading the slot unchecked in
// confirming does not compile, which is why `heldSlot` exists.
const unchecked = setup({
  types: { context: {} as BookingContext },
  actors: {
    confirmBooking: fromPromise(
      async ({ input }: { input: { slot: SlotId } }) => confirm(input.slot),
    ),
  },
}).createMachine({
  id: "unchecked",
  initial: "confirming",
  context: { slot: null },
  states: {
    confirming: {
      // @ts-expect-error SlotId | null is not SlotId
      invoke: {
        src: "confirmBooking",
        input: ({ context }) => ({ slot: context.slot }),
      },
    },
  },
});

// "`heldSlot` returns the slot": its type is SlotId, not SlotId | null.
const slot: SlotId = heldSlot({ slot: s1 });
