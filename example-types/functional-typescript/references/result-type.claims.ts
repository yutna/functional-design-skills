import type * as Shared from "../../_shared/result";

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
const sharedMapError: Equal<typeof Shared.mapError, typeof mapError> = true;
const sharedPipe: Equal<typeof Shared.pipe, typeof pipe> = true;
const sharedAsync: Equal<Shared.AsyncResult<string, number>, AsyncResult<string, number>> = true;

// "Its error type is inferred as `ValidationError | PricingError`, because
// `bind` widens as it goes."
const inferredError: Equal<
  ReturnType<typeof confirmBooking>,
  Result<readonly BookingEvent[], ValidationError | PricingError>
> = true;
