export type Visit = {
  id: string
  treatments: { code: string; satang: number }[]
  insured: boolean
  isPriced: boolean
  price?: number
  priceCalculatedAt?: Date
}

export function recalculatePricing(visit: Visit): void {
  if (visit.isPriced) return
  const total = visit.treatments.reduce((sum, t) => sum + t.satang, 0)
  visit.price = visit.insured ? Math.round(total * 0.2) : total
  visit.priceCalculatedAt = new Date()
  visit.isPriced = true
}
