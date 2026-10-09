// A plain object literal compiles whatever it says. These calls ask xstate's
// own types whether each fragment is a state node it would accept.

// "#form.browsing" and "#form.saving" name states of a machine with id form.
const formMachine = createMachine({
  id: "form",
  initial: "browsing",
  states: { browsing: {}, editing, saving: {} },
});

// "expired" and "confirming" are siblings of held.
const holdMachine = createMachine({
  initial: "held",
  states: { held, expired: {}, confirming: {} },
});
