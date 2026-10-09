import type { Brand, Result } from "../_shared/result";

// Names the fence uses without defining.
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

type FormState =
  | { tag: "Idle" }
  | { tag: "SignedOut" }
  | { tag: "Invalid"; errors: readonly FieldError[] }
  | { tag: "Rejected"; reason: ConfirmBookingError }
  | { tag: "Confirmed"; reference: BookingRef };

declare const currentSession: () => Promise<
  { readonly patient: PatientId } | undefined
>;
declare const parseBookingForm: (
  form: FormData,
) => Result<BookingRequest, readonly FieldError[]>;
declare const deps: { readonly now: () => Date };
declare const runConfirmBooking: (
  d: typeof deps,
) => (
  patient: PatientId,
  request: BookingRequest,
) => Promise<
  Result<{ readonly reference: BookingRef }, ConfirmBookingError>
>;
