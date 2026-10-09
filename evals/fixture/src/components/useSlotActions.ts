import { useMemo } from 'react'
import { cancelSlot, confirmSlot } from '../server/slots'

export function useSlotActions(slotId: string) {
  return useMemo(
    () => ({
      confirm: () => confirmSlot(slotId),
      cancel: () => cancelSlot(slotId),
    }),
    [slotId],
  )
}
