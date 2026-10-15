import { useActionState, useOptimistic } from "react";
import type { JSX } from "react";
import { cacheTag, revalidateTag } from "next/cache";
import type { Brand, NonEmptyArray, Result } from "../../_shared/result";
import { err, ok } from "../../_shared/result";

// Names the fences use without defining.
type PatientId = Brand<string, "PatientId">;
type SlotId = Brand<string, "SlotId">;
type TreatmentCode = Brand<string, "TreatmentCode">;
type BookingRef = Brand<string, "BookingRef">;
type FieldError = { readonly field: string; readonly problem: string };
type BookingForm = {
  readonly slot: SlotId;
  readonly treatment: TreatmentCode;
};
type ValidationError =
  | { readonly tag: "NotYours" }
  | { readonly tag: "UnknownTreatment" };
type PricingError = { readonly tag: "NoPrice" };
type ConfirmBookingError =
  | {
      readonly tag: "Validation";
      readonly errors: NonEmptyArray<ValidationError>;
    }
  | { readonly tag: "Pricing"; readonly cause: PricingError };
type UnvalidatedBooking = BookingForm & {
  readonly patient: PatientId;
  readonly requestedBy: PatientId;
};
type ConfirmBookingEvent = {
  readonly tag: "BookingConfirmed";
  readonly reference: BookingRef;
};
type Catalogue = { readonly prices: ReadonlyMap<TreatmentCode, number> };
type StoreError = { readonly tag: "Unreachable" };
type Booking = { readonly reference: BookingRef };
type BookingListItem = { readonly reference: string };

declare const currentSession: () => Promise<
  { readonly patient: PatientId } | undefined
>;
declare const signedInPatient: () => Promise<PatientId>;
declare const parseSlotId: (
  raw: FormDataEntryValue | null,
) => Result<SlotId, string>;
declare const parseTreatmentCode: (
  raw: FormDataEntryValue | null,
) => Result<TreatmentCode, string>;
declare const loadCatalogue: () => Promise<Result<Catalogue, StoreError>>;
declare const confirmBooking: (
  catalogue: Catalogue,
  now: Date,
  unvalidated: UnvalidatedBooking,
) => Result<readonly ConfirmBookingEvent[], ConfirmBookingError>;
declare const saveEvents: (
  events: readonly ConfirmBookingEvent[],
) => Promise<Result<readonly ConfirmBookingEvent[], StoreError>>;
type Refusal = { readonly problems: readonly string[] };
declare const toRefusal: (error: ConfirmBookingError) => Refusal;
declare const confirmedReference: (
  events: readonly ConfirmBookingEvent[],
) => BookingRef;
declare const bookingStore: {
  readonly forPatient: (patient: PatientId) => Promise<readonly Booking[]>;
};
declare const toListItem: (b: Booking) => BookingListItem;
declare const BookingList: (props: {
  readonly bookings: readonly BookingListItem[];
}) => JSX.Element;
declare const bookings: readonly BookingListItem[];
