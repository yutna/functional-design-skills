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
type Patient = { readonly name: string };
type Row = readonly (string | number | boolean | null)[];
type Booking = { readonly id: string };

type ConfirmedBooking = PricedBooking & { readonly confirmed: true };
type PricingError = { readonly tag: string };

declare function validateBooking(
  catalogue: Catalogue,
): (raw: RawBooking) => Result<ValidBooking, readonly FieldProblem[]>;
declare function priceBooking(
  catalogue: Catalogue,
): (booking: ValidBooking) => Result<PricedBooking, PricingError>;
declare function issueConfirmation(
  now: Date,
): (booking: PricedBooking) => ConfirmedBooking;
type Pool = { readonly name: string };
declare function saveEvents(
  pool: Pool,
  events: readonly { readonly tag: string }[],
): Promise<Result<readonly { readonly tag: string }[], FieldProblem>>;
declare function parseName(raw: string): Result<string, FieldProblem>;
declare function parseEmail(raw: string): Result<string, FieldProblem>;
declare function parseAge(raw: number): Result<number, FieldProblem>;
declare const INSERT: string;
declare function seconds(n: number): number;
declare function toRow(booking: Booking): Row;
declare function loadPatient(
  pool: Pool,
  id: string,
): Promise<Result<Patient, FieldProblem>>;
declare function loadCatalogue(
  pool: Pool,
): Promise<Result<Catalogue, FieldProblem>>;
