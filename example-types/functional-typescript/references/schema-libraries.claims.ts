// "Both produce a nominal type that a plain string cannot be assigned to."
// @ts-expect-error a plain string is not a TreatmentCode
const plain: TreatmentCode = "W1234";
