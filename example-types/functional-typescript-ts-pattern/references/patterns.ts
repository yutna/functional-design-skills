import { match, P } from "ts-pattern";
import type { Brand } from "../../_shared/result";

// functional-typescript's Shipment (references/unions-and-exhaustiveness.md).
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

// The fences are a catalogue. `quote` is matched on its states, and
// `booking` has every field the other patterns read.
type PatientId = Brand<string, "PatientId">;
type BookedTreatment = {
  readonly treatment:
    | { readonly tag: "Consultation" }
    | { readonly tag: "Procedure" };
  readonly minutes: number;
};
type Booking = {
  readonly lifecycle:
    | { readonly tag: "Held" }
    | { readonly tag: "Confirmed" }
    | { readonly tag: "Cancelled" };
  readonly treatments: readonly BookedTreatment[];
  readonly note?: string;
  readonly total: number;
  readonly confirmedAt: Date;
};
type Quote =
  | { readonly tag: "Draft" }
  | { readonly tag: "Sent"; readonly sentAt: Date }
  | { readonly tag: "Accepted"; readonly by: PatientId }
  | { readonly tag: "Cancelled"; readonly reason: string };
type QuoteCommand =
  | { readonly tag: "Send"; readonly at: Date }
  | { readonly tag: "Accept"; readonly by: PatientId }
  | { readonly tag: "Cancel"; readonly reason: string };

declare const shipment: Shipment;
declare const booking: Booking;
declare const quote: Quote;
declare const command: QuoteCommand;
declare const format: (d: Date) => string;
declare const LARGE_BOOKING: number;
declare const isAfterCutoff: (at: Date) => boolean;
// An arm's function that takes nothing and returns nothing, which every
// arm position accepts.
declare const arm: () => void;
