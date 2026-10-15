// @resolve effect effect-4
import { Context, Effect, Schema } from "effect";
import type { Pool, SlotHold, SlotId } from "../../_shared/clinic";

// Names the fences use without defining. `SlotUnavailable` is the class the
// first fence defines, and `Booking`, `Quantity` and `TreatmentCode` come from
// the schema fence; the check puts the fences and this file in one module.

// The service the fences build layers around, declared the way the first
// fence declares `Slots`.
declare const DatabaseService: Context.ServiceClass<
  Database,
  "clinic/Database",
  Pool
>;
declare class Database extends DatabaseService {}
declare const openPool: Effect.Effect<Pool>;
declare const closePool: (pool: Pool) => Effect.Effect<void>;
declare const holdInDb: (
  pool: Pool,
  slot: SlotId,
) => Effect.Effect<SlotHold, SlotUnavailable>;
declare const releaseInDb: (pool: Pool, hold: SlotHold) => Effect.Effect<void>;

// The query the retry fence wraps, and what it runs against.
type DatabaseError = { readonly _tag: "DatabaseError" };
declare const query: (
  pool: Pool,
  sql: string,
) => Effect.Effect<unknown, DatabaseError>;
declare const pool: Pool;
declare const sql: string;

// Schemas the fences compose without defining.
declare const BookingId: Schema.brand<Schema.String, "BookingId">;
declare const CardNumber: Schema.brand<Schema.String, "CardNumber">;
declare const BankCode: Schema.brand<Schema.String, "BankCode">;
declare const input: unknown;

// The test fence's runner. Its `toBe` takes the type of what is checked.
declare function it(name: string, run: () => Promise<void>): void;
declare function expect<T>(actual: T): { toBe(expected: T): void };
