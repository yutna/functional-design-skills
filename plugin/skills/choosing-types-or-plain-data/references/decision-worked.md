# Four Decisions Worked Through

Each case names the fact that settled it. None is settled by how much
typing it saved.

## Case 1 — an amount on one endpoint

**Situation.** A new endpoint accepts a refund amount. It is used in one
handler. The handler validates that it is positive and not above the
original charge, then calls the payment provider.

**The tempting answer.** It is one number, in one handler, checked in
place. A `Decimal` and two `if`s.

**Facts that apply.**

| Fact                                | Verdict |
| ----------------------------------- | ------- |
| A business rule branches on it      | type    |
| Getting it wrong costs money        | type    |
| It appears in an exported signature | type    |
| Field set comes from config         | no      |

Three of the four type-side facts are true. Nothing on the generic side
is.

**Design.**

```text
type Money = Money of { amount: Decimal, currency: Currency }
type RefundAmount = RefundAmount of Money

refundAmount :
  Money -> Money -> Result<RefundAmount, RefundAmountError>
-- original charge, requested amount
```

`RefundAmount` cannot be constructed without the original charge, so
"not above the original" is not a rule anyone can forget. `Money` carries
its currency, so a cross-currency refund does not silently succeed.

**What it cost.** Two types and one constructor. **What it removed.** The
possibility of a second endpoint refunding more than was charged, which
is the bug this shape exists to prevent.

The "only one handler" argument is the one to distrust. It is true on the
day the code is written and false within a quarter.

## Case 2 — a form whose fields an admin defines

**Situation.** Customers build intake forms in an admin screen: they add
fields, name them, choose types, mark them required. End users fill the
forms in. The system stores the answers and shows them back.

**The tempting answer.** Model the fields. `type IntakeForm = { name:
CustomerName, email: EmailAddress, ... }` — then add a branded type per
field as customers ask for more.

That answer cannot work, and it is worth being precise about why: the
field set is not known when the code is compiled. Every new field would
be a deployment, and two customers with different fields would either get
two types or one type with everything optional. The second is the shape
[making-illegal-states-unrepresentable](../../making-illegal-states-unrepresentable/SKILL.md)
exists to forbid.

**Facts that apply.**

| Fact                                    | Verdict |
| --------------------------------------- | ------- |
| Field set comes from config or an admin | generic |
| It varies per tenant                    | generic |
| Its schema is data the system reads     | generic |
| A business rule branches on it          | no      |

**Design.**

```text
type FormTemplate = {
  id: TemplateId,
  version: SchemaVersion,
  fields: Map<FieldKey, FieldSpec>,
}

type Submission = {
  templateId: TemplateId,
  templateVersion: SchemaVersion,
  submittedBy: UserId,
  answers: ValidatedAnswers,
}

submit :
  FormTemplate -> UserId -> Json
                -> Result<Submission, List<FieldError>>
```

The envelope is fully modelled: five fields, all known, all branched on.
The one varying part is the map. `FieldSpec` is a closed choice type
because developers decide what kinds of field exist, even though
customers decide which fields exist.

**What it cost.** Everything in the
[checklist](schema-as-data.md#checklist): a parse, a `ValidatedAnswers`
wrapper, key constants, accessors, coverage tests, and a stored version.
**What it bought.** A new customer field is a row, not a release.

**The mistake to avoid here** is going generic on the envelope too.
`{ templateId: String, data: Json }` throws away five fields that had no
reason to be generic.

## Case 3 — a report the user configures

**Situation.** A reporting screen where the user picks dimensions to group
by and measures to aggregate, from a fixed list the treatment team owns. The
result is a table.

**Facts that apply — and they point both ways.** The output columns vary
per request, so the row shape is generic. But the dimensions and measures
come from a list developers control, and the aggregation code branches on
every one of them, so those are closed cases.

**Design: the split runs through the middle of the pipeline.**

```text
-- closed: developers own these lists, code branches on each case
type Dimension = Region | Channel | Month | TreatmentLine
type Measure = Revenue | Units | Margin

type ReportRequest = {
  dimensions: NonEmptyList<Dimension>,
  measures: NonEmptyList<Measure>,
  range: DateRange,
}

-- generic: the row shape is whatever the request asked for
type Row = Map<ColumnKey, CellValue>
type Report = { columns: NonEmptyList<ColumnKey>, rows: List<Row> }

runReport : ReportRequest -> AsyncResult<Report, ReportError>
```

The _request_ is fully typed, so an impossible report cannot be asked
for: no unknown dimension, no empty measure list, no inverted date range.
The _result_ is generic, because its shape is a function of the request
and nothing downstream of `runReport` decides anything with it — it is
rendered.

**The fact that settled it.** Not the language, not the effort: the
request is decided on, the rows are not. Decisions get types; renderings
do not.

**What would have gone wrong either way.** A generic request loses
exhaustiveness on the aggregation match, which is where the real logic
is. A typed row means one type per column combination, which is
combinatorial and pointless.

## Case 4 — a webhook payload that is stored and replayed

**Situation.** The system receives webhooks from a third party, stores
them, and can replay them to a downstream consumer for recovery. It reads
two fields — the event type and the delivery id — for routing and
de-duplication. It reads nothing else.

**Facts that apply.**

| Fact                               | Verdict |
| ---------------------------------- | ------- |
| Nothing branches on the payload    | generic |
| Operations are open: store, replay | generic |
| The sender owns the shape          | generic |

**Design.**

```text
type StoredWebhook = {
  deliveryId: DeliveryId,
  eventType: EventType,
  receivedAt: Instant,
  payload: Json,
}
```

`payload` stays `Json`, byte-preserving. Modelling it would be actively
wrong: the third party may add fields, and a model that dropped unknown
fields would corrupt a replay. `deliveryId` and `EventType` are modelled
because the system routes and de-duplicates on them.

**The fact that settled it.** The system is a courier for this value, not
a reader of it. A courier must not reshape what it carries.

## What the four cases have in common

| Case        | Envelope | Payload | Settled by                     |
| ----------- | -------- | ------- | ------------------------------ |
| Refund      | typed    | typed   | money and a rule branch on it  |
| Intake form | typed    | generic | the admin owns the field set   |
| Report      | typed    | generic | rows are rendered, not decided |
| Webhook     | typed    | generic | the system is a courier        |

The envelope is typed in all four. That is not a coincidence: the fields
a system routes, correlates, and audits on are always known at compile
time, whatever varies inside.

**The question that decides it, every time:** does any code in this
system make a decision by looking at this value? If yes, model it. If it
is only stored, forwarded, or rendered, generic is honest.
