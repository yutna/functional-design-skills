# Three Strategies, One Example

The task: approve a refund if the booking exists, is no more than sixty
days old, and the amount does not exceed the patient's refund allowance
for the month. How much of the allowance is used comes from the billing
system, which charges for each call.

## Contents

- [Strategy 1: dependency rejection](#strategy-1-dependency-rejection)
- [Strategy 2: dependency parameterization](#strategy-2-dependency-parameterization)
- [Strategy 3: interpretation](#strategy-3-interpretation)
- [Choosing](#choosing)
- [Time, randomness and identifiers](#time-randomness-and-identifiers)
- [Configuration](#configuration)
- [The composition root](#the-composition-root)

## Strategy 1: dependency rejection

A handler reads everything first, then a pure function decides.

```text
-- core: no dependencies at all
type RefundCase = {
  now: Instant,
  request: RefundRequest,
  booking: Booking,
  usedThisMonth: Money,
  allowance: Money,
}

approveRefund : RefundCase -> Result<RefundApproved, RefundError>
```

```text
-- shell: the handler's failure type has a case for each way it can fail
type RefundFailure =
  | NotFound
  | Rejected of RefundError
  | Unavailable of StoreError

handleApproveRefund :
  Pool -> Money -> Instant -> RefundRequest
    -> AsyncResult<RefundApproved, RefundFailure>
handleApproveRefund pool allowance now request =
  both
      (loadBooking pool request.bookingId)
      (loadUsage pool request.patient (monthOf now))
    |> mapError Unavailable
    |> bind (\(found, used) ->
         toResult NotFound found
           |> bind (\booking ->
                approveRefund
                  { now, request, booking, usedThisMonth: used, allowance }
                  |> mapError Rejected))
```

The handler turns a booking that was not found into a case of its own
failure type, since the context needs a booking. Recording the approval
is the same last step in every strategy, and is left out. The handler
takes the connection: it reads once each and has no path worth a stub.
`both` starts the two reads at once; see
[effect-alignment.md](../../functional-designing-workflow-pipelines/references/effect-alignment.md).

**Cost:** the usage is read even when the booking is too old.
**Benefit:** the decision is a pure function of plain data. It can be
tested exhaustively, replayed against historical data, and reviewed by a
domain expert.

Prefer this whenever the extra reading is affordable, which is more
often than people expect.

## Strategy 2: dependency parameterization

The rules become two pure functions, and the handler reads between them
through capabilities it takes as parameters.

```text
-- core: each check is a rule, and neither reads anything
type Allowance = { limit: Money, used: Money }

checkAge : Instant -> Booking -> Result<RecentBooking, RefundError>
checkAllowance :
  Allowance -> RecentBooking -> RefundRequest
    -> Result<RefundApproved, RefundError>
```

```text
-- shell: the capabilities are declared in the domain's words
alias LoadBooking = BookingId -> AsyncResult<Option<Booking>, StoreError>
alias LoadUsage = PatientId -> Month -> AsyncResult<Money, StoreError>

handleApproveRefund :
  LoadBooking -> LoadUsage -> Money -> Instant -> RefundRequest
    -> AsyncResult<RefundApproved, RefundFailure>
handleApproveRefund loadBooking loadUsage allowance now request =
  loadBooking request.bookingId
    |> mapError Unavailable
    |> bind (toResult NotFound)
    |> bind (checkAge now >> mapError Rejected)
    |> bind (\recent ->
         loadUsage request.patient (monthOf now)
           |> mapError Unavailable
           |> bind (\used ->
                checkAllowance { limit: allowance, used } recent request
                  |> mapError Rejected))
```

`checkAge` returns a `RecentBooking`, a type that did not exist before
it ran, so `checkAllowance` cannot be handed a booking nobody checked.

**Cost:** the handler has paths, so it takes the capabilities and not
the connection, a test stubs each one, and the order of reads becomes
code to test.
**Benefit:** the usage, which costs a call, is read only when the age
check has passed.

That cost is what earns the strategy here: a read with a known cost too
high to pay every time is the second of the three conditions in rule 1
of [the skill](../SKILL.md#core-rules). Without one of the three, the
skipped read is not worth the paths, and strategy 1 is the answer.

## Strategy 3: interpretation

The core returns instructions; the shell performs them.

```text
type RefundInstruction =
  | CreditAccount of { patient: PatientId, amount: Money }
  | NotifyPatient of { patient: PatientId, template: TemplateId }

planRefund :
  RefundCase -> Result<NonEmptyList<RefundInstruction>, RefundError>
```

The amount appears once, in the instruction that credits it. What earns
this strategy here is that refunds are audited one effect at a time: the
instructions are saved with the refund, shown to the auditor as they
stand, and performed by a relay that can resume after a restart.

**Cost:** an extra type, and a shell that interprets it.
**Benefit:** the effects are values. They can be logged, tested by
equality, reordered, batched, retried individually, and shown to an
auditor.

Use it when the sequence of effects is itself something the business
cares about.

## Choosing

| Question                               | Points to        |
| -------------------------------------- | ---------------- |
| All data can be read up front          | Rejection        |
| What to read depends on a rule         | Parameterization |
| A read has a known cost, too high      | Parameterization |
| A check must pass before a read        | Parameterization |
| Decisions must be replayable           | Rejection        |
| The effects must be stored or audited  | Interpretation   |
| A simple two-step workflow             | Rejection        |

## Time, randomness and identifiers

All three reach the core as values, as the skill's rule 7 says.

```text
-- pass the value
isExpired : Instant -> Quote -> Boolean

-- many identifiers: derive them from one value
lineIdAt : BookingId -> Integer -> LineId

-- or let the handler draw them between two pure functions
countNeeded : List<Draft> -> Integer
assignIds : List<TreatmentId> -> List<Draft> -> List<BookedTreatment>
drawTreatmentIds : Integer -> Async<List<TreatmentId>>
```

Prefer passing the value. A command usually needs one instant, read once
for it, and using the same instant throughout is also more correct than
sampling the clock repeatedly.

## Configuration

Configuration is a dependency that changes rarely. Read it once at
startup, parse it into typed values, and pass those.

```text
-- edge
loadConfig : Environment -> Result<Config, ConfigError>

-- domain receives typed values, never keys
lateFee : FeePolicy -> Instant -> Booking -> Money
```

A domain function that reads an environment variable has an invisible
input and cannot be tested twice with different settings in one process.

## The composition root

One function, at the edge, builds the wired handlers. It is the only
place that knows about both the domain and the infrastructure, and it
takes only what the handlers use.

```text
buildApp pool allowance =
  {
    confirm =
      handleConfirmBooking pool,
    refund =
      handleApproveRefund (loadBooking pool) (loadUsage pool) allowance,
  }
```

Properties worth keeping: it is plain code, it is the only place with
both kinds of import, and reading it tells you the system's whole
dependency graph.
