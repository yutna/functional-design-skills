# Naming Rules by Kind

## Contents

- [Types](#types)
- [Functions](#functions)
- [Predicates](#predicates)
- [Fields and values](#fields-and-values)
- [Parameters](#parameters)
- [Modules](#modules)
- [Length against scope](#length-against-scope)
- [Abbreviations](#abbreviations)
- [Consistency across a codebase](#consistency-across-a-codebase)

## Types

Nouns from the domain. Say what a value of the type is, not what it
contains or how it is stored.

```text
Booking          not BookingData, BookingObject, BookingModel
EmailAddress   not EmailString
PricedBooking    not BookingWithPrices
```

For stage types, name the guarantee: `ValidatedBooking` says that
validation has passed, not which step produced it.

For choice types, name the concept and give each case a domain word:

```text
type PaymentMethod = Cash | Card of ... | Transfer of ...
```

Avoid suffixes that name the mechanism: `...Enum`, `...Union`,
`...Interface`, `...Impl`.

## Functions

Verb phrases that name the result, from the caller's point of view.

| Purpose                   | Shape                          |
| ------------------------- | ------------------------------ |
| Transform                 | `price`, `normalise`           |
| Parse untrusted input     | `parseX`, returning Result     |
| Check a condition         | `isX`, `hasX`, `canX`          |
| Retrieve, may be absent   | `findX`, returning Option      |
| Retrieve, must exist      | `getX`                         |
| Read through a capability | `loadX`, returning AsyncResult |
| Perform an effect         | `saveX`, `sendX`               |
| Build a value             | `makeX`, `x` (constructor)     |

Keep the convention exact. If `find` returns `Option` in one module and
throws in another, the convention teaches a false rule, and a bug in a
third module will follow.

## Predicates

Say what is true, of what.

```text
isExpired : Instant -> Quote -> Boolean
hasUnpaidTreatments : Booking -> Boolean
canCancel : Booking -> Boolean
```

Never `check`, `valid`, `flag`, `ok`, `status`. A negative name doubles the
reader's work: prefer `isActive` over `isNotInactive`.

## Fields and values

Name the quantity and, where relevant, the unit.

```text
remainingBytes   not size
retryAfter       not delay
expiresAt        not expiry
lineTotal        not total          (which total?)
```

Name the quantity. A bare name is enough when the type says the kind,
as in `retryAfter: Seconds` or `expires: Instant`. Add a suffix when a
bare name is ambiguous: `...At` for an instant, `...On` for a date,
`...For` for a duration.

## Parameters

Named for their role in this function, not their type.

```text
transfer : CustomerId -> AccountId -> AccountId -> Money -> Result<...>
-- which account is the source?

transfer : { by: CustomerId, from: AccountId,
             to: AccountId, amount: Money } -> Result<...>
```

Where two parameters share a type, either give them distinct types or
group them into a record with names. See
[functional-constraining-primitive-values](../../functional-constraining-primitive-values/SKILL.md).

## Modules

Named for the knowledge they own, as a noun.

```text
Pricing        not PricingHelpers
BookingStore     not BookingDAOImpl
RowFile        not FileUtils
```

Never `utils`, `common`, `misc`, `shared`, `helpers`. Each of those is a
module whose purpose sentence would need "and". See
[functional-designing-deep-modules](../../functional-designing-deep-modules/SKILL.md).

## Length against scope

| Scope                  | Length                          |
| ---------------------- | ------------------------------- |
| One-line lambda        | One or two characters is fine   |
| A few lines, local     | One short word                  |
| Function-wide local    | A precise phrase                |
| Parameter of an export | Fully precise                   |
| Exported name          | Fully precise, no abbreviations |

A name's cost is paid where it is read. Wide scope means many readers,
which justifies more characters.

## Abbreviations

Use only those that are universal in the domain: the ones the project's
docs and tests already use, such as `id`, `url`, `dob`, `gp`. Never
invent one, never drop vowels, and never abbreviate differently in two
places.

## Consistency across a codebase

Keep a short list of the words the codebase uses, and use them exactly:

- One verb per kind of retrieval: not `load`, `fetch` and `get` for the
  same kind
- One noun per concept: `customer` or `client`, not both
- One spelling of every domain term, matching the spelling in the
  project's docs and tests; if there is none, ask the user which spelling
  the business uses, as
  [working-alone.md](../../functional-design/references/working-alone.md)
  describes

Where two words are both used, that is either a rename waiting to happen
or a genuine distinction that deserves to be documented. Decide which.
See
[consistency.md](../../functional-programming-strategically/references/consistency.md).
