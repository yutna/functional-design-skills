import { useActionState } from "react";

// "The `(prevState, formData)` signature is what `useActionState` calls, so
// the client reads `useActionState(confirmBookingAction, { tag: "Idle" })` and gets
// the state, the form action, and a pending flag together."
const [state, formAction, isPending] = useActionState(confirmBookingAction, {
  tag: "Idle",
});
const shownState: FormState = state;
const onForm: (payload: FormData) => void = formAction;
const waiting: boolean = isPending;
