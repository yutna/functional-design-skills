# Project conventions

Wrapping a component in `memo()` when its props are primitives is the
default here. The measurements behind that choice are in the rendering
notes, and the rule is deliberate rather than accidental.

A server action owns the rules a client screen only displays.
