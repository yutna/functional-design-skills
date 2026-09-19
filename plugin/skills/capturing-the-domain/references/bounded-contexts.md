# Bounded Contexts

A bounded context is a boundary within which a set of words has one
agreed meaning. Inside it, "customer" means exactly one thing. Outside
it, the same word may mean something else, and that is not a problem to
solve but a fact to model.

## Finding the boundaries

The boundary is where the language changes. Signals, in order of
reliability:

1. **A word means different things.** Shipping's "booking" is a box with an
   address; billing's "booking" is a set of charges.
2. **Different people are responsible.** Different departments produce
   different models, and reorganisations follow the same lines.
3. **Different rates of change.** A pricing engine that changes weekly
   does not belong with a compliance archive that changes yearly.
4. **Different data needs for the same entity.** Support needs a
   customer's history; billing needs their tax status. Neither needs the
   other's fields.

A boundary is **not** indicated by: a technical layer, a database table,
a team's preferred language, or the size of a codebase.

## Each context owns its types

The same real-world thing has a different type in each context, holding
only what that context needs.

```text
-- sales context
type Customer = { id: CustomerId, name: Name, segment: Segment }

-- shipping context
type Customer = { id: CustomerId, address: Address,
                  instructions: Option<Text> }

-- billing context
type Customer = { id: CustomerId, taxId: TaxId, terms: PaymentTerms }
```

Three types, one shared identifier. This is not duplication: each type
records what its context is responsible for, and none of them changes
when another context's needs change.

Sharing one `Customer` across all three couples every change in any
context to all of them, and produces a type where most fields are
irrelevant or absent at any given moment.

## Relationships between contexts

For each pair that communicates, decide the relationship deliberately.

| Relationship       | Meaning                                    |
| ------------------ | ------------------------------------------ |
| Shared kernel      | A small model both own and change together |
| Customer-supplier  | Downstream's needs influence upstream      |
| Conformist         | Downstream accepts upstream's model as is  |
| Anti-corruption    | Downstream translates, protecting itself   |
| Separate ways      | No integration; duplicate instead          |
| Published language | A stable published format between many     |

Defaults worth holding: prefer an **anti-corruption layer** whenever the
upstream model is not yours to change, and prefer a **published
language** over point-to-point translation once three or more contexts
integrate.

## Translating at the border

The translation is code, in one place, and it belongs to the downstream
context.

```text
-- shipping context, at its edge
fromSalesOrder : SalesOrderMessage -> Result<Shipment, TranslationError>
```

Rules for a border:

1. The translation function is the only place the foreign shape appears.
2. It returns `Result`: a foreign model can always send something this
   context cannot accept, and that is a normal event, not a crash.
3. It produces this context's own types, fully validated, so nothing
   downstream re-checks.
4. It does not leak identifiers with foreign semantics; if the upstream
   `bookingId` is not meaningful here, do not store it as this context's
   identity.

See [crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md) for
the mechanics of the mapping itself.

## Context map

Draw the contexts as boxes, the flows as arrows, and label each arrow
with the relationship and the message type. The map is worth keeping
current because it answers the question that costs the most time in a
large system: if this changes, who finds out?

Two properties to check on the map:

- **No cycles of synchronous calls.** A cycle means the two contexts are
  really one, or that one of the calls should be an event.
- **No arrow without a named message type.** An unnamed arrow is an
  integration nobody owns.

## In a single codebase

Contexts do not require separate services. In one repository they are
modules or packages with:

- their own types, not shared with siblings
- an explicit public surface, small and deliberate
- translation functions at each incoming edge
- no imports of a sibling's internal types, enforced by review or by
  tooling

Splitting into services later is then a deployment decision rather than a
redesign.
