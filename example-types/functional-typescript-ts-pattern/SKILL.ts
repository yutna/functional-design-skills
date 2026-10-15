import type { Brand, NonEmptyArray, Result } from "../_shared/result";
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

type ScheduledTreatment = {
  readonly treatment:
    | { readonly tag: "Consultation" }
    | { readonly tag: "Procedure" };
  readonly minutes: number;
};
declare const THEATRE_MINUTES: number;

type PatientId = Brand<string, "PatientId">;
type BookingId = Brand<string, "BookingId">;
type Instant = Brand<string, "Instant">;
type Quote =
  | { readonly tag: "Draft" }
  | { readonly tag: "Sent"; readonly sentAt: Instant }
  | {
      readonly tag: "Accepted";
      readonly by: PatientId;
      readonly booking: BookingId;
    }
  | { readonly tag: "Cancelled"; readonly reason: string }
  | { readonly tag: "Expired"; readonly expiredAt: Instant };
type QuoteCommand =
  | { readonly tag: "Send" }
  | {
      readonly tag: "Accept";
      readonly by: PatientId;
      readonly booking: BookingId;
    }
  | { readonly tag: "Expire" }
  | {
      readonly tag: "Cancel";
      readonly by: PatientId;
      readonly reason: string;
    };
type TransitionError =
  | { readonly tag: "IllegalTransition" }
  | { readonly tag: "PastExpiry" }
  | { readonly tag: "NotYetDue" }
  | { readonly tag: "NotAuthorised" };
declare const send: (
  now: Instant,
  q: Extract<Quote, { tag: "Draft" }>,
) => Result<Quote, TransitionError>;
declare const accept: (
  now: Instant,
  by: PatientId,
  booking: BookingId,
  q: Extract<Quote, { tag: "Sent" }>,
) => Result<Quote, TransitionError>;
declare const expire: (
  now: Instant,
  q: Extract<Quote, { tag: "Sent" }>,
) => Result<Quote, TransitionError>;
declare const cancel: (
  now: Instant,
  by: PatientId,
  reason: string,
  q: Extract<Quote, { tag: "Draft" | "Sent" }>,
) => Result<Quote, TransitionError>;

type ValidationError = { readonly field: string };
type PricingError = { readonly tag: "NoPrice" };
type StoreError = { readonly tag: "Unreachable" };
type ConfirmBookingError =
  | {
      readonly tag: "Validation";
      readonly cause: NonEmptyArray<ValidationError>;
    }
  | { readonly tag: "Pricing"; readonly cause: PricingError };
type ConfirmBookingFailure =
  | { readonly tag: "Rejected"; readonly cause: ConfirmBookingError }
  | { readonly tag: "Unavailable"; readonly cause: StoreError };
type ConfirmBookingEvent = {
  readonly tag: "BookingConfirmed";
  readonly total: number;
};
type View = { readonly status: number };
declare const renderEvents: (events: readonly ConfirmBookingEvent[]) => View;
declare const renderFieldErrors: (e: NonEmptyArray<ValidationError>) => View;
declare const unprocessable: () => View;
declare const serverError: () => View;
