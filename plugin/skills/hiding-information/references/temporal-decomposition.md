# Temporal Decomposition

Temporal decomposition is structuring a system around the order in which
things happen rather than around the knowledge each part holds. It is the
most common cause of information leakage, because execution order is the
first structure a developer sees.

## How it happens

You are told: read the file, validate it, enrich it from the database,
write the result. That is four steps, so four modules appear:

```text
readInput     : Path -> AsyncResult<RawRows, IoError>
validateRows  : RawRows -> Result<ValidRows, ValidationError>
enrichRows    : ValidRows -> AsyncResult<EnrichedRows, DbError>
writeOutput   : EnrichedRows -> AsyncResult<Unit, IoError>
```

It looks clean. It is not, because the file's format is now known in
`readInput` (to parse it) and in `writeOutput` (to produce it), and often
in `validateRows` too, since validation rules follow the format. One
decision, three owners.

## The test

For each module, ask: **what does this module know that no other module
knows?** If the answer is a stage of processing rather than a piece of
knowledge, it is temporal.

A second test: if the order of the steps changed, how many modules would
change? Under a knowledge decomposition, one. Under a temporal one, all
of them.

## The repair

Group by knowledge, then let the workflow call across those groups.

```text
-- knowledge: the file format, read and written in one place
module RowFile
  read  : Path -> AsyncResult<List<Row>, RowFileError>
  write : Path -> List<Row> -> AsyncResult<Unit, RowFileError>

-- knowledge: what makes a row acceptable
module RowRules
  validate : Row -> Result<ValidRow, RowError>

-- knowledge: how a row is completed from stored data
module RowEnrichment
  enrich : LookupCustomer -> ValidRow -> Result<EnrichedRow, EnrichError>
```

The workflow that runs them in order is one small function, and it is the
only thing that knows the booking:

```text
importFile = RowFile.read >=> traverse RowRules.validate
               >=> traverse (RowEnrichment.enrich lookup)
               >=> RowFile.write outPath
```

Change the booking, add a step, or run two steps concurrently, and only
this function changes.

## Where the pipeline shape still applies

Nothing here argues against pipelines. A workflow **is** a sequence, and
writing it as one is right. The mistake is turning each stage into a
module. Stages are functions; modules are owners of knowledge.

See
[designing-workflow-pipelines](../../designing-workflow-pipelines/SKILL.md)
for how a pipeline is structured once the modules are right.

## Recognising it in review

- Module or directory names: `handlers`, `processors`, `steps`, `stages`
- Names with a sequence in them: `preValidate`, `postProcess`
- Two modules importing the same format constant
- A change to a field's meaning touching every stage
- The workflow function contains no logic yet all stages know its booking
