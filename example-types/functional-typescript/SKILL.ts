import * as z from "zod";
import type { NonEmptyArray } from "../_shared/result";

// `Brand` is the one the first fence defines, so a card number here is the
// branded string the pack teaches.

// payment.ts names a card number, a bank code and a masking function.
type CardNumber = Brand<string, "CardNumber">;
type BankCode = Brand<string, "BankCode">;
declare const maskCard: (n: CardNumber) => string;

// toBooking names a booking, its parts and its mapping error.
type BookingId = Brand<string, "BookingId">;
type BookedTreatment = { readonly code: string };
type Lifecycle =
  | { readonly tag: "Held" }
  | { readonly tag: "Confirmed" }
  | { readonly tag: "Cancelled" };
type Booking = {
  readonly id: BookingId;
  readonly treatments: NonEmptyArray<BookedTreatment>;
  readonly lifecycle: Lifecycle;
};
type MapError = { readonly tag: "NoTreatments" };
declare const BookedTreatmentDto: z.ZodObject<{ code: z.ZodString }>;
