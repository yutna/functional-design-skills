// Wildcards table: `P.any` is "Anything, same as `P._`". They are one pattern
// type, and a handler behind either receives the input type.
const sameWildcard: typeof P.any = P._;
const behindAny = (s: Shipment) =>
  match(s).with(P.any, (v) => {
    // @ts-expect-error v is a Shipment, not any
    return v.nope;
  });

// Guards: "a match made only of guarded patterns cannot be proven exhaustive,
// and will need `.otherwise()`."
const guardedOnly = (flag: boolean): string =>
  match(flag)
    .with(P.when((b) => b), () => "yes")
    .with(P.when((b) => !b), () => "no")
    // @ts-expect-error guards do not narrow, so nothing is proven covered
    .exhaustive();

// Typing the result: "a handler returning the wrong type is an error at that
// handler."
const typed = (s: Shipment) =>
  match(s)
    .returnType<string>()
    // @ts-expect-error a number is not a string
    .with({ tag: "Pending" }, () => 1);
