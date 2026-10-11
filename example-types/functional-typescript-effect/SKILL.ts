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

// SKILL.md holds on Effect 3 and on Effect 4, and is checked against both:
// this prelude is for Effect 3, and SKILL.effect-4.ts, which says so on its
// first line, is for Effect 4. `Effect`, `Layer` and `Data` below come from
// the first fence's import, and `SlotUnavailable` and `PatientNotFound` from
// the classes it defines; the check puts the fences and this file in one
// module. `Slots` is the one name the two preludes declare differently, since
// declaring a service is the line that differs by major.

// The service the workflow requires, declared the way Effect 3 declares one:
// a class whose base is a tag class carrying its identifier and its shape.
type SlotsShape = {
  readonly hold: (slot: SlotId) => Effect.Effect<SlotHold, SlotUnavailable>;
};
declare const SlotsTag: Context.TagClass<Slots, "Slots", SlotsShape>;
declare class Slots extends SlotsTag {}

// Names the fences use without defining.
declare const feeFor: (category: PatientCategory) => Money;
// Not the DOM's `confirm`: the clinic's own step, which turns a hold and a
// fee into an appointment.
declare const confirm: (hold: SlotHold, fee: Money) => Appointment;
declare const cmd: BookAppointment;

// A pool, a service tag for it, and what builds the layers around it.
declare const Database: Context.Tag<"Database", Pool>;
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
