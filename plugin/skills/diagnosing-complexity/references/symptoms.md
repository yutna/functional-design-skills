# The Three Symptoms, Worked

Each symptom below is shown in functional code, with the question that
exposes it and the smallest change that removes it.

## Change amplification

The same fact is written in more than one place, so one conceptual change
becomes many edits.

```text
-- three modules each know that a code is 4..16 upper-case characters
parseInBookings  : String -> Option<String>
parseInBilling : String -> Option<String>
parseInReports : String -> Option<String>
```

The rule lives in three bodies. Change the length and you must find all
three, and there is nothing to tell you there were exactly three.

```text
-- one module owns the fact; the type carries it everywhere
type DiscountCode = DiscountCode of String
parseDiscountCode : String -> Result<DiscountCode, CodeError>
```

Now the rule has one home, and every other module receives a value that
already satisfies it.

**Exposing question:** if this rule changed today, how would I find every
place that depends on it? If the answer is "search", the fact is
duplicated.

Related: [constraining-primitive-values](../../constraining-primitive-values/SKILL.md).

## Cognitive load

A caller must know facts that the signature does not state.

```text
applyPayment : Booking -> Payment -> Booking
```

What a reader cannot see: the booking must already be priced, the payment
must already be authorised, calling it twice double-counts, and it throws
if the booking is cancelled. Four facts, none of them in the type.

```text
applyPayment :
  PricedBooking -> AuthorisedPayment -> Result<PaidBooking, PaymentError>
```

Three of the four facts are now in the signature. The fourth,
idempotency, either becomes a property of `PaidBooking` (applying again is
a type error) or is documented as the one thing the type cannot say.

**Exposing question:** list everything a new developer must be told
before they may call this function safely. Every item on that list is
cognitive load, and each one belongs either in the type or in a comment.

## Unknown unknowns

The information needed to change the code correctly is not reachable from
the code you are changing.

```text
-- shipping.ts
calculateShipping : Booking -> Money

-- somewhere else, unrelated by any import
-- reporting reads shipping cost by re-deriving it with its own copy
-- of the weight bands
```

Change the weight bands in `shipping` and the report silently disagrees.
Nothing in `shipping` points at `reporting`; nothing in `reporting`
points back. The dependency is real and invisible.

The fix is not documentation. It is to make the dependency explicit:
export the bands as a value from one module and have the other consume
it, or have the report read the computed cost rather than recompute it.

**Exposing question:** what would have to be true elsewhere for this
change to be wrong? If you cannot answer without a codebase-wide search,
you have unknown unknowns.

## Ranking the three

When several symptoms are present, fix in this order:

1. Unknown unknowns, because they make every later change a gamble.
2. Cognitive load, because it slows every reader forever.
3. Change amplification, because it is at least visible and countable.
