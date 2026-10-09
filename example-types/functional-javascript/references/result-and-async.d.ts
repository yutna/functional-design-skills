// The shapes the Result helpers pass between them.
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Names the fences use without defining.
type RawBooking = { readonly slot?: string };
type ValidBooking = { readonly slot: string };
type PricedBooking = ValidBooking & { readonly total: number };
type FieldProblem = { readonly tag: string };
type Catalogue = { readonly fee: number };
type Customer = { readonly name: string };
type Row = readonly (string | number | boolean | null)[];
type Booking = { readonly id: string };

declare const catalogue: Catalogue;
declare function validate(raw: RawBooking): Result<ValidBooking, FieldProblem>;
declare function price(
  catalogue: Catalogue,
): (booking: ValidBooking) => Result<PricedBooking, FieldProblem>;
declare function acknowledge(booking: PricedBooking): PricedBooking;
declare function toEvents(booking: PricedBooking): readonly string[];
declare function priceWithService(
  booking: ValidBooking,
): Promise<Result<PricedBooking, FieldProblem>>;
declare function save(
  booking: PricedBooking,
): Promise<Result<PricedBooking, FieldProblem>>;
declare function parseName(raw: string): Result<string, FieldProblem>;
declare function parseEmail(raw: string): Result<string, FieldProblem>;
declare function parseAge(raw: number): Result<number, FieldProblem>;
declare const INSERT: string;
declare function toRow(booking: Booking): Row;
declare function loadCustomer(id: string): Promise<Result<Customer, FieldProblem>>;
declare function loadCatalogue(): Promise<Result<Catalogue, FieldProblem>>;
