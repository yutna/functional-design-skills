import type { Brand, Result } from "../_shared/result";
import { err } from "../_shared/result";

// functional-typescript's Shipment (references/unions-and-exhaustiveness.md),
// which the first fence matches over.
type TrackingNumber = Brand<string, "TrackingNumber">;
type FailureReason = "Lost" | "Damaged" | "Refused";
type Shipment =
  | { readonly tag: "Pending"; readonly requestedAt: Date }
  | {
      readonly tag: "Shipped";
      readonly tracking: TrackingNumber;
      readonly shippedAt: Date;
    }
  | {
      readonly tag: "Delivered";
      readonly tracking: TrackingNumber;
      readonly shippedAt: Date;
      readonly deliveredAt: Date;
    }
  | { readonly tag: "Failed"; readonly reason: FailureReason };

declare const format: (d: Date) => string;

type Booking = {
  readonly lifecycle:
    | { readonly tag: "Cancelled" }
    | { readonly tag: "Held" }
    | { readonly tag: "Confirmed" };
  readonly treatment:
    | { readonly tag: "Consultation" }
    | { readonly tag: "Procedure" };
  readonly minutes: number;
};

type PatientId = Brand<string, "PatientId">;
type Quote =
  | { readonly tag: "Draft" }
  | { readonly tag: "Sent"; readonly sentAt: Date }
  | { readonly tag: "Accepted"; readonly by: PatientId }
  | { readonly tag: "Cancelled"; readonly reason: string };
type QuoteCommand =
  | { readonly tag: "Send"; readonly at: Date }
  | { readonly tag: "Accept"; readonly by: PatientId }
  | { readonly tag: "Cancel"; readonly reason: string };
type TransitionError =
  | { readonly tag: "IllegalTransition" }
  | { readonly tag: "SentInThePast" };
declare const send: (
  q: Extract<Quote, { tag: "Draft" }>,
  at: Date,
) => Result<Quote, TransitionError>;
declare const accept: (
  q: Extract<Quote, { tag: "Sent" }>,
  by: PatientId,
) => Result<Quote, TransitionError>;
declare const cancel: (
  q: Extract<Quote, { tag: "Draft" | "Sent" }>,
  reason: string,
) => Result<Quote, TransitionError>;

type ValidationError = { readonly field: string };
type PricingError = { readonly tag: "NoPrice" };
type SaveError = { readonly tag: "Duplicate" };
type ConfirmBookingError =
  | { readonly tag: "Validation"; readonly cause: ValidationError }
  | { readonly tag: "Pricing"; readonly cause: PricingError }
  | { readonly tag: "Storage"; readonly cause: SaveError };
type PricedBooking = { readonly total: number };
type View = { readonly status: number };
declare const renderBooking: (b: PricedBooking) => View;
declare const renderFieldErrors: (e: ValidationError) => View;
declare const unprocessable: () => View;
declare const serverError: () => View;
