# Units, Money and Measures

Numbers with units are where primitive obsession does the most visible
damage: the failures are silent, and they are wrong by a factor rather
than being obviously broken.

## Put the unit in the type

```text
-- name-based: nothing stops the mistake
timeoutMs : Integer
delaySeconds : Integer
wait (timeoutMs + delaySeconds)      -- compiles, wrong by 1000x
```

```text
-- type-based: the mistake cannot be written
type Milliseconds = Milliseconds of Integer
type Seconds = Seconds of Integer
toMillis : Seconds -> Milliseconds

wait (add timeoutMs (toMillis delaySeconds))
```

The conversion becomes explicit and visible in review, which is the whole
point: the bug was never the arithmetic, it was the invisible conversion.

## Money

Money needs three decisions, and all three belong in the type.

1. **Currency.** Either a field, or a distinct type per currency where
   the system is single-currency. Addition across currencies must not be
   silently possible.
2. **Scale.** Two decimal places for most currencies, zero for some,
   more for unit prices. Store the smallest unit as an integer where
   exactness matters, and never use binary floating point for money.
3. **Rounding.** Where and how rounding happens is a business rule.
   Name it and put it in one function.

```text
type Currency = THB | USD | EUR
type Money = Money of { minorUnits: Integer, currency: Currency }

add : Money -> Money -> Result<Money, CurrencyMismatch>
multiply : Money -> Percent -> Money        -- rounding rule inside
```

`multiply` is total because the rounding rule makes it so. `add` is not,
because two currencies genuinely cannot be added, and pretending
otherwise produces wrong invoices.

Where a system is single-currency, say so in the type and get totality
back:

```text
type Baht = Baht of Integer            -- satang, the minor unit
add : Baht -> Baht -> Baht
```

## Quantities and rates

Keep quantities and rates distinct even when both are numbers, because
multiplying two quantities is almost always a bug while quantity times
rate is the common case.

```text
type Quantity = Quantity of Integer
type UnitPrice = UnitPrice of Money
lineTotal : Quantity -> UnitPrice -> Money
```

There is deliberately no `Quantity -> Quantity -> Quantity`
multiplication.

## Percentages

Decide once whether one hundred per cent is `1.0` or `100`, encode it in
the type name, and never mix.

```text
type Percent = Percent of Decimal        -- 0..100
type Fraction = Fraction of Decimal      -- 0..1
toFraction : Percent -> Fraction
```

Most percentage bugs are the two conventions meeting.

## Time

Three different concepts, routinely conflated:

| Concept  | Meaning                         | Type                 |
| -------- | ------------------------------- | -------------------- |
| Instant  | A point on the timeline         | `Instant`, in UTC    |
| Duration | An amount of elapsed time       | `Seconds`, `Days`    |
| Civil    | A date or time as people say it | `LocalDate` and zone |

Rules that prevent most date bugs:

- Store and pass instants in UTC; convert to civil time only for display
  and for rules that are genuinely about a calendar day.
- A "date" in a business rule usually needs a timezone to be meaningful.
  Carry the zone with it, or state whose zone it is in the name.
- Never subtract two civil dates to get a duration across a zone change.
- Take the current instant as a parameter, never from inside the domain.
  See
  [parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

## What arithmetic to expose

For each measure type, decide deliberately which operations exist. The
set of operations you do not provide is as much a design decision as the
set you do.

- `Money`: add, subtract, multiply by a rate, negate. Not divide by
  money, unless the domain has a meaning for it.
- `Quantity`: add, subtract with a floor. Not multiply.
- `Instant`: add a duration, subtract to get a duration. Not add two
  instants.

Every operation you leave out is a class of bug that cannot be written.
