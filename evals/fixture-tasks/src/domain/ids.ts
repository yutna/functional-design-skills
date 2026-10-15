import { err, ok, type Result } from '../result'

declare const brand: unique symbol
type Brand<T, B extends string> = T & { readonly [brand]: B }

export type PatientId = Brand<string, 'PatientId'>
export type ClinicianId = Brand<string, 'ClinicianId'>
export type BookingId = Brand<string, 'BookingId'>

export type IdError = {
  readonly tag: 'InvalidId'
  readonly kind: string
  readonly raw: string
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const parser =
  <B extends string>(kind: B) =>
  (raw: unknown): Result<Brand<string, B>, IdError> =>
    typeof raw === 'string' && UUID.test(raw)
      ? ok(raw as Brand<string, B>)
      : err({ tag: 'InvalidId', kind, raw: String(raw) })

export const parsePatientId = parser('PatientId')
export const parseClinicianId = parser('ClinicianId')
export const parseBookingId = parser('BookingId')
