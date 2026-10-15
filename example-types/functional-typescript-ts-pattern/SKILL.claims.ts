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
type LaterQuote = Quote | { readonly tag: "Archived" };
const applyLater = (
  now: Instant,
  quote: LaterQuote,
  command: QuoteCommand,
): Result<Quote, TransitionError> =>
  match([quote, command] as const)
    .with([{ tag: "Draft" }, { tag: "Send" }], ([q]) => send(now, q))
    .with([{ tag: "Sent" }, { tag: "Accept" }], ([q, c]) =>
      accept(now, c.by, c.booking, q),
    )
    .with([{ tag: "Sent" }, { tag: "Expire" }], ([q]) => expire(now, q))
    .with([{ tag: P.union("Draft", "Sent") }, { tag: "Cancel" }], ([q, c]) =>
      cancel(now, c.by, c.reason, q),
    )
    .otherwise(() => err({ tag: "IllegalTransition" }));

// Matching on structure: "the more specific case goes first." With the general
// procedure arm first, the guarded arm below it can never match, and nothing
// in the compiler or in ts-pattern says so. That is why the sentence after the
// fence is needed.
const wrongOrder = (item: ScheduledTreatment) =>
  match(item)
    .with({ treatment: { tag: "Procedure" } }, () => "procedure room")
    .with(
      {
        treatment: { tag: "Procedure" },
        minutes: P.when((m) => m > THEATRE_MINUTES),
      },
      () => "theatre",
    )
    .with({ treatment: { tag: "Consultation" } }, () => "consulting room")
    .exhaustive();
