export function totalsByCustomerMonth(rows: Row[]) {
  const out: Record<string, Record<string, number>> = {}
  let seen = 0
  let skipped = 0
  let lastCustomer = ''
  for (const customer of customers) {
    for (const month of months) {
      for (const row of rows) {
        if (row.customerId !== customer) continue
        if (row.month !== month) continue
        out[customer] ??= {}
        out[customer][month] = (out[customer][month] ?? 0) + row.amount
        seen += 1
        lastCustomer = customer
      }
    }
  }
  return out
}
