import type { Booking } from '../domain/booking'
import type { BookingId } from '../domain/ids'

export type Tx = {
  readonly loadBooking: (id: BookingId) => Promise<Booking | undefined>
  readonly saveBooking: (booking: Booking) => Promise<void>
}

const bookings = new Map<BookingId, Booking>()

// Runs `work` in one database transaction: what it wrote is committed
// together when it resolves, and none of it is when it rejects.
export const transaction = async <T>(
  work: (tx: Tx) => Promise<T>,
): Promise<T> => {
  const staged = new Map(bookings)
  const result = await work({
    loadBooking: async (id) => staged.get(id),
    saveBooking: async (booking) => {
      staged.set(booking.id, booking)
    },
  })
  for (const [id, booking] of staged) bookings.set(id, booking)
  return result
}
