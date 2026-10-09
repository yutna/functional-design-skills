import type { EmptyError, Result } from "../../_shared/result";
import { err, ok } from "../../_shared/result";

// Names the fences use without defining.
type TrackingNumber = string & { readonly tag: "TrackingNumber" };
type FailureReason = "Lost" | "Refused";
type DeliverError = { readonly tag: "NotShipped" };
type ParseError = { readonly tag: "UnknownCurrency"; readonly raw: unknown };
