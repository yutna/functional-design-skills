// Rule 1: "End a match over a union with `.exhaustive()`." A match over a
// union that leaves a case out does not compile.
const partial = (s: Shipment): number =>
  match(s)
    .with({ tag: "Pending" }, () => 1)
    // @ts-expect-error Shipped, Delivered and Failed are not handled
    .exhaustive();

// State transitions: "A state or a command added later is not reported here,
// because `.otherwise()` answers for it." The same table over a Quote with one
// more state compiles unchanged.
type LaterQuote = Quote | { readonly tag: "Expired" };
const applyLater = (
  quote: LaterQuote,
  command: QuoteCommand,
): Result<Quote, TransitionError> =>
  match([quote, command] as const)
    .with([{ tag: "Draft" }, { tag: "Send" }], ([q, c]) => send(q, c.at))
    .with([{ tag: "Sent" }, { tag: "Accept" }], ([q, c]) => accept(q, c.by))
    .with([{ tag: P.union("Draft", "Sent") }, { tag: "Cancel" }], ([q, c]) =>
      cancel(q, c.reason),
    )
    .otherwise(() => err({ tag: "IllegalTransition" }));

// Matching on structure: "the more specific case goes first." With the general
// procedure arm first, the guarded arm below it can never match, and nothing
// in the compiler or in ts-pattern says so. That is why the sentence after the
// fence is needed.
const wrongOrder = (booking: Booking) =>
  match(booking)
    .with({ lifecycle: { tag: "Cancelled" } }, () => "archive")
    .with({ treatment: { tag: "Procedure" } }, () => "procedure room")
    .with(
      { treatment: { tag: "Procedure" }, minutes: P.when((m) => m > 90) },
      () => "theatre",
    )
    .with({ treatment: { tag: "Consultation" } }, () => "consulting room")
    .exhaustive();
