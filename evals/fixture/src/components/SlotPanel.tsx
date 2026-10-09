import { memo } from 'react'

type Props = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const SlotPanel = memo(function SlotPanel(props: Props) {
  if (!props.open) return null
  return (
    <div>
      <button onClick={props.onConfirm}>Confirm</button>
      <button onClick={props.onCancel}>Cancel</button>
    </div>
  )
})
