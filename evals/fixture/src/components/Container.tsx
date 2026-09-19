export const Container = memo(function Container({ slotId, isOpen }: Props) {
  const onConfirm = useCallback(() => confirmSlot(slotId), [slotId])
  const onCancel = useCallback(() => cancelSlot(slotId), [slotId])
  return <SlotPanel open={isOpen} onConfirm={onConfirm} onCancel={onCancel} />
})
