import { Schema } from "effect";

// Names the fences use without defining.
declare const BookingId: Schema.brand<typeof Schema.String, "BookingId">;
declare const CardNumber: Schema.brand<typeof Schema.String, "CardNumber">;
declare const input: unknown;

// The test fence's runner. Its `toEqual` takes the type of what is checked.
declare function it(name: string, run: () => void): void;
declare function expect<T>(actual: T): { toEqual(expected: T): boolean };
