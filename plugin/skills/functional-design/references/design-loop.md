# The Design Loop, Worked

One small feature walked through the steps of the loop: **apply a discount code
when confirming a booking**. The point is the order of the steps, not the
domain.

## Contents

- [1. Say it in the domain's words](#1-say-it-in-the-domains-words)
- [2. Model the data](#2-model-the-data)
- [3. Design the workflow as a pipeline](#3-design-the-workflow-as-a-pipeline)
- [4. Decide where effects live](#4-decide-where-effects-live)
- [5. Shape the modules](#5-shape-the-modules)
- [6. Name and document](#6-name-and-document)
- [7. Review](#7-review)

## 1. Say it in the domain's words

The business says: "a patient enters a code; if it is valid and not
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
alias DiscountRules = Map<DiscountCode, DiscountRule>

applyDiscount :
  DiscountRules -> Instant -> ApplyDiscount
    -> Result<DiscountApplied, ApplyDiscountError>

applyDiscount rules now command =
  parseCode command
    |> bind (lookupDiscount rules)
    |> bind (checkNotExpired now)
    |> map reprice
```

The rule table and the instant are values the workflow is given.

Each step gets its own signature before any body is written. Where two
steps always run together and share nothing else, they are one step.

## 4. Decide where effects live

The rule table lives in storage, and checking expiry needs the clock.
Neither belongs in the core, so the workflow takes both as values and a
handler supplies them.

```text
type ApplyDiscountFailure =
  | Rejected of ApplyDiscountError
  | Unavailable of StoreError

handleApplyDiscount :
  Pool -> Instant -> ApplyDiscount
    -> AsyncResult<DiscountApplied, ApplyDiscountFailure>
handleApplyDiscount pool now command =
  loadDiscountRules pool
    |> mapError Unavailable
    |> bind (\rules ->
         applyDiscount rules now command |> mapError Rejected)
    |> bind (saveDiscounted pool >> mapError Unavailable)
```

The shell reads the clock once for the command and hands the instant to
the handler, which reads the rule table, calls the pure function, and
writes the result. The core can now be tested with plain values.

## 5. Shape the modules

The discount module exposes `applyDiscount` and the types in its
signature. It does not expose `DiscountRule`'s storage shape, the SQL, or
the percentage arithmetic. Ask: could the rule source change from a table
to a config file without touching a caller? If not, something leaked.

## 6. Name and document

`applyDiscount` beats `processDiscountRequest`. `saved` beats `amount2`.
The only comment worth writing here records what the code cannot say: why
a fixed-amount discount is capped at the booking total instead of
refused, and which team owns the rule table.

## 7. Review

Run the red-flag pass from
[functional-reviewing-functional-design](../../functional-reviewing-functional-design/SKILL.md).
For this feature the questions that bite are: can an expired discount
reach `reprice`, does `ApplyDiscountError` distinguish "unknown code" from
"expired code", and does any caller need to know the order of the steps.
