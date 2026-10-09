import type { NonEmptyArray } from "../../_shared/result";

// Domain names the fences use without defining.
type UnvalidatedBooking = { readonly raw: string };
type ValidatedBooking = { readonly valid: true };
type PricedBooking = { readonly totalSatang: number };
type AcknowledgedBooking = { readonly acknowledgedAt: number };
type BookingEvent = { readonly tag: "BookingConfirmed" };
type ValidationError = { readonly tag: "NoTreatments" };
type PricingError = { readonly tag: "UnknownTreatment" };
type SaveError =
  | { readonly tag: "Duplicate" }
  | { readonly tag: "Transient"; readonly retryAfterMs: number }
  | { readonly tag: "Unexpected"; readonly cause: unknown };
type Catalogue = { readonly prices: ReadonlyMap<string, number> };
type Booking = { readonly id: string };
type Row = readonly (string | number | boolean | null)[];
type Pool = {
  query(text: string, values: Row): Promise<unknown>;
};

declare const catalogue: Catalogue;
declare const validate: (
  raw: UnvalidatedBooking,
) => Result<ValidatedBooking, ValidationError>;
declare const price: (
  c: Catalogue,
) => (v: ValidatedBooking) => Result<PricedBooking, PricingError>;
declare const acknowledge: (p: PricedBooking) => AcknowledgedBooking;
declare const toEvents: (a: AcknowledgedBooking) => readonly BookingEvent[];
declare const INSERT: string;
declare const toRow: (b: Booking) => Row;
declare const isPgError: (e: unknown) => e is { readonly code: string };
