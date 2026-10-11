// @resolve effect effect-4
import type { Cause, Context } from "effect";
import type {
  Appointment,
  BookAppointment,
  Money,
  PatientCategory,
  PatientId,
  Pool,
  SlotHold,
  SlotId,
} from "../_shared/clinic";

// The same fences as SKILL.ts, checked against Effect 4: the directive on the
// first line sends every import of `effect` to the `effect-4` package, so the
// fences keep saying `from "effect"`. Only what Effect 4 declares differently
// is declared here; everything else is in SKILL.ts, and the two are to stay
// the same except for `Slots`, `Database` and the tagged-error helper.

// The service the workflow requires, declared the way Effect 4 declares one:
// a class whose base is a service class carrying its identifier and shape.
type SlotsShape = {
  readonly hold: (slot: SlotId) => Effect.Effect<SlotHold, SlotUnavailable>;
};
declare const SlotsService: Context.ServiceClass<Slots, "Slots", SlotsShape>;
declare class Slots extends SlotsService {}

// Names the fences use without defining.
declare const feeFor: (category: PatientCategory) => Money;
// Not the DOM's `confirm`: the clinic's own step, which turns a hold and a
// fee into an appointment.
declare const confirm: (hold: SlotHold, fee: Money) => Appointment;
declare const cmd: BookAppointment;

// A pool, a service for it, and what builds the layers around it.
declare const Database: Context.Service<"Database", Pool>;
declare const DatabaseLive: Layer.Layer<"Database">;
declare const holdInDb: (
  pool: Pool,
  slot: SlotId,
) => Effect.Effect<SlotHold, SlotUnavailable>;

// What Data.TaggedError makes: a yieldable error with a tag and its fields.
type TaggedError<Tag extends string, Fields> = Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
declare const BadRequest: new () => TaggedError<"BadRequest", {}>;
declare const suggestAlternatives: (slot: SlotId) => Appointment;
declare const booking: Effect.Effect<
  Appointment,
  SlotUnavailable | PatientNotFound
>;
