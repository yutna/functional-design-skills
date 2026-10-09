import { Config, Context, Effect, Layer } from "effect";
import type { Cause } from "effect";
import type { Brand } from "../../_shared/result";

// Names the fences use without defining.
type PatientId = Brand<string, "PatientId">;
type SlotId = Brand<string, "SlotId">;
type TreatmentCode = Brand<string, "TreatmentCode">;
type SlotHold = { readonly slot: SlotId; readonly patient: PatientId };
type Appointment = { readonly hold: SlotHold };
type Money = { readonly satang: number };
type Instant = { readonly epochMillis: number };
type BookAppointment = { readonly patient: PatientId; readonly slot: SlotId };
declare const confirm: (hold: SlotHold) => Appointment;

// What Data.TaggedError makes: a yieldable error with a tag and its fields.
type TaggedError<Tag extends string, Fields> = Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
declare const SlotUnavailable: new (args: {
  readonly slot: SlotId;
}) => TaggedError<"SlotUnavailable", { readonly slot: SlotId }>;
type SlotUnavailable = InstanceType<typeof SlotUnavailable>;

// The services and layers the fences compose. `Slots` is the service the
// first fence declares.
type Pool = { readonly name: string };
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
declare const PatientsLive: Layer.Layer<"Patients", never, "Database">;
declare const ClockLive: Layer.Layer<"Clock">;
declare const fixedInstant: Instant;

declare const req: { readonly path: string };
declare const handleRequest: (
  req: { readonly path: string },
) => Effect.Effect<number, never, Slots | "Patients" | "Clock">;

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
