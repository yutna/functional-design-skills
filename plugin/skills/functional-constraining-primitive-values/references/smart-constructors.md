# Smart Constructors

A smart constructor is the only way to build a value of a constrained
type. It takes a raw input, applies every rule the type promises, and
returns either the value or a description of what was wrong.

## Contents

- [Why it returns a value rather than a verdict](#why-it-returns-a-value-rather-than-a-verdict)
- [The shape](#the-shape)
- [Normalise before validating](#normalise-before-validating)
- [Design the error type](#design-the-error-type)
- [Variants of the constructor](#variants-of-the-constructor)
- [Testing a smart constructor](#testing-a-smart-constructor)
- [Placing constructors in a pipeline](#placing-constructors-in-a-pipeline)

## Why it returns a value rather than a verdict

The constructor above could have been a check. It is not, and the
difference is the whole reason this file exists.

```text
-- a verdict: the work is done and then discarded
isTreatmentCode : String -> Boolean

-- a value: the work is done and kept
parse : String -> Result<TreatmentCode, TreatmentCodeError>
```

Both do identical work. They differ in what survives it. The first
returns one bit and hands back the same `String` it was given, so
everything downstream holds a value that is no different from an
unchecked one. The type cannot tell the caller that the check happened,
so the caller cannot rely on it, and the honest response is to check
again.

That is where duplicated validation comes from. It is not carelessness;
it is the only safe reading of a signature that took a `String` and
gave a `String` back.

The second returns a **narrower type**. The evidence the check produced
is now carried by the value itself, so no function downstream can be
handed something unchecked, and none of them needs a guard. One
function does the work, and the type distributes the result.

Three consequences worth stating, because each is a rule elsewhere in
this pack that follows from this one:

1. **The check belongs where the type narrows**, which is the boundary,
   and nowhere else. See
   [functional-crossing-io-boundaries](../../functional-crossing-io-boundaries/SKILL.md).
2. **A function that begins with a guard about its own input is telling
   you its parameter type is too wide.** Narrow the parameter and the
   guard has nothing to do. See
   [functional-composing-functions](../../functional-composing-functions/SKILL.md).
3. **A failure must say what was wrong**, not merely that something
   was, because the caller has to render or act on it. A boolean cannot
   carry that; a `Result` can.

The test for any check you are about to write: after it returns true,
is there a type in the program that could not have existed before? If
not, the check has produced nothing, and the next reader will write it
again.

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
[functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md).

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
[functional-testing-functional-code](../../functional-testing-functional-code/SKILL.md).

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
[functional-handling-errors-with-results](../../functional-handling-errors-with-results/SKILL.md).
