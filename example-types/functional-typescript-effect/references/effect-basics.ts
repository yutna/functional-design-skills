import { Data, Effect, Either, Layer, Match, Option, Schedule } from "effect";
import type { Cause } from "effect";
import type { Brand } from "../../_shared/result";

// Names the fences use without defining.
type PatientId = Brand<string, "PatientId">;
type SlotId = Brand<string, "SlotId">;
type Instant = { readonly epochMillis: number };
type Money = { readonly satang: number };
type PatientCategory =
  | { readonly tag: "Insured"; readonly copay: Money }
  | { readonly tag: "Private" };
type Quantity = Brand<number, "Quantity">;
type CardNumber = Brand<string, "CardNumber">;

// A service, named by the domain, that the type fence requires. The error
// `SlotUnavailable` is the class the tagged-errors fence defines.
interface Slots {
  readonly hold: (slot: SlotId) => Effect.Effect<Hold, SlotUnavailable>;
}
type Patient = { readonly id: PatientId };
type Hold = { readonly slot: SlotId; readonly patient: PatientId };
type Appointment = { readonly hold: Hold };
type BookAppointment = { readonly patient: PatientId; readonly slot: SlotId };
declare const cmd: BookAppointment;
declare const findPatient: (
  id: PatientId,
) => Effect.Effect<Patient, PatientNotFound>;
declare const holdSlot: (
  slot: SlotId,
  patient: Patient,
) => Effect.Effect<Hold, SlotUnavailable>;
declare const confirm: (hold: Hold) => Appointment;
declare const alternatives: (nextFree: Option.Option<Instant>) => Appointment;

// What Data.TaggedError makes: a yieldable error with a tag and its fields.
type TaggedError<Tag extends string, Fields> = Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
declare const DatabaseError: new (args: {
  readonly cause: unknown;
}) => TaggedError<"DatabaseError", { readonly cause: unknown }>;
type PatientNotFound = TaggedError<
  "PatientNotFound",
  { readonly patient: PatientId }
>;

type Pool = { query(sql: string): Promise<unknown> };
declare const pool: Pool;
declare const sql: string;

declare const effects: readonly Effect.Effect<number>[];

type Connection = { close(): Promise<void> };
declare const acquireConnection: Effect.Effect<Connection>;
declare const useConnection: (conn: Connection) => Effect.Effect<number>;
declare const AppLive: Layer.Layer<never>;

// A payment keyed on `_tag`, the field Match.tag reads.
type Payment =
  | { readonly _tag: "Cash" }
  | { readonly _tag: "Card"; readonly number: CardNumber }
  | { readonly _tag: "Transfer"; readonly bank: string };
declare const maskCard: (n: CardNumber) => string;
