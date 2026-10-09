// "It reports a missing case only when the `default` branch hands the value to
// a parameter typed `never`, as `unhandled` does; a `default` that simply
// throws satisfies the checker whatever is missing." The JSDoc fence sits in a
// block of its own, so the claim restates its types with a third case added.

/**
 * @typedef {{ tag: "Pending", requestedAt: Date }} PendingCase
 * @typedef {{ tag: "Shipped", tracking: string, shippedAt: Date }} ShippedCase
 * @typedef {{ tag: "Delivered", deliveredAt: Date }} DeliveredCase
 * @typedef {PendingCase | ShippedCase | DeliveredCase} WiderShipment
 */

/**
 * @param {never} s
 * @returns {never}
 */
const missing = (s) => {
  throw new Error(`unhandled shipment: ${JSON.stringify(s)}`);
};

/**
 * @param {WiderShipment} s
 * @returns {string}
 */
const describeWithNever = (s) => {
  switch (s.tag) {
    case SHIPMENT.pending:
      return "awaiting dispatch";
    case SHIPMENT.shipped:
      return `in transit: ${s.tracking}`;
    default:
      // @ts-expect-error Delivered is not handled above
      return missing(s);
  }
};

/**
 * @param {WiderShipment} s
 * @returns {string}
 */
const describeWithThrow = (s) => {
  switch (s.tag) {
    case SHIPMENT.pending:
      return "awaiting dispatch";
    case SHIPMENT.shipped:
      return `in transit: ${s.tracking}`;
    default:
      throw new Error(`unhandled shipment tag: ${s.tag}`);
  }
};
