# The Design Loop, Worked

One small feature walked through the seven steps: **apply a discount code
when confirming a booking**. The point is the order of the steps, not the
domain.

## 1. Say it in the domain's words

The business says: "a customer enters a code; if it is valid and not
expired we take a percentage off the booking total; the receipt has to show
the discount." That yields one command and one event.

```text
type ApplyDiscount = { booking: PricedBooking, code: String }
type DiscountApplied = { booking: DiscountedBooking, saved: Money }
```

Ask which words are the business's own. "Code", "expired", "saved" are.
"DiscountService" is not, so it does not appear.

## 2. Model the data

The vague parts are `String` and "valid". Give each a type.

```text
type DiscountCode = DiscountCode of String   -- 4..16 chars, upper case
type Percentage = Percentage of Decimal      -- 0 < p <= 100

type Discount =
  | Percent of Percentage
  | FixedAmount of Money
```

Now write down the states the business forbids: a discount that is both
percentage and amount, a negative saving, an applied discount with no
code. Each one must be unbuildable, not merely unlikely.

## 3. Design the workflow as a pipeline

```text
applyDiscount :
  ApplyDiscount -> Result<DiscountApplied, ApplyDiscountError>

applyDiscount =
  parseCode >=> lookupDiscount >=> checkNotExpired >=> reprice
```

Each step gets its own signature before any body is written. Where two
steps always run together and share nothing else, they are one step.

## 4. Decide where effects live

`lookupDiscount` needs storage; `checkNotExpired` needs the clock. Neither
belongs in the core, so both become parameters.

```text
alias LookupDiscount = DiscountCode -> Option<DiscountRule>

applyDiscount :
  LookupDiscount -> Instant -> ApplyDiscount
    -> Result<DiscountApplied, ApplyDiscountError>
```

The shell reads the clock and the database once, then calls a pure
function. The core can now be tested with plain values.

## 5. Shape the modules

The discount module exposes `applyDiscount` and the types in its
signature. It does not expose `DiscountRule`'s storage shape, the SQL, or
the percentage arithmetic. Ask: could the rule source change from a table
to a config file without touching a caller? If not, something leaked.

## 6. Name and document

`applyDiscount` beats `processDiscountRequest`. `saved` beats `amount2`.
The only comment worth writing here records what the code cannot say: why
expiry is compared in the customer's timezone, and which team owns the
rule table.

## 7. Review

Run the red-flag pass from
[reviewing-functional-design](../../reviewing-functional-design/SKILL.md).
For this feature the questions that bite are: can an expired discount
reach `reprice`, does `ApplyDiscountError` distinguish "unknown code" from
"expired code", and does any caller need to know the order of the steps.
