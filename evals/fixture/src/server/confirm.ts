'use server'
export async function confirm(slotId: string) {
  const slot = await load(slotId)
  if (Date.now() - slot.createdAt > 2 * 60 * 60 * 1000) throw new Error('stale slot')
  return book(slot)
}
