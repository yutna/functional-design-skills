import { db } from './db'
import { mailer } from './mailer'

export async function processRefund(bookingId: string, requested: number) {
  const booking = await db.loadBooking(bookingId)
  if (booking === undefined) throw new Error('no such booking')
  const days = (Date.now() - booking.paidAt.getTime()) / 86_400_000
  if (days > 60) {
    await mailer.send(
      booking.email,
      'Refund refused: the payment is over 60 days old',
    )
    return { refunded: 0 }
  }
  const amount = Math.min(requested, booking.totalSatang)
  await db.insertRefund(bookingId, amount)
  await mailer.send(booking.email, `Refunded ${amount / 100} baht`)
  return { refunded: amount }
}
