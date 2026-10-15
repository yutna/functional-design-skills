import { recalculatePricing, type Visit } from './pricing'

export function receiptLine(visit: Visit): string {
  recalculatePricing(visit)
  return `Visit ${visit.id}: ${(visit.price ?? 0) / 100} baht`
}
