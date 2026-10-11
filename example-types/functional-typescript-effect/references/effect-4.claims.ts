// What the page says about Effect 4, proved against it. The mapping at the top
// names what the other pages use and what replaces it: each name on the left
// is gone, so a line that uses it is an error, and each name on the right is
// there. A name that came back would make a line below stop being an error,
// and the check says so.

// "Layer.effect takes the Scope out of the requirements": acquiring the pool
// needs a scope, and the layer built from it needs nothing.
const needsNothing: Layer.Layer<Database, never, never> = DatabaseLive;

// "The requirements accumulate as before": the layer for Slots reads Database.
const needsDatabase: Layer.Layer<Slots, never, Database> = SlotsLive;

// Service.
// @ts-expect-error Context.Tag is gone
Context.Tag;
Context.Service;

// Layer.
// @ts-expect-error Layer.scoped is gone
Layer.scoped;

// Handling.
// @ts-expect-error Effect.catchAll is gone
Effect.catchAll;
Effect.catch;

// The synchronous result type, with the success type first.
// @ts-expect-error Either is gone
import { Either } from "effect";
const succeeded: Result.Result<number, string> = Result.succeed(1);
const failed: Result.Result<number, string> = Result.fail("no");

// Schedule.
// @ts-expect-error Schedule.compose is gone
Schedule.compose;
Schedule.max;

// Configuration.
// @ts-expect-error Config.integer is gone
Config.integer;
// @ts-expect-error Config.duration is gone
Config.duration;
Config.Int;
Config.Duration;
Config.String;
Config.Boolean;

// Decoding and encoding. Schema.encode is still there and now takes a
// transformation, so a schema passed to it is an error.
// @ts-expect-error Schema.decodeUnknown is gone
Schema.decodeUnknown;
// @ts-expect-error Schema.encode no longer takes a schema
Schema.encode(Booking);
const decodes: (
  input: unknown,
) => Effect.Effect<Booking, Schema.SchemaError> = parseBooking;
const encodes: (
  booking: Booking,
) => Effect.Effect<BookingEncoded, Schema.SchemaError> = toWire;
// @ts-expect-error Schema.Schema.Encoded is gone
type OldEncoded = Schema.Schema.Encoded<typeof Booking>;
// "Every other name is still there": the decoded type reads either way.
type OldType = Schema.Schema.Type<typeof Booking>;
const sameType: OldType = {} as Booking;

// Constraints.
// @ts-expect-error Schema.pattern is gone
Schema.pattern;
// @ts-expect-error Schema.between is gone
Schema.between;
// @ts-expect-error Schema.nonNegative is gone
Schema.nonNegative;
// @ts-expect-error Schema.trimmed is gone
Schema.trimmed;
Schema.isPattern;
Schema.isBetween;
Schema.isGreaterThanOrEqualTo;
Schema.isTrimmed;
const trimmed = Schema.String.check(Schema.isTrimmed());

// Transformations. There is no Schema.Uppercase and no Schema.compose, and
// the module that carried the parse results is gone.
// @ts-expect-error Schema.Uppercase is gone
Schema.Uppercase;
// @ts-expect-error Schema.compose is gone
Schema.compose;
// @ts-expect-error Schema.transformOrFail is gone
Schema.transformOrFail;
// @ts-expect-error ParseResult is gone
import { ParseResult } from "effect";

// Unions and records.
// @ts-expect-error Schema.Union takes an array
Schema.Union(Schema.String, Schema.Number);
Schema.Union([Schema.String, Schema.Number]);
Schema.TaggedStruct("Cash", {});
// @ts-expect-error Schema.Record no longer takes an object
Schema.Record({ key: Schema.String, value: Schema.Unknown });
Schema.Record(Schema.String, Schema.Unknown);

// Testing.
// @ts-expect-error Arbitrary.make is gone
Arbitrary.make;
Arbitrary.schema;
// @ts-expect-error FastCheck is not re-exported
import { FastCheck } from "effect";
