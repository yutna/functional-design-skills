import { useState } from "react";
import type { JSX } from "react";
import type { Brand, NonEmptyArray } from "../_shared/result";
import { assertNever, nonEmpty } from "../_shared/result";

// Names the fences use without defining.
type BookingId = Brand<string, "BookingId">;
type Booking = {
  readonly id: BookingId;
  readonly reference: string;
  readonly total: number;
};
type FetchError =
  | { readonly tag: "Offline" }
  | { readonly tag: "Server"; readonly status: number };
type Item = { readonly price: number };

declare const Spinner: () => JSX.Element;
declare const ErrorPanel: (props: { readonly error: FetchError }) => JSX.Element;
declare const BookingTable: (props: {
  readonly bookings: readonly Booking[];
}) => JSX.Element;
declare const EmptyState: () => JSX.Element;
