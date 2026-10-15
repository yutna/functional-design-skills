import type { Booking } from '../domain/booking'
import type { BookingId, ClinicianId } from '../domain/ids'

const bookings = new Map<BookingId, Booking>()

export const saveBooking = async (booking: Booking): Promise<void> => {
  bookings.set(booking.id, booking)
}

export const bookingsFor = async (
  clinician: ClinicianId,
): Promise<readonly Booking[]> =>
  [...bookings.values()].filter((booking) => booking.clinician === clinician)
