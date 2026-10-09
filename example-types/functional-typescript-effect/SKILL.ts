import type { Cause } from "effect";
import type { Brand } from "../_shared/result";

// `Context`, `Effect` and `Layer` below come from the first fence's import,
// and `Slots`, `SlotUnavailable` and `PatientNotFound` from the classes it
// defines; the check puts the fences and this file in one module.

// Names the fences use without defining.
type PatientId = Brand<string, "PatientId">;
type SlotId = Brand<string, "SlotId">;
type SlotHold = { readonly slot: SlotId; readonly patient: PatientId };
type Money = { readonly satang: number };
type PatientCategory =
  | { readonly tag: "Insured"; readonly copay: Money }
  | { readonly tag: "Private" };
type BookAppointment = {
  readonly patient: PatientId;
  readonly slot: SlotId;
  readonly category: PatientCategory;
};
type Appointment = { readonly hold: SlotHold; readonly fee: Money };
declare const feeFor: (category: PatientCategory) => Money;
// Not the DOM's `confirm`: the clinic's own step, which turns a hold and a
// fee into an appointment.
declare const confirm: (hold: SlotHold, fee: Money) => Appointment;
declare const cmd: BookAppointment;

// A pool, a service tag for it, and what builds the layers around it.
type Pool = { readonly name: string };
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
