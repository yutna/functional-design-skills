# LSP, ISP and DIP in Functional Code

## Liskov substitution: the contract of a function type

A function type is a promise. Any function used where that type is
expected must keep the whole promise, not just the shape.

```text
alias GetTreatmentPrice = TreatmentCode -> Price
```

A substitute violates the contract if it:

- **Throws** where the type promises a `Price` for every `TreatmentCode`
- **Demands more** of its input than the type states, such as requiring
  the code to be upper case
- **Promises less** about its output, such as returning zero for unknown
  codes when callers assume a real price
- **Has an effect** the type does not mention: writing a log row, taking
  a lock, mutating a cache that callers can observe
- **Is not total**: hangs, or fails for a subset of legal inputs

If any of those is unavoidable, the type is wrong, not the
implementation. Widen it until it is honest:

```text
alias GetTreatmentPrice =
  TreatmentCode -> AsyncResult<Price, PriceLookupError>
```

An honest type is worth more than a convenient one, because every caller
is written against it.

### Substitutability for choice types

The same rule applies to the cases of a sum type. If callers assume that
every `Booking` has at least one treatment, then every case that constructs an
`Booking` must guarantee it, or the assumption belongs in the type.

```text
type Booking = { treatments: NonEmptyList<BookedTreatment>, ... }
```

### Detecting violations

- A test double behaves differently from production in a way callers can
  observe
- A comment says "this implementation also ..."
- One implementation of a function type needs a caller to do extra setup
- An implementation checks its input and throws on values the type allows

## Interface segregation: narrow the dependency

Depend on the smallest thing that does the job. In functional code the
smallest thing is a single function type.

```text
-- wide: 22 operations, two of them used
confirmBooking : BookingRepository -> ...

-- narrow: exactly what is used, named in the domain's words
confirmBooking : CheckTreatmentExists -> SaveBooking -> ...
```

Benefits that follow immediately:

- Tests supply two one-line functions and no framework
- A reader of the signature knows exactly what the function touches
- Replacing storage affects the shell, not the domain
- Nothing can quietly start using a twenty-third operation

### The rule of thumb

If a parameter's type has members the function never calls, the parameter
is too wide. Split it into the function types actually used, and name
each one for what it means to the domain, not for where it comes from.
`SaveBooking`, not `BookingRepositoryPort`.

### When a record is right

Group function types into a record only when they must vary together as a
set, and when callers genuinely need all of them. Three or four members
is a lot; twenty is a module pretending to be a parameter.

## Dependency inversion: which way the arrows point

The domain declares the function types it needs. The shell provides
implementations and wires them in. Nothing in the domain imports storage,
transport, or framework code.

```text
-- domain module: declares needs, imports nothing external
alias LoadCustomer = CustomerId -> AsyncResult<Customer, LoadError>

confirmBooking : LoadCustomer -> SaveBooking -> BookingRequest
               -> AsyncResult<BookingConfirmed, ConfirmBookingError>

-- shell module: imports the driver, the domain, and connects them
confirmBookingWired =
  confirmBooking (loadCustomerFromDb pool) (saveBookingToDb pool)
```

The arrow points from the shell to the domain. That is the inversion: the
concrete, changeable, vendor-specific code depends on the stable domain,
never the reverse.

### Where the abstraction lives matters

Declaring `LoadCustomer` in the storage module and importing it into the
domain is not inversion; it is the same dependency with an extra hop. The
function type must be declared by the consumer, in the consumer's
vocabulary.

### When not to invert

An abstraction with one implementation, no test benefit, and no prospect
of a second implementation is interface for nothing. Pure functions,
standard library calls, and language primitives are not dependencies to
invert. Invert what varies: I/O, clocks, randomness, third-party
services, and anything a test needs to control.
