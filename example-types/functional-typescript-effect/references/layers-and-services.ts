import { Config, Context, Effect, Either, Layer } from "effect";
import type { Cause } from "effect";
import type {
  Appointment,
  BookAppointment,
  Money,
  PatientCategory,
  PatientId,
  Pool,
  SlotHold,
  SlotId,
} from "../../_shared/clinic";
import type { Brand } from "../../_shared/result";

// Names the fences use without defining.
type TreatmentCode = Brand<string, "TreatmentCode">;
type Instant = { readonly epochMillis: number };
declare const feeFor: (category: BookAppointment["category"]) => Money;
declare const confirm: (hold: SlotHold, fee: Money) => Appointment;

// What Data.TaggedError makes: a yieldable error with a tag and its fields.
type TaggedError<Tag extends string, Fields> = Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
declare const SlotUnavailable: new (args: {
  readonly slot: SlotId;
}) => TaggedError<"SlotUnavailable", { readonly slot: SlotId }>;
type SlotUnavailable = InstanceType<typeof SlotUnavailable>;
declare const PatientNotFound: new (args: {
  readonly patient: PatientId;
}) => TaggedError<"PatientNotFound", { readonly patient: PatientId }>;
type PatientNotFound = InstanceType<typeof PatientNotFound>;

// The services and layers the fences compose. `Slots` is the service the
// first fence declares. `Patients` is the second, with one operation: `find`
// fails with `PatientNotFound`.
type Patient = {
  readonly id: PatientId;
  readonly category: PatientCategory;
};
type PatientsShape = {
  readonly find: (id: PatientId) => Effect.Effect<Patient, PatientNotFound>;
};
declare const PatientsTag: Context.TagClass<
  Patients,
  "Patients",
  PatientsShape
>;
declare class Patients extends PatientsTag {}
declare const testPatient: Patient;
declare const Clock: Context.Tag<
  "Clock",
  { readonly now: Effect.Effect<Instant> }
>;
declare const Database: Context.Tag<"Database", Pool>;
declare const holdInDb: (
  db: Pool,
  slot: SlotId,
) => Effect.Effect<SlotHold, SlotUnavailable>;
declare const releaseInDb: (db: Pool, hold: SlotHold) => Effect.Effect<void>;
declare const openPool: Effect.Effect<Pool>;
declare const closePool: (pool: Pool) => Effect.Effect<void>;
declare const PatientsLive: Layer.Layer<Patients, never, "Database">;
declare const ClockLive: Layer.Layer<"Clock">;
declare const fixedInstant: Instant;

declare const req: { readonly path: string };
declare const handleRequest: (
  req: { readonly path: string },
) => Effect.Effect<number, never, Slots | Patients | "Clock">;

// The test fence: a slot that is taken, a hold that is not, and a test runner
// whose `toBe` takes the type of what is checked.
declare const takenSlot: SlotId;
declare const testHold: SlotHold;
declare const cmdForTakenSlot: BookAppointment;
declare function it(name: string, run: () => Promise<void>): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };

type ValidatedBooking = {
  readonly treatmentCode: TreatmentCode;
};
type PricedBooking = ValidatedBooking & { readonly fee: Money };
type Catalogue = { readonly prices: ReadonlyMap<TreatmentCode, Money> };
type PricingError = {
  readonly _tag: "TreatmentNotFound";
  readonly code: TreatmentCode;
};
