import type { BookingId, ClinicianId, PatientId } from './ids'

export type Slot = { readonly start: Date; readonly minutes: number }

export type BookingCore = {
  readonly id: BookingId
  readonly patient: PatientId
  readonly clinician: ClinicianId
  readonly slot: Slot
}

export type Requested = BookingCore & { readonly tag: 'Requested' }

export type Confirmed = BookingCore & {
  readonly tag: 'Confirmed'
  readonly confirmedAt: Date
}

export type Booking = Requested | Confirmed

export const request = (core: BookingCore): Requested => ({
  ...core,
  tag: 'Requested',
})

export const confirm = (booking: Requested, now: Date): Confirmed => ({
  ...booking,
  tag: 'Confirmed',
  confirmedAt: now,
})

export const endOf = (slot: Slot): Date =>
  new Date(slot.start.getTime() + slot.minutes * 60_000)

export const overlaps = (a: Slot, b: Slot): boolean =>
  a.start < endOf(b) && b.start < endOf(a)
