export type Row = { customerId: string; month: string; amount: number }

export function totalsByCustomerMonth(
  rows: Row[],
  customers: string[],
  months: string[],
) {
  const out: Record<string, Record<string, number>> = {}
  let seen = 0
  let skipped = 0
  let lastCustomer = ''
  for (const customer of customers) {
    for (const month of months) {
      for (const row of rows) {
        if (row.customerId !== customer || row.month !== month) {
          skipped += 1
          continue
        }
        out[customer] ??= {}
        out[customer][month] = (out[customer][month] ?? 0) + row.amount
        seen += 1
        lastCustomer = customer
      }
    }
  }
  console.log(`${seen} rows counted, ${skipped} skipped, last ${lastCustomer}`)
  return out
}
