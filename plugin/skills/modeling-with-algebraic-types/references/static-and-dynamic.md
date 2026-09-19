# Algebraic Types Without a Compiler

The design survives in dynamically typed languages; only the enforcement
moves from compile time to construction time and test time. The rules
below give most of the benefit at a small cost.

## Represent a choice as a tagged value

Pick one tag key and use it everywhere in the codebase. Consistency
matters more than which key you pick.

```text
{ tag: "Cash" }
{ tag: "Card", number: ..., expiry: ... }
{ tag: "Transfer", bank: ..., reference: ... }
```

Rules:

- The tag key is the same everywhere: pick `tag`, `type`, or `kind` once.
- Tag values are exact strings, defined as constants in one module.
- Fields for a case exist only on that case. Never a union of all fields
  with the irrelevant ones set to null.

## Construct only through constructor functions

Never build a tagged value with an object literal outside its owning
module. The constructor is where the invariants are enforced, so bypassing
it is how illegal values appear.

```text
-- in the payment module, the only place these literals appear
cash () = { tag: "Cash" }
card (number, expiry) =
  if valid number then Ok { tag: "Card", number, expiry }
  else Error InvalidCard
```

Everywhere else calls `card(...)` and handles the `Result`.

## Dispatch exhaustively

Write dispatch so that an unknown tag is an explicit, loud failure rather
than a silent fall-through.

```text
describe p =
  match p.tag
    "Cash"     -> "cash"
    "Card"     -> maskCard p.number
    "Transfer" -> p.bank
    otherwise  -> raise UnhandledCase p.tag
```

The `otherwise` branch is not a wildcard that swallows cases; it is an
assertion that the set of tags is what this function believes. When a new
case is added, this fails immediately and visibly in test, which is
exactly what a compiler would have told you.

## Test that every case is covered

One test per dispatch site, driven by the list of tags, catches the case
the compiler would have caught.

```text
for each tag in allPaymentTags:
  assert describe (sampleFor tag) does not raise
```

Keep `allPaymentTags` next to the constructors, so adding a case forces
the sample list to grow, and the test does the rest.

## Use whatever static help the language offers

| Language   | Available help                                         |
| ---------- | ------------------------------------------------------ |
| JavaScript | JSDoc types checked by a type checker, `Object.freeze` |
| TypeScript | Discriminated unions, exhaustiveness via `never`       |
| Elixir     | Structs, typespecs and Dialyzer, pattern matching      |
| Python     | Dataclasses, literal types, a static checker           |

Even where checking is optional, the annotations are documentation that
tools can verify, which is strictly better than prose.

## Validate at the boundary, then trust

The strongest move in a dynamic language is to parse untrusted input once
into constructed values, at the edge, and to trust those values
everywhere inside.

```text
-- edge
parsePayment : Json -> Result<Payment, ParseError>

-- everywhere inside: no shape checks, no null guards
```

Without this, defensive checks spread through the codebase and each one
is a place where the rules can differ. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## What you genuinely lose

- Refactoring safety: renaming a case is a search, not a compile error.
- Immediate feedback: mistakes surface in tests, not in the editor.
- Proof of exhaustiveness: you get a test, not a guarantee.

Mitigate with the constants module, the coverage test, and a naming
convention strict enough that a search is reliable. What you do not lose
is the design: illegal states are still unbuildable through the
constructors, which is where the value was.
