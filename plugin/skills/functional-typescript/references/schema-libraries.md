# Boundary Schema Libraries

A schema library replaces hand-written parsers once a codebase has more
than a handful of boundary types. All of the ones below do the same core
job; they differ on the four things that matter for this pack's design
rules.

**Verify against the installed major version.** These libraries move
quickly and several of the details below changed at a major boundary.
Check `package.json` before following any example.

## The four questions

1. **Can the parsed type be branded?** Without it, the boundary produces
   plain `string` and `number`, and the guarantees from
   [constraining-primitive-values](../../constraining-primitive-values/SKILL.md)
   stop at the edge.
2. **Do errors accumulate?** A form needs every problem at once. See
   [applicative-validation.md](../../handling-errors-with-results/references/applicative-validation.md).
3. **Is there an encode direction?** Outward mapping matters as much as
   inward, and one artefact describing both cannot drift.
4. **What does it cost?** Bundle size in a browser; compile and startup
   time on a server.

## The comparison

| Library | Brand     | Accumulates       | Encode            |
| ------- | --------- | ----------------- | ----------------- |
| Zod     | Yes       | Yes               | Version-dependent |
| Valibot | Yes       | Yes               | Version-dependent |
| ArkType | Yes       | Yes               | Limited           |
| TypeBox | Via casts | Via the validator | Separate          |

| Library | Shape                | Cost note                          |
| ------- | -------------------- | ---------------------------------- |
| Zod     | Method chaining      | Largest of the four                |
| Valibot | Composed functions   | Tree-shakes to very little         |
| ArkType | Type-like syntax     | Fast validation, small             |
| TypeBox | JSON Schema builders | Pairs with a JSON Schema validator |

**Zod** is the default choice for most teams: the largest ecosystem, the
best documentation, and enough expressive power for anything here. Its
cost is bundle size, which matters in a browser and not on a server.

**Valibot** suits browser bundles specifically. It composes with `pipe`
rather than chaining, so unused validators are dropped entirely.

**ArkType** suits codebases that value schemas reading like the types
they describe, and where validation is hot enough that speed matters.

**TypeBox** suits systems that must also publish JSON Schema — an
OpenAPI document, an event registry, a contract with another team. If
that is not a requirement, one of the other three is a better fit.

## Branding at the boundary

The point of branding here is that a value which crossed the boundary
arrives already carrying its guarantee.

```ts
// Zod
const TreatmentCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[WG]\d{4}$/)
  .brand<"TreatmentCode">();

type TreatmentCode = z.infer<typeof TreatmentCode>;
```

```ts
// Valibot
const TreatmentCode = v.pipe(
  v.string(),
  v.trim(),
  v.toUpperCase(),
  v.regex(/^[WG]\d{4}$/),
  v.brand("TreatmentCode"),
);
```

Both produce a nominal type that a plain string cannot be assigned to,
which is the same guarantee as the hand-written parser in
[branded-types.md](branded-types.md), without the boilerplate.

Normalise inside the schema, as above, so equality is correct everywhere
downstream and no consumer has to remember to trim.

## Accumulating errors

All three of Zod, Valibot and ArkType report every issue by default and
offer an abort-early mode. Prefer the default at a boundary a person
will fix, and abort early only where a later check cannot run without an
earlier one.

```ts
const parsed = BookingDto.safeParse(input);
if (!parsed.success) {
  return err(
    parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      problem: i.code,
    })),
  );
}
```

Map the library's issue shape into **your own** error type at this
point. Passing library issues into the domain, or into a UI, welds both
to the library and to its message wording.

## Do not let the inferred type become the domain type

The single rule this reference exists for.

```ts
// the DTO: nullable, string enums, plain arrays
type BookingDto = z.infer<typeof BookingDtoSchema>;

// the domain type: separate, with the guarantees
type Booking = {
  readonly id: BookingId;
  readonly treatments: NonEmptyArray<BookedTreatment>;
  readonly lifecycle: Lifecycle;
};

const toBooking = (dto: BookingDto): Result<Booking, MapError> => ...;
```

A schema rich enough to brand and constrain closes much of the gap, and
for simple types the inferred type is a perfectly good domain type. It
stops being one as soon as the wire shape and the domain shape diverge:
a nullable column, a legacy field, a string enum the domain models as a
choice type with payloads. Keep the mapping function from the start, even
when it is the identity, so that divergence is a change to one function
rather than a refactor. See
[crossing-io-boundaries](../../crossing-io-boundaries/SKILL.md).

## Depending on the interface, not the library

Several of these libraries implement a shared validator interface, which
lets a module accept "something that validates" without naming which
library produced it.

```ts
// the module depends on the interface, not on Zod
type Validator<T> = { readonly "~standard": StandardSchemaV1<unknown, T> };
const parseWith = <T>(v: Validator<T>, input: unknown): Result<T, Issue[]> =>
  ...;
```

This is the narrow-dependency rule from
[applying-solid-functionally](../../applying-solid-functionally/SKILL.md)
applied to a library choice. Worth doing in a shared package; overkill in
an application that will only ever use one.

## What not to do

- **Do not validate the same data twice.** Once at the boundary is the
  whole design. A second check downstream says the first is not trusted.
- **Do not put business rules in the schema.** Format, presence, range
  and shape belong there. "A discount over twenty per cent needs
  approval" belongs in the domain, where it can be tested without the
  library.
- **Do not derive your public API contract from a domain type.** A rename
  then becomes a breaking change for every client. Version the schema,
  not the domain type.
- **Do not skip parsing because the data came from your own service.**
  Another deployment, an older client, and an older row are all outside.
