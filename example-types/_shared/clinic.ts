// The clinic names the Effect skill's fences use without defining, and that
// mention no library. SKILL.md is checked against two majors of Effect, and
// each has a prelude of its own; what they share lives here, so that the two
// cannot come to disagree about what a Money or a BookAppointment is. A name
// that mentions Effect stays in the prelude, because each major has its own.

import type { Brand } from "./result";

export type PatientId = Brand<string, "PatientId">;
export type SlotId = Brand<string, "SlotId">;
export type SlotHold = {
  readonly slot: SlotId;
  readonly patient: PatientId;
};
export type Money = { readonly satang: number };
export type PatientCategory =
  | { readonly tag: "Insured"; readonly copay: Money }
  | { readonly tag: "Private" };
export type BookAppointment = {
  readonly patient: PatientId;
  readonly slot: SlotId;
  readonly category: PatientCategory;
};
export type Appointment = { readonly hold: SlotHold; readonly fee: Money };
export type Pool = { readonly name: string };
