import type { Slot } from '../domain/slot'

const slots = new Map<string, Slot>()

export async function load(slotId: string): Promise<Slot> {
  const slot = slots.get(slotId)
  if (slot === undefined) throw new Error(`no slot ${slotId}`)
  return slot
}

export async function book(slot: Slot): Promise<{ reference: string }> {
  slots.delete(slot.id)
  return { reference: `booking-${slot.id}` }
}

export async function release(slotId: string): Promise<void> {
  slots.delete(slotId)
}
