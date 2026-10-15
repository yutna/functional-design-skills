// A plain object literal compiles whatever it says. These calls ask xstate's
// own types whether each fragment is a state node it would accept.

// "#form.browsing" and "#form.saving" name states of a machine with id form.
const formMachine = createMachine({
  id: "form",
  initial: "browsing",
  states: { browsing: {}, editing, saving: {} },
});

// "browsing" and "confirming" are siblings of held, and `holdWindow` is a
// delay declared in `setup`, as SKILL.md declares it.
const holdMachine = setup({ delays: { holdWindow: 120_000 } }).createMachine({
  initial: "held",
  states: { held, browsing: {}, confirming: {} },
});
