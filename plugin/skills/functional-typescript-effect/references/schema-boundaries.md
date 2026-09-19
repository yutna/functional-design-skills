# Schema at the Boundary

`Schema` describes a transformation between an encoded shape, which is
what crosses the boundary, and a decoded type, which is what the domain
uses. That is exactly the two type families the core skill asks for, with
the mapping generated rather than hand-written.

## A schema with branding and constraints

```ts
import { Schema } from "effect";

const TreatmentCode = Schema.String.pipe(
  Schema.trimmed(),
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

## Decoding

```ts
const parseBooking = Schema.decodeUnknown(Booking);
// (u: unknown) => Effect<Booking, ParseError>
```

One call parses, validates, and brands, producing a value the rest of the
system can trust. Everything past it is written against types that cannot
be wrong. See
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md).

To report every problem at once rather than the first:

```ts
Schema.decodeUnknown(Booking)(input, { errors: "all" });
```

Use that for forms and batch imports. See
[applicative-validation.md](../../handling-errors-with-results/references/applicative-validation.md).

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
const InstantFromIso = Schema.transformOrFail(
  Schema.String,
  Schema.InstantFromSelf,
  {
    decode: (s, _, ast) =>
      parseIso(s) ??
      ParseResult.fail(new ParseResult.Type(ast, s, "bad instant")),
    encode: (i) => ParseResult.succeed(toIso(i)),
  },
);
```

Both directions in one place means they cannot drift, which is the main
failure mode of hand-written mappers.

## Versioning

The schema is the versioned artefact; the domain type is not.

```ts
const OrderV1 = Schema.Struct({ ... });
const OrderV2 = Schema.Struct({ ... });

const fromV1 = (dto: Schema.Schema.Encoded<typeof OrderV1>): Booking => ...;
```

Add a schema and a mapping per wire version; keep the domain type stable.
See
[dto-mapping.md](../../crossing-io-boundaries/references/dto-mapping.md).

## What not to do

- **Do not use encoded types inside the domain.** They carry the wire's
  compromises: nullable fields, string enums, plain arrays.
- **Do not derive the schema from the domain type automatically and call
  it the API contract.** Then a domain rename becomes a breaking API
  change.
- **Do not skip decoding because the input "comes from us".** Another
  service, an older client, or an older row is still outside.
- **Do not validate again downstream.** If a second function re-checks,
  either the first one's output type is too weak or the second is
  defending against a state the type forbids.

## Testing

```ts
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

`Schema.Arbitrary` can generate values from the schema itself, which
makes the round-trip property nearly free. Keep stored samples of every
historical payload as well, and assert they still decode.
