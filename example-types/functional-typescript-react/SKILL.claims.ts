// "`Loaded` holds a `NonEmptyArray`, so it cannot be empty."
// @ts-expect-error an empty list is not a NonEmptyArray
const emptyLoaded: ScreenState = { tag: "Loaded", bookings: [] };

declare const fetched: readonly Booking[];
// @ts-expect-error a plain list is not a NonEmptyArray either
const plainLoaded: ScreenState = { tag: "Loaded", bookings: fetched };

// "A compile error when a fifth is added."
type FiveStates = ScreenState | { tag: "Refreshing" };
const viewFive = (s: FiveStates) => {
  switch (s.tag) {
    case "Loading":
      return <Spinner />;
    case "Failed":
      return <ErrorPanel error={s.error} />;
    case "Loaded":
      return <BookingTable bookings={s.bookings} />;
    case "Empty":
      return <EmptyState />;
    default:
      // @ts-expect-error the fifth state is not handled above
      return assertNever(s);
  }
};
