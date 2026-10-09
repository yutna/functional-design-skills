import * as v from "valibot";
import * as z from "zod";
import type {
  AsyncResult,
  Brand,
  NonEmptyArray,
  Result,
} from "../../_shared/result";
import { err, ok } from "../../_shared/result";

// The schema SKILL.md defines, which the fences after it parse with.
declare const BookedTreatmentDto: z.ZodObject<{ code: z.ZodString }>;
declare const BookingDto: z.ZodObject<{
  id: z.ZodUUID;
  treatments: z.ZodArray<typeof BookedTreatmentDto>;
  status: z.ZodEnum<{
    held: "held";
    confirmed: "confirmed";
    cancelled: "cancelled";
  }>;
}>;

// Domain names the fences use without defining.
type BookingId = Brand<string, "BookingId">;
type BookedTreatment = { readonly code: string };
type Lifecycle =
  | { readonly tag: "Held" }
  | { readonly tag: "Confirmed" }
  | { readonly tag: "Cancelled" };
type MapError = { readonly tag: "NoTreatments" };
