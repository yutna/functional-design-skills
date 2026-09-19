# Split or Join: A Procedure

## The procedure

1. Write one sentence describing each piece. If a single sentence without
   "and" covers both, that is evidence for joining.
2. List what each piece must know. Overlapping knowledge is the strongest
   argument for joining; disjoint knowledge for splitting.
3. List who calls each. Identical caller sets argue for joining.
4. Ask what would change each. Different reasons to change argue for
   splitting, and outweigh similar code.
5. If still undecided, write the interface that would exist between them
   after the split. If that interface is more than three parameters, or
   needs a shared type invented for the purpose, do not split.
6. Prefer the option that leaves fewer things visible to callers.

## Worked case: the duplication trap

Two functions look nearly identical:

```text
priceBooking   : Catalogue -> Booking -> Priced
priceQuote   : Catalogue -> Quote -> Priced
```

The bodies are ninety per cent the same. The instinct is to join them
behind a flag or a shared generic. Apply step 4: what would change each?
Bookings are priced with customer contract rates; quotes are priced at list
price and must stay stable for thirty days. Those rules will diverge, and
they answer to different parts of the business.

Verdict: keep apart. Extract only the genuinely shared part, if it is a
meaningful abstraction on its own:

```text
applyTreatmentRates : Rates -> List<BookedTreatment> -> Priced
```

Now each function is a short expression of its own rule over a shared
primitive. The similar-looking code that remains is not duplication; it
is two rules that happen to rhyme today.

The opposite mistake is equally common: two functions that both parse the
same file format, with slightly different bodies. There, step 2 finds
overlapping knowledge, and joining is right.

**The test that separates the two cases:** if the requirement changed,
would both need the same edit? Same edit means join. Different edits mean
keep apart, however similar the code looks.

## Worked case: the over-eager extraction

A workflow function is forty lines. Someone extracts six helpers, each
five lines, each taking four parameters from the parent's scope.

Apply step 5. The interfaces are four parameters wide, and three of the
helpers need the same three values. The extraction created a shared
context that did not exist before. The parent is now three lines of
calls, and understanding any helper requires reading the parent.

Verdict: this is conjoined functions. Reverse it, then look for the one
real boundary in those forty lines. Usually there is one: a chunk that
takes one input, produces one output, and could be named after a domain
concept. Extract that, and leave the rest.

## Worked case: the special-general mixture

A `formatMoney` utility grows a parameter `forInvoicePdf: Boolean`,
because invoices need a non-breaking space before the currency symbol.

Apply step 1: two sentences, so two things. Apply step 3: the flag has
one caller. Verdict: split, with the special case living beside its
caller.

```text
formatMoney : Money -> String                -- general, no flags
formatMoneyForInvoice : Money -> String      -- lives in the invoice module
```

The rule to remember: special cases move outward, towards the feature
that needs them. They never move inward into general code.

## Signals summary

| Observation                     | Weight               |
| ------------------------------- | -------------------- |
| Same non-obvious knowledge      | Strong: join         |
| Identical caller set            | Strong: join         |
| One sentence covers both        | Moderate: join       |
| Would need the same edit        | Strong: join         |
| Different reasons to change     | Strong: split        |
| One general, one special        | Strong: split        |
| Only one is called from outside | Moderate: split      |
| Similar-looking bodies          | No weight on its own |
| One is long                     | No weight at all     |
