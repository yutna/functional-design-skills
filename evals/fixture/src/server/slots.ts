'use server'

import { confirm } from './confirm'
import { release } from './store'

export async function confirmSlot(slotId: string): Promise<void> {
  await confirm(slotId)
}

export async function cancelSlot(slotId: string): Promise<void> {
  await release(slotId)
}
