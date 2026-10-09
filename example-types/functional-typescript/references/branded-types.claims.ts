// "transfer(bookingId, customerId) is now a compile error."
declare const bookingId: BookingId;
declare const customerId: CustomerId;
// @ts-expect-error the arguments are the wrong way round
transfer(bookingId, customerId);

// "Branded numbers still support arithmetic operators, which is a real
// limitation: `quantity + percent` compiles."
declare const quantity: Quantity;
declare const percent: Percent;
const mixed: number = quantity + percent;

// "A library taking `string` accepts a branded string."
declare const code: TreatmentCode;
const asString: string = code;

// A plain string is not a TreatmentCode, which is what the parser is for.
// @ts-expect-error only the parser makes one
const forged: TreatmentCode = "W1234";
