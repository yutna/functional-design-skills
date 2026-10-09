# Schema at the Boundary

`Schema` describes a transformation between an encoded shape, which is
what crosses the boundary, and a decoded type, which is what the domain
uses. That is exactly the two type families the core skill asks for, with
the mapping generated rather than hand-written.

## Contents

- [A schema with branding and constraints](#a-schema-with-branding-and-constraints)
- [Decoding](#decoding)
- [Encoding](#encoding)
- [Unions](#unions)
- [Custom transformations](#custom-transformations)
- [Versioning](#versioning)
- [What not to do](#what-not-to-do)
- [Testing](#testing)

## A schema with branding and constraints

```ts
import { Schema } from "effect";

const TreatmentCode = Schema.Trim.pipe(
  Schema.compose(Schema.Uppercase),
  Schema.pattern(/^[WG]\d{4}$/),
  Schema.brand("TreatmentCode"),
);
type TreatmentCode = Schema.Schema.Type<typeof TreatmentCode>;

const Quantity = Schema.Int.pipe(
  Schema.between(1, 1000),
  Schema.brand("Quantity"),
);

const BookedTreatment = Schema.Struct({
  code: TreatmentCode,
  quantity: Quantity,
});

const Booking = Schema.Struct({
  id: BookingId,
  treatments: Schema.NonEmptyArray(BookedTreatment),
});
type Booking = Schema.Schema.Type<typeof Booking>;
type BookingEncoded = Schema.Schema.Encoded<typeof Booking>;
```

`Schema.Schema.Type` is the domain type: branded, non-empty, constrained.
`Schema.Schema.Encoded` is the DTO. Keep the second out of the domain
entirely.

`Schema.Trim` and `Schema.Uppercase` are transformations, so the code is
normalised as it is decoded. `Schema.trimmed()` has a similar name and
does something else: it is a filter, and it rejects a padded string
where `Trim` would have trimmed it.

## Decoding

```ts
const parseBooking = Schema.decodeUnknown(Booking);
// (u: unknown) => Effect<Booking, ParseError>
```

One call parses, validates, and brands, producing a value the rest of the
system can trust. Everything past it is written against types that cannot
be wrong. See
[functional-making-illegal-states-unrepresentable](../../functional-making-illegal-states-unrepresentable/SKILL.md).

To report every problem at once rather than the first:

```ts
Schema.decodeUnknown(Booking)(input, { errors: "all" });
```

Use that for forms and batch imports. See
[applicative-validation.md](../../functional-handling-errors-with-results/references/applicative-validation.md).

## Encoding

```ts
const toWire = Schema.encode(Booking);
```

Encoding a valid domain value should not fail. If it can, the schema is
describing two different things and should be split.

## Unions

```ts
const Payment = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("cash") }),
  Schema.Struct({
    kind: Schema.Literal("card"),
    number: CardNumber,
  }),
);
```

`Schema.TaggedStruct` gives the same shape with the `_tag` convention
that `Match.tag` and `catchTag` use. Pick one discriminator convention
per codebase.

An unknown tag from outside produces a parse error, never a default,
which is what the boundary rule requires.

## Custom transformations

When the wire shape and the domain shape genuinely differ, describe the
transformation rather than writing two mappers.

```ts
import { ParseResult, Schema } from "effect";

const Satang = Schema.Int.pipe(
  Schema.nonNegative(),
  Schema.brand("Satang"),
);

// "12.50" on the wire, 1250 in the domain.
const SatangFromBaht = Schema.transformOrFail(Schema.String, Satang, {
  strict: true,
  decode: (text, _, ast) => {
    const parts = /^(\d+)\.(\d{2})$/.exec(text);
    return parts
      ? ParseResult.succeed(Number(parts[1]) * 100 + Number(parts[2]))
      : ParseResult.fail(new ParseResult.Type(ast, text, "expected 0.00"));
  },
  encode: (satang) => ParseResult.succeed((satang / 100).toFixed(2)),
});
```

Both callbacks return a `ParseResult`, never a bare value. Both
directions sit in one place, so they cannot drift, which is the main
failure mode of hand-written mappers.

## Versioning

The schema is the versioned artefact; the domain type is not.

```ts
const BookingV1 = Schema.Struct({ /* ... */ });
const BookingV2 = Schema.Struct({ /* ... */ });

const fromV1 = (
  dto: Schema.Schema.Encoded<typeof BookingV1>,
): Booking => {
  /* ... */
};
```

Add a schema and a mapping per wire version; keep the domain type stable.
See
[dto-mapping.md](../../functional-crossing-io-boundaries/references/dto-mapping.md).

## What not to do

- **Do not use encoded types inside the domain.** They carry the wire's
  compromises: nullable fields, string enums, plain arrays.
- **Do not derive the schema from the domain type automatically and call
  it the API contract.** Then a domain rename becomes a breaking API
  change.
- **Do not skip decoding because the input "comes from us".** Another
  service, an older client, or an older row is still outside.
- **Do not validate again downstream.** A value that came back from
  `Schema.decodeUnknown` carries the schema's guarantee in its type, so a
  second check is either distrust of `Schema` or a guard against
  something the type already rules out. The rule, and the cases where a
  check does still belong, are in
  [when-to-validate-instead.md](../../functional-making-illegal-states-unrepresentable/references/when-to-validate-instead.md).

## Testing

```ts
import { Arbitrary, Effect, FastCheck as fc, Schema } from "effect";

const arbitraryBooking = Arbitrary.make(Booking);

it("round-trips", () =>
  fc.assert(
    fc.property(arbitraryBooking, (booking) =>
      Effect.runSync(
        Schema.encode(Booking)(booking).pipe(
          Effect.flatMap(Schema.decodeUnknown(Booking)),
          Effect.map((back) => expect(back).toEqual(booking)),
        ),
      ),
    ),
  ));
```

`Arbitrary.make` generates values from the schema itself, which makes
the round-trip property nearly free. It builds them for the copy of
fast-check that Effect re-exports as `FastCheck`, so take `fc` from
there: an arbitrary handed to a separately installed fast-check of
another major does not type-check. Keep stored samples of every
historical payload as well, and assert they still decode.
