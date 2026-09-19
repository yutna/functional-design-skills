---
name: capturing-the-domain
description: Use when starting a feature or system, when code and the business use different words for the same thing, or when drawing boundaries between subsystems.
---

# Capturing the Domain

## Overview

Software fails most often because the model in the code does not match
the model in the experts' heads. The cure is not more documentation; it
is a shared mental model, expressed in the same words in conversation, in
the types, and in the function names, with no translation step anywhere.

Discover the domain through what happens, not through what things are. A
list of nouns produces a database schema; a list of events and the
commands that cause them produces a design.

## When to use

- Starting a new feature, service, or bounded context
- Code says `UserRecord` while the business says "applicant"
- A term means two different things in two parts of the system
- Deciding where one subsystem ends and the next begins
- Before any schema, API, or type is written down

Not for: choosing the representation of a type once the concept is clear,
which is
[modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md).

## Core rules

1. **Use the domain's words, unchanged.** If experts say "quote", the
   type is `Quote`, not `PricingRequestDto`. Words invented by developers
   are the beginning of two models.
2. **Discover through events.** Ask what happens, in the past tense:
   "booking confirmed", "payment declined". Events reveal boundaries that
   nouns hide.
3. **Every workflow is a command in, events out.** Name the trigger, the
   work, and what the rest of the world learns. That triple is the unit
   of design. See
   [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md).
4. **Draw a context boundary wherever a word changes meaning.** If
   "customer" means a billing account here and a person there, those are
   two contexts, and the two `Customer` types must be different types.
5. **Never share a model across contexts.** Translate at the border, in
   one place, deliberately.
6. **Persist nothing until the model holds.** Deriving the model from a
   schema imports the storage's compromises into the domain forever.
7. **Write the model down as types, and read them back to the experts.**
   Types are the cheapest reviewable artefact, and non-programmers can
   follow a well-named choice type.

## Pattern

The developer-invented model, taken from the database:

```text
type BookingRecord = {
  id: Int,
  customerId: Int,
  statusCode: String,
  total: Float,
  flag1: Boolean,
  processedAt: DateTime?,
}
```

Nothing here is a business word. `flag1` will be explained in a wiki page
that goes stale. `statusCode` will be compared against string literals in
four modules.

The domain's model, taken from a conversation:

```text
-- "A quote becomes a booking when the customer accepts it. We can only
--  accept a quote that hasn't expired."
type Quote = { id: QuoteId, lines: NonEmptyList<QuoteLine>,
               expires: Instant }

type AcceptQuote = { quote: QuoteId, acceptedBy: CustomerId }
type QuoteAccepted = { booking: Booking, acceptedAt: Instant }
type AcceptQuoteError = QuoteExpired of Instant | QuoteNotFound

acceptQuote :
  AcceptQuote -> Result<QuoteAccepted, AcceptQuoteError>
```

Every name came from the business. The rule about expiry is visible in
the error type. An expert can read this and say whether it is right.

## Discovery procedure

1. **Collect events.** With the experts, list everything that happens, in
   the past tense, on one surface. Do not organise yet.
2. **Find the triggers.** For each event, ask what caused it: a command
   from a person, another event, or the passage of time.
3. **Group into workflows.** A command, the work it triggers, the events
   it produces. Name each workflow in the domain's words.
4. **Mark the pain points.** Where experts disagree, hesitate, or say "it
   depends", that is where the real complexity is.
5. **Listen for changed meanings.** The same word used differently by two
   people is a context boundary, not a naming argument to settle.
6. **Draw the contexts and the flows between them**, then decide the
   relationship of each pair. See
   [bounded-contexts.md](references/bounded-contexts.md).
7. **Write the types**, and read them back. Iterate on the types, not on
   prose.

## Quick reference

| Domain concept   | Appears in code as                          |
| ---------------- | ------------------------------------------- |
| Event            | A record named in the past tense            |
| Command          | A record named as an imperative             |
| Workflow         | One function, command in, events out        |
| Business rule    | A type that makes the violation unbuildable |
| Constraint       | A constructor that can fail                 |
| Bounded context  | A module or service with its own types      |
| Context boundary | An explicit translation function            |

## Red flags

- A type name that no business person would recognise
- The same word meaning two things in one codebase
- The model was derived from tables, or from an existing API
- A workflow with no named trigger and no named outcome
- "We'll clarify that with the business later" in a design document
- One shared `Customer` type used by billing, shipping and support

## Common mistakes

- **Modelling nouns first.** Entity lists produce schemas. Events produce
  designs.
- **Settling a vocabulary dispute by vote.** Two meanings mean two
  contexts. Keep both words, in different places.
- **Treating the ubiquitous language as global.** It is ubiquitous within
  one context, not across the company.
- **Building a canonical shared model.** A model that serves every
  context serves none, and every change to it touches everything.
- **Skipping the read-back.** Types nobody outside the team has reviewed
  are guesses written confidently.

## Related skills

- [modeling-with-algebraic-types](../modeling-with-algebraic-types/SKILL.md)
- [designing-workflow-pipelines](../designing-workflow-pipelines/SKILL.md)
- [enforcing-consistency-boundaries](../enforcing-consistency-boundaries/SKILL.md)
- [choosing-precise-names](../choosing-precise-names/SKILL.md)

## Further reading

- [event-storming.md](references/event-storming.md) is the discovery
  session, step by step, with the questions that produce a model.
- [bounded-contexts.md](references/bounded-contexts.md) covers finding
  boundaries, context maps, and translating at the border.
