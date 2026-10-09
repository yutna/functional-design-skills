import type { Brand } from "../_shared/result";

// Names the fences use without defining.
type SlotId = Brand<string, "SlotId">;
type Confirmation = { readonly reference: string };

// `confirm` is also a DOM global, `confirm(message?: string): boolean`, and a
// SlotId is a string. Without this declaration the fence would compile
// against the dialog and not against a booking call.
declare const confirm: (slot: SlotId) => Promise<Confirmation>;

// The Testing fence uses a slot and a test library's `expect`. This `expect`
// rejects a `toBe` argument of the wrong type, so the fence's assertions are
// checked against the snapshot's types.
declare const s1: SlotId;
declare function expect<T>(actual: T): { toBe(expected: T): void };
