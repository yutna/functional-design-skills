import { useActionState, useOptimistic } from "react";
import type { JSX } from "react";
import { cacheTag, revalidateTag } from "next/cache";
import type { Brand, Result } from "../../_shared/result";
import { err, ok } from "../../_shared/result";

// Names the fences use without defining.
type PatientId = Brand<string, "PatientId">;
type SlotId = Brand<string, "SlotId">;
type TreatmentCode = Brand<string, "TreatmentCode">;
type BookingRef = Brand<string, "BookingRef">;
type FieldError = { readonly field: string; readonly problem: string };
type BookingRequest = {
  readonly slot: SlotId;
  readonly treatment: TreatmentCode;
};
type ConfirmBookingError =
  | { readonly tag: "SlotTaken" }
  | { readonly tag: "NotYours" };
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
declare const deps: { readonly now: () => Date };
declare const confirmBooking: (
  d: typeof deps,
) => (
  patient: PatientId,
  request: BookingRequest,
) => Promise<
  Result<{ readonly reference: BookingRef }, ConfirmBookingError>
>;
declare const bookingStore: {
  readonly forPatient: (patient: PatientId) => Promise<readonly Booking[]>;
};
declare const toListItem: (b: Booking) => BookingListItem;
declare const BookingList: (props: {
  readonly bookings: readonly BookingListItem[];
}) => JSX.Element;
declare const bookings: readonly Booking[];
