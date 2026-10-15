// Older module. It predates src/domain and keeps its own style.

export type Admission = {
  id: string
  ward: string
  admittedAt: string
  dischargedAt?: string
}

const day = (iso: string | undefined) =>
  new Date(iso as string).toLocaleDateString('en-GB')

export function formatAdmissionDate(a: Admission): string {
  return `${day(a.admittedAt)} to ${day(a.dischargedAt)}`
}

export function formatWardStay(a: Admission): string {
  return `${a.ward}: ${day(a.admittedAt)} to ${day(a.dischargedAt)}`
}

export function formatDischargeNotice(a: Admission): string {
  return `Discharged from ${a.ward} on ${day(a.dischargedAt)}`
}

export function formatBillingPeriod(a: Admission): string {
  return `Billed from ${day(a.admittedAt)} until ${day(a.dischargedAt)}`
}
