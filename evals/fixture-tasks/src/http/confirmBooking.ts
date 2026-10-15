import { confirm } from '../domain/booking'
import { parseBookingId } from '../domain/ids'
import { transaction } from '../store/tx'
import { HttpError, type Handler } from './server'

export const confirmBooking: Handler = async (request) => {
  const id = parseBookingId(request.params['id'])
  if (!id.ok) throw new HttpError(400, 'invalid booking id', id.error)

  const confirmed = await transaction(async (tx) => {
    const booking = await tx.loadBooking(id.value)
    if (booking === undefined) throw new HttpError(404, 'no such booking')
    if (booking.tag !== 'Requested') {
      throw new HttpError(409, 'booking is already confirmed')
    }
    const next = confirm(booking, new Date())
    await tx.saveBooking(next)
    return next
  })

  return { status: 200, body: confirmed }
}
