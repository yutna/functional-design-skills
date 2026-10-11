# Taking the Generic Route Without Losing the Guarantees

The generic route is a discipline, not the absence of one. A map with no
schema, no key constants, and no accessors is not the generic route; it
is what the generic route was supposed to prevent.

This file is the discipline. If a project is not going to follow it, model
the type instead.

## Contents

- [The schema is a value](#the-schema-is-a-value)
- [One parse at the edge](#one-parse-at-the-edge)
- [Keys are constants, not literals](#keys-are-constants-not-literals)
- [Accessors, not paths](#accessors-not-paths)
- [Dispatch on data, and test the dispatch](#dispatch-on-data-and-test-the-dispatch)
- [Version the schema, because stored data outlives it](#version-the-schema-because-stored-data-outlives-it)
- [What you still model on this route](#what-you-still-model-on-this-route)
- [Checklist](#checklist)

## The schema is a value

The point of separating schema from representation is that the schema
becomes something the program can hold, pass, compose, and store.

```text
type FieldSpec =
  | Text of { maxLength: Integer }
  | Number of { min: Decimal, max: Decimal }
  | Choice of NonEmptyList<String>
  | DateOnly

type FormTemplate = {
  id: TemplateId,
  version: SchemaVersion,
  fields: Map<FieldKey, FieldSpec>,
}

validate : FormTemplate -> Map<FieldKey, JsonValue>
         -> Result<ValidatedAnswers, List<FieldError>>
```

Note what is modelled and what is not. `FieldSpec` is a closed choice
type, because the set of field kinds is decided by developers and code
branches on every case. `fields` is a map, because its keys are decided
by whoever built the template. The schema is data; the _language_ the
schema is written in is a type.

That split is the general pattern. **Model the vocabulary, keep the
document generic.**

## One parse at the edge

Exactly as in the type-first route. The difference is what the parse
returns: not a fully modelled record, but a value that proves the parse
ran.

```text
-- accepts anything, returns something that has been checked
parseAnswers :
  FormTemplate -> Json -> Result<ValidatedAnswers, List<FieldError>>
```

`ValidatedAnswers` is a single-case wrapper over the map. It carries no
extra structure. Its entire job is to be a type that only functions in
the module that owns it can produce (`parseAnswers`, and the steps it is
built from, such as `validate` and `readAnswers`), so downstream code
cannot be handed a raw map by mistake.

That one wrapper is not a concession to the other school. It is what makes
the check unskippable, and every generic-route design needs it. Without
it, nothing distinguishes checked data from unchecked data, and defensive
re-checking spreads exactly as it does with raw primitives.

## Keys are constants, not literals

A key spelled out at nine call sites is the same defect as a status
string spelled out in nine modules: nothing renames it, nothing finds all
its uses, and a typo is a silent `None`.

```text
-- in one module, the only place these strings appear
module FieldKeys where
  emailAddress = FieldKey "email_address"
  companyName  = FieldKey "company_name"

  all : List<FieldKey>
  all = [emailAddress, companyName, ...]
```

Constants are for the keys that code reads or branches on, such as the one
behind `emailOf`. The keys an admin defines are not named in code, so they
get no constant: they are read from the template at run time, and `all`
means the template's keys there.

`FieldKey` itself is a single-case wrapper, for the same reason ids are:
it stops a `UserId` being passed where a key was wanted. Wrapping the key
type is cheap and it does not make the document typed.

The `all` list is load-bearing: it is what the coverage tests iterate over
the keys that code names.

## Accessors, not paths

Every read of the generic payload goes through a named function. This is
the single rule that decides whether the generic route stays
refactorable.

```text
-- one definition, in the module that owns the shape
answerFor : FieldKey -> ValidatedAnswers -> Option<JsonValue>
emailOf   : ValidatedAnswers -> Option<EmailAddress>
```

```text
-- not this, anywhere outside that module
response.answers["email_address"]
```

The accessor is where a shape change is absorbed. Path literals scattered
through the codebase are change amplification by construction: see
[functional-diagnosing-complexity](../../functional-diagnosing-complexity/SKILL.md).

Accessors that return a domain type, like `emailOf`, are where the two
routes meet. The document stays generic; the values you actually decide
with come out modelled.

## Dispatch on data, and test the dispatch

Where code branches on the generic content, the tag discipline from
[static-and-dynamic.md](../../functional-modeling-with-algebraic-types/references/static-and-dynamic.md)
applies unchanged: exact tag values from one module, an explicit loud
failure for an unknown tag, and one test per dispatch site driven by the
list of the cases it dispatches on. `renderField` dispatches on the cases of
`FieldSpec`, so the list is one sample spec for each case.

```text
for each spec in sampleSpecs:        -- one for each case of FieldSpec
  assert renderField spec does not raise
```

This test is not optional on this route. It is the compiler's job, moved.

## Version the schema, because stored data outlives it

This is the consequence people miss, and it is the largest real cost of
the generic route.

When the schema is fused into the type, changing a shape is a code change,
and the compiler lists the code to update. Stored values are still old
rows, and the typed route reads them through a function that returns
`Result`; see
[Persistence](../../functional-modeling-state-machines/references/transitions.md#persistence).
When the schema is a separate value, stored data was written against
_whatever schema was current then_, and nothing forces a migration: no
deploy fails to say that old data is unread.

So the schema carries a version, and every stored document records the
version it was written against.

```text
type StoredSubmission = {
  templateId: TemplateId,
  templateVersion: SchemaVersion,
  answers: Map<FieldKey, JsonValue>,
}

readAnswers :
  FormTemplate -> StoredSubmission -> Result<ValidatedAnswers, ReadError>
```

`readAnswers` is pure. The handler loads the document, loads the schema
that the document names by its version, and passes both in:

```text
type ReadFailure =
  | Unreadable of ReadError
  | Unavailable of StoreError

alias LoadTemplate =
  TemplateId -> SchemaVersion -> AsyncResult<FormTemplate, StoreError>
alias LoadSubmission =
  SubmissionId -> AsyncResult<StoredSubmission, StoreError>

handleReadAnswers :
  LoadTemplate -> LoadSubmission -> SubmissionId
    -> AsyncResult<ValidatedAnswers, ReadFailure>
handleReadAnswers loadTemplate loadSubmission id =
  loadSubmission id
    |> mapError Unavailable
    |> bind (\stored ->
         loadTemplate stored.templateId stored.templateVersion
           |> mapError Unavailable
           |> bind (\template ->
                readAnswers template stored |> mapError Unreadable))
```

Two rules follow:

1. **Never read a document without knowing its schema version.** A read
   that assumes the current schema silently misinterprets old data.
2. **Upgrade on read, in one function.** Not scattered `if version < 3`
   checks across the codebase. One function per version step, composed.

If a project will not do this, it does not want the generic route. It
wants a type and a deploy-time migration.

## What you still model on this route

Even at its most generic, these stay typed:

| Thing                     | Why                                    |
| ------------------------- | -------------------------------------- |
| The envelope's own fields | Code branches on them                  |
| Ids and keys              | They get passed to the wrong parameter |
| The proof of parsing      | Otherwise the check is skippable       |
| The schema vocabulary     | Its cases are closed and dispatched on |
| Money, quantities, units  | Arithmetic on the wrong unit is silent |
| Errors                    | Callers branch on them                 |

Notice how much of the design is still type-first. The generic part is
usually one field.

## Checklist

Before shipping a generic representation, all of these are true:

1. One parse, at the boundary, returning `Result`.
2. Its output is a distinct type that only the module owning it can
   construct.
3. Keys that code reads are constants in one module, with an `all` list;
   keys the template defines are read from the template.
4. Reads go through named accessors, not path literals.
5. Every dispatch site has a coverage test driven by the list of the cases
   it dispatches on.
6. The schema has a version and stored data records it.
7. Upgrade-on-read is one composed function, not scattered checks.

Any box unticked means the type was the cheaper option. Go back and model
it: see
[functional-making-illegal-states-unrepresentable](../../functional-making-illegal-states-unrepresentable/SKILL.md).
