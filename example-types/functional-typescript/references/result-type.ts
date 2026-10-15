import type { NonEmptyArray } from "../../_shared/result";

// Domain names the fences use without defining.
type UnvalidatedBooking = { readonly raw: string };
type ValidatedBooking = { readonly valid: true };
type PricedBooking = { readonly totalSatang: number };
type Instant = { readonly epochMillis: number };
type Seconds = number & { readonly __brand: "Seconds" };
declare const seconds: (n: number) => Seconds;
type ConfirmedBooking = PricedBooking & { readonly confirmedAt: Instant };
type ConfirmBookingEvent = {
  readonly tag: "BookingConfirmed";
  readonly booking: ConfirmedBooking;
};
type ValidationError = { readonly tag: "NoTreatments" };
type PricingError = { readonly tag: "UnknownTreatment" };
type StoreError =
  | { readonly tag: "Unreachable"; readonly cause: unknown }
  | { readonly tag: "BadRow"; readonly cause: unknown };
type Catalogue = { readonly prices: ReadonlyMap<string, number> };
type Booking = { readonly id: string };
type Row = readonly (string | number | boolean | null)[];
type Pool = {
  query(text: string, values: Row): Promise<unknown>;
};

declare const validateBooking: (
  c: Catalogue,
) => (
  raw: UnvalidatedBooking,
) => Result<ValidatedBooking, NonEmptyArray<ValidationError>>;
declare const priceBooking: (
  c: Catalogue,
) => (v: ValidatedBooking) => Result<PricedBooking, PricingError>;
declare const issueConfirmation: (
  now: Instant,
) => (p: PricedBooking) => ConfirmedBooking;
declare const INSERT: string;
declare const toRow: (b: Booking) => Row;
declare const isPgError: (e: unknown) => e is { readonly code: string };
