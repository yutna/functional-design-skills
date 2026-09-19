export function BookingPage({ slot }: { slot: Slot }) {
  const stale = Date.now() - slot.createdAt > 2 * 60 * 60 * 1000
  return <button disabled={stale} onClick={() => confirm(slot.id)}>Confirm</button>
}
