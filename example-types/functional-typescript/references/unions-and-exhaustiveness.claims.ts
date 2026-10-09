import type * as Shared from "../../_shared/result";

// True only when X and Y are the same type.
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// The shared copy of what this file defines says what the fences say, so the
// packs that import it are checked against the real thing.
const sharedNonEmpty: Equal<NonEmptyArray<string>, Shared.NonEmptyArray<string>> = true;
const sharedNonEmptyOf: Equal<typeof Shared.nonEmpty, typeof nonEmpty> = true;
const sharedAssertNever: Equal<typeof Shared.assertNever, typeof assertNever> = true;

// "Adding a fifth case makes `assertNever(s)` a compile error here."
type WiderShipment = Shipment | { readonly tag: "Returned" };
const describeWider = (s: WiderShipment): string => {
  switch (s.tag) {
    case "Pending":
      return "awaiting dispatch";
    case "Shipped":
      return `in transit: ${s.tracking}`;
    case "Delivered":
      return `delivered ${s.deliveredAt.toISOString()}`;
    case "Failed":
      return `failed: ${s.reason}`;
    default:
      // @ts-expect-error the Returned case is not handled above
      return assertNever(s);
  }
};

// "`Record<Shipment["tag"], string>` requires every key."
// @ts-expect-error Delivered is missing
const missingKey: Record<Shipment["tag"], string> = {
  Pending: "Awaiting",
  Shipped: "In transit",
  Failed: "Failed",
};

// "Transition functions take the specific case, not the union, so an illegal
// transition does not compile."
declare const pendingShipment: Extract<Shipment, { tag: "Pending" }>;
// @ts-expect-error a Pending shipment has not shipped, so it cannot be delivered
deliver(pendingShipment, new Date());

// "`head` is total, with no `!` and no `undefined` in its type."
const headIsTotal: Equal<ReturnType<typeof head<string>>, string> = true;
