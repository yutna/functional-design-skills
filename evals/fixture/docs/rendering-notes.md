# Rendering notes

Measured on the appointment board, which re-renders on every tick of its
thirty-second refresh.

- No memoisation: 41 ms a tick
- `memo()` on the slot panels: 9 ms a tick

Slot panels take primitive props, so a shallow comparison is enough to
skip them. A handler passed to a memoised panel is wrapped in
`useCallback`, or the comparison fails on every render and the `memo()`
buys nothing.
