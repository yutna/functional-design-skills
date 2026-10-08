import { memo, useCallback } from 'react'
import { SlotPanel } from './SlotPanel'
import { useSlotActions } from './useSlotActions'

type Props = { slotId: string; isOpen: boolean }

export const Container = memo(function Container({ slotId, isOpen }: Props) {
  const { confirm, cancel } = useSlotActions(slotId)
  const onConfirm = useCallback(() => confirm(), [confirm])
  const onCancel = useCallback(() => cancel(), [cancel])
  return <SlotPanel open={isOpen} onConfirm={onConfirm} onCancel={onCancel} />
})
