export type PaidBooking = {
  readonly id: string
  readonly email: string
  readonly totalSatang: number
  readonly paidAt: Date
}

export const db = {
  async loadBooking(id: string): Promise<PaidBooking | undefined> {
    throw new Error(`needs a database to load ${id}`)
  },
  async insertRefund(bookingId: string, satang: number): Promise<void> {
    throw new Error(`needs a database to refund ${satang} on ${bookingId}`)
  },
}
