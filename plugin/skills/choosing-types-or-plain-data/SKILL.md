---
name: choosing-types-or-plain-data
description: Use when deciding whether a shape belongs in a type or stays generic data, when fields vary by tenant, config, or request, or when wrapper types feel heavy.
---

# Choosing Types or Plain Data

## Overview

There are two coherent schools of functional design, and this pack is
built on one of them.

**Type-first** says: name every concept, give it a type, and make illegal
values unbuildable. The rest of this pack teaches it.

**Data-first** says: keep data as generic maps and lists, keep code
separate from data, and put the schema outside the data as a separate
value you can compose, store, and generate. Nothing in the data is hidden
behind a constructor, so every generic operation — project, diff, merge,
serialise, audit — works on everything.

Both are real positions held by serious people. They disagree, and the
disagreement is not resolvable in general. It is resolvable per value, on
facts you can observe about that value, and that is what this skill is
for.

**The default in this pack is type-first.** This skill says when to leave
it, not that it is optional.

## When to use

- Choosing between a domain type and a plain map for a shape
- The field set is defined outside the code
- Wrapper types are multiplying and each one feels like paperwork
- A generic operation must work across many shapes
- Reviewing a design that models everything, or nothing

Not for: choosing **which** type once you have decided to model
something. That is
[modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md).

## The default: model it

Model the shape. Do not weigh this up each time; the cases below are the
whole list of exceptions, and "this is getting verbose" is not on it.

Verbosity is not evidence. A type that feels like paperwork while you
write it is the type that answers a question for every reader afterwards.
The cost you feel is one-off; the benefit repeats.

## When generic data is the right answer

Take the generic route when **at least one** of these is true of the
value. Each is a fact about the value, not a judgment about effort.

| Fact about the value                         | Route   |
| -------------------------------------------- | ------- |
| Field set comes from config or an admin      | generic |
| It varies per tenant, customer, or plan      | generic |
| Its schema is data the system reads          | generic |
| Nothing branches on it; it is passed through | generic |
| Operations are open: diff, merge, project    | generic |
| A business rule branches on it               | type    |
| It appears in an exported signature          | type    |
| The cases are closed and named by the domain | type    |
| Getting it wrong costs money or data loss    | type    |

Two of these can be true at once, and then the shape is doing two jobs.
Split it: see the next section.

## Usually the answer is both

Most real cases are not a choice between a type and a map. They are a
typed envelope around a generic payload.

```text
-- the envelope is modelled: these fields are known and branched on
type FormResponse = {
  templateId: TemplateId,
  submittedBy: UserId,
  submittedAt: Instant,
  answers: Map<FieldKey, JsonValue>,
}
```

`templateId` is a branded type because code looks it up. `answers` is a
map because the admin who built the template decided its keys, and no
code in the system branches on them. Nothing was compromised: every value
got the treatment its own facts called for.

The unit of this decision is a **value, not a module and not a project**.
The same record routinely has modelled fields and generic ones.

## What the generic route costs

The generic route is not the cheap route. It moves the work, it does not
remove it. Taking it means you owe all four of these:

1. **A schema at the boundary.** One parse, one place, returning
   `Result`. A map that entered the system unparsed is not data-first; it
   is untyped.
2. **Key constants in one module.** String literals for keys, spread
   across call sites, are the same defect as a status string spread
   across modules.
3. **Accessor functions, not path literals.** `answerFor key response`,
   not `response.answers[key]` written in nine places. This is where the
   generic route keeps its refactorability.
4. **A coverage test per dispatch site.** Whatever branches on the data
   needs a test driven by the list of legal keys, because no compiler
   will tell you a case is missing.

If you are not going to pay for all four, model the type instead. The
type is cheaper than a half-done generic representation.

## The boundary is still a parse

Generic data belongs outside the parse. Inside it, whatever the parse
produced is what downstream code trusts.

```text
-- outside: whatever the sender sent
parseSubmission : Json -> Result<FormResponse, ParseError>

-- inside: answers is still a map, but FormResponse is not Json,
-- and templateId is not a string
recordSubmission : FormResponse -> AsyncResult<Unit, StoreError>
```

Generic data drifting inward with no parse is the failure
[crossing-io-boundaries](../crossing-io-boundaries/SKILL.md) already
forbids. Nothing here licenses it.

## What this does not overturn

Read plainly, so this skill cannot be used as a general exemption:

- Illegal states still get designed away wherever the cases are closed.
  See
  [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md).
- Domain values in exported signatures still get wrapped. See
  [constraining-primitive-values](../constraining-primitive-values/SKILL.md).
- Data is still immutable either way. Data-first insists on this at least
  as hard as type-first does.
- Errors are still values in the signature, never thrown.
- The parse at the boundary is still mandatory.

## Language starting points

The default is the same everywhere; how far the exceptions reach is not.

| Language                | Where the line usually falls              |
| ----------------------- | ----------------------------------------- |
| TypeScript strict       | Model it; generic only on the facts above |
| Effect                  | Model it; `Schema` carries both sides     |
| Elixir                  | Model the envelope, maps inside are idiom |
| JavaScript, no checker  | Model through constructors, keys as data  |
| A language with no ADTs | Generic plus schema is the honest option  |

## Red flags

Both directions, because both failures are real.

- A branded type wrapping a value that one function computes and consumes
- Ten wrapper types added in one commit, none used across a boundary
- A `Map<String, Any>` reaching a function that makes a business decision
- Key literals typed out at more than two call sites
- A generic payload with no schema anywhere
- A type widened with optional fields so two tenants can share it
- The same shape modelled in one module and generic in the next

## Common mistakes

- **Reading this skill as permission.** It has four exceptions and each
  one is an observable fact. "This is verbose" is not one of them.
- **Choosing per project.** A project-wide decision is always wrong for
  some of its values. Decide per value.
- **Generic without a schema.** That is not the data-first school; it is
  the absence of any school.
- **Modelling a pass-through.** A payload the system stores and returns
  unexamined does not need a type; it needs to survive the round trip.
- **Branding inside a function.** A wrapper only pays where a caller
  could otherwise pass the wrong thing.
- **Treating the schema as the domain model.** A schema's inferred type
  describes the wire, not the business. See
  [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md).

## Related skills

- [making-illegal-states-unrepresentable](../making-illegal-states-unrepresentable/SKILL.md)
- [constraining-primitive-values](../constraining-primitive-values/SKILL.md)
- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [crossing-io-boundaries](../crossing-io-boundaries/SKILL.md)
- [diagnosing-complexity](../diagnosing-complexity/SKILL.md)

## Further reading

- [two-schools.md](references/two-schools.md) sets the two positions
  against each other and marks exactly where they conflict, and where
  they agree.
- [schema-as-data.md](references/schema-as-data.md) is how to take the
  generic route without losing the guarantees.
- [decision-worked.md](references/decision-worked.md) works three real
  decisions through, naming the fact that settled each.
