import type * as Shared from "../_shared/result";

// True only when X and Y are the same type.
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

// The shared copy of what this file defines says what the fences say, so the
// packs that import it are checked against the real thing.
const sharedResult: Equal<Shared.Result<string, number>, Result<string, number>> = true;
const sharedOk: Equal<typeof Shared.ok, typeof ok> = true;
const sharedErr: Equal<typeof Shared.err, typeof err> = true;
const sharedMap: Equal<typeof Shared.map, typeof map> = true;
const sharedBind: Equal<typeof Shared.bind, typeof bind> = true;

// "Brand every domain primitive": a bare number is not a Satang.
// @ts-expect-error a plain number cannot stand where a Satang is wanted
const notSatang: Satang = 5;

// "Adding a case to Payment makes assertNever a compile error at every site
// that must be updated."
type WiderPayment = Payment | { readonly tag: "Voucher" };
const describeWider = (p: WiderPayment): string => {
  switch (p.tag) {
    case "Cash":
      return "cash";
    case "Card":
      return maskCard(p.number);
    case "Transfer":
      return p.bank;
    default:
      // @ts-expect-error the Voucher case is not handled above
      return assertNever(p);
  }
};

// "`min(1)` is a case in point: the schema checks it and the inferred type is
// still a plain array."
declare const inferred: z.infer<typeof BookingDto>;
// @ts-expect-error a plain array is not a NonEmptyArray
const narrowed: NonEmptyArray<{ readonly code: string }> = inferred.treatments;
