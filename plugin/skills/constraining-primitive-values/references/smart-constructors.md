# Smart Constructors

A smart constructor is the only way to build a value of a constrained
type. It takes a raw input, applies every rule the type promises, and
returns either the value or a description of what was wrong.

## The shape

```text
module TreatmentCode

  -- the type is exported; the raw constructor is not
  type TreatmentCode = TreatmentCode of String

  type TreatmentCodeError =
    | WrongLength of Integer
    | BadPrefix of Char
    | NotDigits of String

  parse : String -> Result<TreatmentCode, TreatmentCodeError>
  value : TreatmentCode -> String        -- unwrap, for the edge only
```

Three exports: the type, the parser, the unwrapper. Nothing else. Callers
cannot build one any other way, so every `TreatmentCode` in the system
satisfies the rules.

## Normalise before validating

Normalisation makes equality obvious and removes a class of duplicate
values.

```text
parse raw =
  let s = trim (toUpperCase raw)
  in if length s /= 5 then Error (WrongLength (length s))
     else if not (isPrefix s) then Error (BadPrefix (head s))
     else if not (allDigits (drop 1 s)) then Error (NotDigits s)
     else Ok (TreatmentCode s)
```

The rule: any normalisation the domain considers insignificant happens
once, at construction. Then plain equality is correct, and no consumer
needs to remember to lower-case anything.

Do not normalise away something the domain considers significant.
Trimming a password, or upper-casing a name, destroys data.

## Design the error type

The error is part of the interface. Two questions decide its shape:

1. **Who reads it?** A user filling a form needs a different message
   from a developer reading a log. Return structured cases and let the
   edge render them.
2. **Does the caller act differently per case?** If yes, separate cases.
   If no, one case with a message is enough.

```text
-- structured: the form can highlight the right field
type EmailError = Empty | MissingAt | TooLong of Integer

-- flat: nobody branches on it, so do not invent cases
type NoteError = NoteError of Text
```

Avoid a single `String` error for anything a caller might branch on, and
avoid a twelve-case enum where nobody branches at all. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).

## Variants of the constructor

| Variant           | Signature                | Use                    |
| ----------------- | ------------------------ | ---------------------- |
| Parse             | `String -> Result<T, E>` | Untrusted input        |
| Total constructor | `Nat -> T`               | When no input can fail |
| Clamping          | `Integer -> T`           | When the domain says   |
|                   |                          | out of range means the |
|                   |                          | nearest legal value    |
| Unsafe, internal  | `String -> T`            | Rehydrating from a     |
|                   |                          | trusted store          |

The unsafe variant is sometimes necessary: values read back from a
database were validated when written. Keep it internal to the module,
name it so nobody uses it by accident, and prefer re-parsing when the
cost is acceptable, because storage does drift.

## Testing a smart constructor

Four tests, always:

1. A known good value parses and round-trips through `value`.
2. Each error case is produced by an input that triggers it.
3. Normalisation makes two equivalent inputs equal.
4. A value that parsed cannot be made invalid by anything the module
   exports.

Property-based testing suits this well: generate valid values, assert
they always round-trip; generate arbitrary strings, assert the parser
never crashes and never returns a value violating the rule. See
[testing-functional-code](../../testing-functional-code/SKILL.md).

## Placing constructors in a pipeline

Parsers belong at the boundary, in one step, before the domain sees
anything.

```text
parseBookedTreatment : RawLine -> Result<BookedTreatment, LineError>
parseBookedTreatment raw =
  TreatmentCode.parse raw.code
    |> andThen (\code ->
       Quantity.parse raw.qty
         |> map (\qty -> { code, qty }))
```

Collecting several parse errors at once, rather than stopping at the
first, is applicative validation. See
[handling-errors-with-results](../../handling-errors-with-results/SKILL.md).
