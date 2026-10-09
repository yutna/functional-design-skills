import { useMemo, useState } from "react";
import type { Dispatch, JSX, SetStateAction } from "react";
import type { Brand } from "../../_shared/result";

// Names the fences use without defining.
type Item = {
  readonly name: string;
  readonly price: number;
  readonly at: Date;
};
declare const items: readonly Item[];
declare const search: (xs: readonly Item[], query: string) => readonly Item[];
declare const setItems: Dispatch<SetStateAction<readonly Item[]>>;
declare const item: Item;
declare const byDate: (a: Item, b: Item) => number;

type BookingStatus = "held" | "confirmed" | "cancelled";
type Booking = {
  readonly total: number;
  readonly status: BookingStatus;
};
declare const setBooking: Dispatch<SetStateAction<Booking>>;
declare const status: BookingStatus;
declare const booking: Booking;

type Customer = { readonly isVerified: boolean };
declare const customer: Customer;
type CheckoutDecision =
  | { readonly tag: "Allowed" }
  | { readonly tag: "NeedsVerification" };
declare const decideCheckout: (
  customer: Customer,
  booking: Booking,
) => CheckoutDecision;
// The rules fence dispatches `Submitted` with a `decision`; the reducers
// fence's `Event` has `Submitted` without one. They compile only as two
// different reducers, so `dispatch` here is typed for the one it names.
type CheckoutEvent = {
  readonly tag: "Submitted";
  readonly decision: CheckoutDecision;
};
declare const dispatch: (event: CheckoutEvent) => void;

type Draft = { readonly treatment: string; readonly slot: string };
type FieldError = { readonly field: string; readonly problem: string };
type FieldName = "treatment" | "slot";
type BookingRef = Brand<string, "BookingRef">;

type Row = { readonly id: string };
type Column = { readonly key: string };
type SortKey = "date" | "patient";
type SortDir = "asc" | "desc";
type BookingTableProps =
  | {
      readonly rows: readonly Row[];
      readonly columns: readonly Column[];
      readonly sortKey: SortKey;
      readonly sortDir: SortDir;
      readonly onSort: (key: SortKey) => void;
      readonly page: number;
      readonly pageSize: number;
      readonly onPage: (page: number) => void;
      readonly isLoading: boolean;
      readonly error: string | null;
      readonly emptyText: string;
    }
  | {
      readonly bookings: readonly Booking[];
      readonly onSelect: (booking: Booking) => void;
    };
declare const BookingTable: (props: BookingTableProps) => JSX.Element;
declare const rows: readonly Row[];
declare const columns: readonly Column[];
declare const sortKey: SortKey;
declare const sortDir: SortDir;
declare const onSort: (key: SortKey) => void;
declare const page: number;
declare const pageSize: number;
declare const onPage: (page: number) => void;
declare const isLoading: boolean;
declare const error: string | null;
declare const emptyText: string;
declare const bookings: readonly Booking[];
declare const onSelect: (booking: Booking) => void;
