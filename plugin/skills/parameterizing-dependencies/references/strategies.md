# Three Strategies, One Example

The task: approve a refund if the booking exists, is less than sixty days
old, and the amount does not exceed the customer's refund allowance for
the month.

## Strategy 1: dependency rejection

The shell gathers everything, then a pure function decides.

```text
-- pure core: no dependencies at all
type RefundContext = {
  booking: Booking,
  bookingAge: Days,
  usedThisMonth: Money,
  allowance: Money,
}

decideRefund : RefundContext -> Result<RefundApproved, RefundError>
```

```text
-- shell
handleRefund request =
  loadBooking request.bookingId
    |> combine (loadUsage request.customerId)
    |> map (toContext now)
    |> bind decideRefund
```

**Cost:** the shell fetches the usage even when the booking is too old.
**Benefit:** the decision is a pure function of plain data. It can be
tested exhaustively, replayed against historical data, and reviewed by a
domain expert.

Prefer this whenever the extra fetching is affordable, which is more
often than people expect.

## Strategy 2: dependency parameterization

The decision fetches as it goes, through function types it declares.

```text
alias LoadBooking = BookingId -> Async<Option<Booking>>
alias LoadUsage = CustomerId -> Month -> Async<Money>

approveRefund :
  LoadBooking -> LoadUsage -> Instant -> RefundRequest
    -> AsyncResult<RefundApproved, RefundError>
```

**Cost:** the core is now asynchronous and needs two stubs in tests.
**Benefit:** nothing is fetched that the decision does not reach, and the
sequence of checks is expressed once.

This is the default for workflow steps where a later lookup depends on an
earlier decision.

## Strategy 3: interpretation

The core returns instructions; the shell performs them.

```text
type RefundDecision =
  | Approve of { amount: Money, instructions: List<Instruction> }
  | Reject of RefundError

type Instruction =
  | CreditAccount of { customer: CustomerId, amount: Money }
  | NotifyCustomer of { to: EmailAddress, template: TemplateId }
  | RecordAudit of AuditEntry

decideRefund : RefundContext -> RefundDecision
```

**Cost:** an extra type, and a shell that interprets it.
**Benefit:** the effects are values. They can be logged, tested by
equality, reordered, batched, retried individually, and shown to an
auditor.

Use it when the sequence of effects is itself something the business
cares about.

## Choosing

| Question                             | Points to        |
| ------------------------------------ | ---------------- |
| All data can be fetched up front     | Rejection        |
| A later fetch depends on a decision  | Parameterization |
| The effects are a business artefact  | Interpretation   |
| Over-fetching is expensive           | Parameterization |
| Decisions must be replayable         | Rejection        |
| Effects must be auditable one by one | Interpretation   |
| A simple two-step workflow           | Rejection        |

## Time, randomness and identifiers

All three are dependencies. Treat them exactly the same way.

```text
-- reject: pass the value
isExpired : Instant -> Quote -> Boolean

-- parameterize: pass the source, when many values are needed
alias NextId = Unit -> BookingId
createTreatments : NextId -> List<Draft> -> List<BookedTreatment>
```

Prefer passing the value. A workflow usually needs one timestamp, taken
once at the edge, and using the same instant throughout is also more
correct than sampling the clock repeatedly.

## Configuration

Configuration is a dependency that changes rarely. Read it once at
startup, parse it into typed values, and pass those.

```text
-- edge
loadConfig : Environment -> Result<Config, ConfigError>

-- domain receives typed values, never keys
priceBooking : PricingPolicy -> Booking -> Priced
```

A domain function that reads an environment variable has an invisible
input and cannot be tested twice with different settings in one process.

## The composition root

One function, at the edge, builds the wired workflows. It is the only
place that knows about both the domain and the infrastructure.

```text
buildApp pool client clock =
  {
    confirmBooking =
      confirmBooking (checkTreatment client) (getPrice client) (saveBooking pool),
    approveRefund =
      approveRefund (loadBooking pool) (loadUsage pool),
  }
```

Properties worth keeping: it is plain code, it is the only place with
both kinds of import, and reading it tells you the system's whole
dependency graph.
