// Names the fences use without defining. `booking` is a record here, where
// the first fence makes a constructor of the same name. The check puts a
// fence that redeclares a name from here in a block of its own, so the
// constructor stays out of the way of the fences after it.
type Treatment = { readonly id: string; readonly code: string };
declare const booking: {
  readonly treatments: readonly Treatment[];
  readonly customer: {
    readonly address: { readonly city: string };
  };
};
declare const treatment: Treatment;
declare const id: string;
declare const city: string;
declare function byCode(a: Treatment, b: Treatment): number;

// The class fence returns the Result helpers' shapes.
declare function ok<T>(value: T): { readonly ok: true; readonly value: T };
declare function err<E>(error: E): { readonly ok: false; readonly error: E };
