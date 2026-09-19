# Type Algebra

Counting the values a type can hold turns modelling arguments into
arithmetic. The count is the number of distinct states the type permits;
the design goal is to make it equal to the number the business permits.

## The rules

| Construct           | Value count            |
| ------------------- | ---------------------- |
| `Unit`              | 1                      |
| `Boolean`           | 2                      |
| A choice of A or B  | count A + count B      |
| A record of A and B | count A * count B      |
| `Option<A>`         | count A + 1            |
| `Result<A, E>`      | count A + count E      |
| `A -> B`            | count B to the power A |

Records multiply, which is why optional fields are expensive: each one
doubles the state space, and almost all of the new states are illegal.

## Worked count

```text
type Payment = {
  method: String,
  cardNumber: Option<String>,
  cardExpiry: Option<String>,
  bankCode: Option<String>,
  transferRef: Option<String>,
}
```

Treat each string as a large set S. The count is
`S * (S+1) * (S+1) * (S+1) * (S+1)`, and the number the business allows
is roughly `1 + S*S + S*S`: cash, or a card with number and expiry, or a
transfer with bank and reference. The ratio of illegal to legal states is
enormous, and every one of those illegal states is a bug someone will
have to handle or a test someone will have to write.

```text
type Payment =
  | Cash
  | Card of { number: CardNumber, expiry: ExpiryDate }
  | Transfer of { bank: BankCode, reference: TransferRef }
```

Count: `1 + (C * E) + (B * R)`, where each component is already
constrained by its own type. The count now matches the business, so there
is nothing left to check at runtime.

## Using the count in review

Ask two questions about any type under review:

1. How many states can this hold?
2. How many does the business recognise?

If the answers differ by more than a small factor, the gap is where bugs
will live. The usual causes, in order of frequency:

- Optional fields that are correlated: fold them into cases.
- A primitive standing for a constrained value: wrap it. See
  [constraining-primitive-values](../../constraining-primitive-values/SKILL.md).
- A collection that must not be empty: use `NonEmptyList`.
- A pair of fields that must agree: replace with one field, or with a
  choice type that carries both.

## Where the arithmetic helps most

**Choosing between `Option<Option<A>>` and a three-case choice.** Both
count `A + 2`, but only one of them names the two extra states. Prefer
the named version.

**Deciding whether to split a record.** If half the fields are only ever
set together with the other half absent, the record is really a choice,
and the count will show it.

**Judging an enum plus a payload.** A `status: Status` field next to a
`cancelledReason: Option<Reason>` counts `S * (R + 1)`, while a choice
type with `Cancelled of Reason` counts `S - 1 + R`. The difference is the
set of states where the status and the reason disagree.

## The limit of the technique

The count says nothing about whether the concepts are the right ones. A
type can have exactly the right number of states and still use the wrong
words, model the storage rather than the domain, or place a rule in the
wrong module. Use the arithmetic to find representable-but-illegal
states; use conversation with the experts to find the concepts. See
[capturing-the-domain](../../capturing-the-domain/SKILL.md).
