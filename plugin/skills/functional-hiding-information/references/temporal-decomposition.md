# Temporal Decomposition

Temporal decomposition is structuring a system around the order in which
things happen rather than around the knowledge each part holds. It is the
most common cause of information leakage, because execution order is the
first structure a developer sees.

## Contents

- [How it happens](#how-it-happens)
- [The test](#the-test)
- [The repair](#the-repair)
- [Where the pipeline shape still applies](#where-the-pipeline-shape-still-applies)
- [Recognising it in review](#recognising-it-in-review)

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

Group by knowledge, then let one pure function and one handler call
across those groups.

```text
-- knowledge: the file format, read and written in one place
module RowFile
  read  : Path -> AsyncResult<List<Row>, RowFileError>
  write : Path -> List<EnrichedRow> -> AsyncResult<Unit, RowFileError>

-- knowledge: what makes a row acceptable
module RowRules
  validate : Row -> Result<ValidRow, RowError>

-- knowledge: how a row is completed from stored data
module RowEnrichment
  enrich : Customers -> ValidRow -> Result<EnrichedRow, EnrichError>
```

`Customers` is a value: the handler read it before the rows were
enriched. The pure function over the rows is the only thing that knows
the order of validating and enriching:

```text
type ImportError =
  | Invalid of RowError
  | Unenriched of EnrichError

importRows :
  Customers -> List<Row> -> Result<List<EnrichedRow>, ImportError>
importRows customers rows =
  rows
    |> traverse (RowRules.validate >> mapError Invalid)
    |> bind (traverse (RowEnrichment.enrich customers
                         >> mapError Unenriched))
```

The handler reads the file and the customers, calls it, and writes:

```text
type ImportFailure =
  | Rejected of ImportError
  | FileFailed of RowFileError
  | Unavailable of DbError

handleImportFile :
  Pool -> Path -> Path -> AsyncResult<Unit, ImportFailure>
handleImportFile pool inPath outPath =
  both
      (RowFile.read inPath |> mapError FileFailed)
      (loadCustomers pool |> mapError Unavailable)
    |> bind (\(rows, customers) ->
         importRows customers rows |> mapError Rejected)
    |> bind (RowFile.write outPath >> mapError FileFailed)
```

Change the order, add a step, or run two steps concurrently, and only
these two functions change.

## Where the pipeline shape still applies

Nothing here argues against pipelines. A workflow **is** a sequence, and
writing it as one is right. The mistake is turning each stage into a
module. Stages are functions; modules are owners of knowledge.

See
[functional-designing-workflow-pipelines](../../functional-designing-workflow-pipelines/SKILL.md)
for how a pipeline is structured once the modules are right.

## Recognising it in review

- Module or directory names: `handlers`, `processors`, `steps`, `stages`
- Names with a sequence in them: `preValidate`, `postProcess`
- Two modules importing the same format constant
- A change to a field's meaning touching every stage
- The workflow function contains no logic yet all stages know its order
