import type { Brand, NonEmptyArray, Result } from "../_shared/result";

// Names the fence uses without defining.
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

type FormState =
  | { tag: "Idle" }
  | { tag: "SignedOut" }
  | { tag: "Invalid"; errors: readonly FieldError[] }
  | { tag: "Rejected"; refusal: Refusal }
  | { tag: "Unavailable" }
  | { tag: "Confirmed"; reference: BookingRef };

declare const currentSession: () => Promise<
  { readonly patient: PatientId } | undefined
>;
declare const parseBookingForm: (
  form: FormData,
) => Result<BookingForm, readonly FieldError[]>;
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
