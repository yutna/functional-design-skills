# Project Setup

Installing the pack puts the rules within reach. It does not say what
outranks what, and an agent with no stated precedence will read a
deliberate convention as a defect. It also does not tell the agent to
reach for the pack when it is asked to do work rather than answer a
question. A short block in the project's `CLAUDE.md` does both.

Paste this into the project's `CLAUDE.md`, with the last line naming the
language pack that matches the project:

```markdown
## Design rules

This codebase follows functional design. The `functional-design` skill
is the index; the rest of the pack carries one rule each.

- This project's own conventions win. The pack decides what they leave
  open, and a pack red flag is a place to look, not a finding.
- Before designing a new module, workflow, endpoint, or bounded
  context, read `functional-design` and follow its design loop.
- For anything smaller, use its calibration table to decide how much
  design the task warrants. For one function in a module that already
  exists, that is an honest signature and a precise name, nothing more.
- Before finishing a change that added or reshaped a type, a signature,
  or a module boundary, run the checklist in
  `functional-reviewing-functional-design`.
- Use `functional-typescript` for concrete syntax.
```

## Why the first bullet comes first

The precedence bullet is what stops the pack arguing with a decision the
team already made. Placed first, it frames every bullet after it: the
rest says when to consult the pack, and this one says the project can
overrule it.

## Choosing the last line

The last line names the language pack for the project's stack. Replace
`functional-typescript` with the one that matches, taken from the
[language packs](../SKILL.md#language-packs) section of the index. A
project on two stacks may name one line per stack. A project the packs
do not cover can drop the line; the core skills use a neutral notation
and still apply.
