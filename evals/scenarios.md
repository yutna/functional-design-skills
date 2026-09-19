# Scenarios

Thirty-nine problems in the form someone would actually bring them, each
with what a correct response has to contain. Paste one as the whole
prompt into an agent session with the pack installed.

The "must contain" lists are deliberately about substance, not wording.
An answer that reaches the same place by another route passes.

## 1. Optional fields that correlate

> Our `Shipment` type has a status string plus `trackingNumber`,
> `shippedAt`, `deliveredAt` and `failureReason`, all nullable. Reports
> keep breaking on combinations nobody expected. What should we do?

Must contain: a choice type with one case per state; the data moved
inside the case that owns it; the observation that consumers stop
checking. Should reach `functional-making-illegal-states-unrepresentable`.

## 2. A rule in three places

> The rule that a discount code is four to sixteen upper-case characters
> is implemented in the bookings module, the billing module and the admin
> importer. They have drifted.

Must contain: one owner for the rule; a wrapper type built through a
parser; downstream code receiving an already-valid value. Should reach
`functional-constraining-primitive-values`, possibly via `functional-hiding-information`.

## 3. Untestable pricing

> Testing our pricing rules needs a database, a clock and a fake mail
> server. The tests take four minutes and nobody runs them.

Must contain: separating the decision from the effects; the decision
becoming a pure function of values; capabilities passed as parameters;
tests with no infrastructure. Should reach
`functional-separating-pure-core-from-shell`.

## 4. How much design for a script

> I need a one-off script that reads a CSV, calls an API for each row and
> writes the results. It runs once, then I delete it. How should I
> structure it?

Must contain: recognition that this needs almost none of the pack.
A correct answer does **not** propose branded types, a workflow pipeline
or an aggregate. Should reach the calibration guidance in
`functional-design`.

## 5. A charge that may have happened

> Our checkout calls the payment provider, then writes the booking, then
> publishes an event. Last week a timeout meant we charged a customer and
> have no booking for it.

Must contain: a client-supplied command identity; an idempotent charge
adapter; state and event written in one transaction and relayed
afterwards. Should reach `functional-making-effects-reliable`.

## 6. A status column driving everything

> Every function in our booking module starts with a switch on
> `booking.status`. Adding a state means finding all of them.

Must contain: states as a choice type; transitions as functions taking
the specific source state; illegal transitions becoming unwriteable.
Should reach `functional-modeling-state-machines`.

## 7. A too-eager extraction

> A reviewer says my forty-line function should be split. I tried, and
> the six helpers each need four parameters from the parent.

Must contain: the observation that this is conjoined functions and worse
than the original; the criterion that an extracted part must be
independently meaningful; leaving it long if there is no natural
boundary. Should reach `functional-splitting-and-joining-code`.

## 8. Errors everywhere

> Our service has a try/catch in almost every function and the error
> handling is longer than the logic. Half of it just rethrows.

Must contain: an attempt to define errors away or mask them before
handling them; aggregation at the edge; `Result` for what remains.
Should reach `functional-defining-errors-out-of-existence`, then
`functional-handling-errors-with-results`.

## 9. A dashboard that is slow

> The appointment board reconstructs two hundred aggregates every thirty
> seconds and one bad legacy row blanks the whole screen.

Must contain: a view type for the screen; querying storage directly on
the read path; tolerating imperfect stored data rather than failing.
Should reach `functional-crossing-io-boundaries` and its read-model example.

## 10. A legacy service

> We have a 300-line `BookingService` class doing validation, pricing,
> saving and emailing. We want to move to a functional style without
> stopping feature work.

Must contain: incremental moves rather than a rewrite; one move per
commit with tests green between; an order that starts with types and
`Result` before extracting the pure decision. Should reach
`functional-refactoring-toward-functional-design`.

## 11. Naming failure

> I have a function that validates a booking, prices it and saves it, and
> I cannot think of a name for it.

Must contain: treating the naming difficulty as a design finding, not a
naming problem; splitting along the three jobs. Should reach
`functional-choosing-precise-names`, then `functional-splitting-and-joining-code`.

## 12. An incident nobody could diagnose

> A booking silently failed for three hours. The logs have "error"
> forty thousand times and none of them say which booking.

Must contain: deciding the questions before the fields; events as the
source; correlation identifiers carried from the edge; not logging
inside pure functions. Should reach `functional-designing-what-to-observe`.

## 13. Two ways to say customer

> Billing calls it a customer and means an account with tax details.
> Support calls it a customer and means a person. We have one shared
> `Customer` class with fields for both.

Must contain: two bounded contexts; a type per context holding only what
that context needs; translation at the border rather than a shared
model. Should reach `functional-capturing-the-domain`.

## 14. A wide dependency

> Our `confirmBooking` takes a `BookingRepository` with twenty-two methods and
> uses two. Every test needs a mocking framework.

Must contain: narrowing to the function types actually used; naming them
in the domain's words; the test becoming two one-line functions. Should
reach `functional-applying-solid-functionally` or `functional-parameterizing-dependencies`.

## 15. A schema as the domain model

> We generate our TypeScript types from the database schema and use them
> everywhere. Adding a nullable column changed forty files.

Must contain: two type families with a mapping between them; the domain
type freed from storage; the inward mapping returning a result. Should
reach `functional-crossing-io-boundaries`.

## 16. Functions that will not chain

> `parseUser` returns a Result, and `enrichUser` takes a User and also
> returns a Result. I cannot chain them without nested ifs, and I keep
> changing my mind about which argument goes first.

Must contain: composing fallible functions with bind rather than
nesting; totality as the precondition for composition; dependencies and
configuration first, data last. Should reach `functional-composing-functions`.

## 17. Correct but unreadable

> My module passes every test and two reviewers still said they could
> not tell what mattered in it. It exports fourteen names.

Must contain: deciding explicitly which facts a caller needs; hiding the
rest rather than merely de-emphasising it; the point that obviousness is
measured by the reader, not the author. Should reach
`functional-deciding-what-matters`.

## 18. Three nested loops

> I have three nested loops building a map of totals per customer per
> month with four mutable variables. It works and nobody dares touch it.

Must contain: recognising the accumulator as a fold; naming the
accumulator type first; a pure combining function; preferring a named
operation such as groupBy where one exists. Should reach
`functional-folding-over-data`.

## 19. A lost update

> Our in-memory cart service mutates the cart object. Under load, two
> adds sometimes produce one item, so we wrapped it in a lock.

Must contain: returning a new value instead of mutating; keeping the one
mutable cell in a single place; an atomic swap or compare-and-set rather
than a lock; readers needing no lock at all. Should reach
`functional-managing-state-immutably`.

## 20. What to look for before merging

> I am about to merge a pull request that adds a new module. What should
> I actually look for, and in what order?

Must contain: an ordered pass rather than ad hoc reading; types and
signatures before names and style; ranking findings by what they cost;
proposing the smallest fix. Should reach `functional-reviewing-functional-design`.

## 21. Three layers, one vocabulary

> Our API handler calls a service that calls a repository. All three
> have the same method names and pass the same types. Adding one field
> means editing three files.

Must contain: each layer must change the abstraction; deleting
pass-throughs; the test for whether a layer earns its place. Should
reach `functional-separating-layers`.

## 22. About to write a strategy interface

> I need to support CSV, JSON and PDF export. I was going to define an
> ExportStrategy interface with three implementations.

Must contain: passing a function instead of defining an interface; or a
choice type if the set of formats is fixed; no class hierarchy. Should
reach `functional-translating-gof-patterns`.

## 23. Does this need comments

> My team says my code needs more comments. I think it is
> self-documenting. Who is right?

Must contain: both are half right; a comment must carry what the code
cannot; interface comments stating what a caller must guarantee; the
suggestion to write them before the implementation. Should reach
`functional-writing-useful-comments`.

## 24. Interchangeable ids in TypeScript

> In TypeScript, how do I stop BookingId and CustomerId being swapped by
> accident, and how do I make sure a switch handles every case?

Must contain: branded types with a parser as the only constructor;
discriminated unions; exhaustiveness through `never`; strict compiler
settings. Should reach `functional-typescript`.

## 25. Effect services and layers

> We use the Effect library. Where do I declare a dependency and where
> do I provide it? Should my pure pricing function return an Effect?

Must contain: the service declared by the domain, provided by a layer at
the composition root; pure functions staying plain rather than being
wrapped; running the effect only at the edge. Should reach
`functional-typescript-effect`.

## 26. otherwise at the end of a match

> We use ts-pattern. My match ends with `.otherwise()` and a colleague
> said that is wrong. Is it?

Must contain: `.exhaustive()` instead, because the compile error is the
thing of value; the narrow cases where `.otherwise()` is legitimate.
Should reach `functional-typescript-ts-pattern`.

## 27. Unions without a type checker

> Plain JavaScript, no TypeScript and no plans for it. How do I do a
> union type and be sure I handled every case?

Must contain: one tag key used consistently; construction only through
constructor functions; a dispatch whose default throws; a test driven by
the list of tags. Should reach `functional-javascript`.

## 28. Three useState and a flicker

> My component has isLoading, error and data as three useState, plus a
> useEffect that sets data from a fetch. The screen flickers.

Must contain: one state union instead of three booleans; not deriving
state inside an effect; moving the fetch to the edge. Should reach
`functional-typescript-react`.

## 29. Ecto schemas as the domain

> In Elixir, our Ecto schemas are the domain model everywhere, and each
> context reaches into other contexts' schemas.

Must contain: schemas as boundary artefacts mapped into structs with
enforced keys; contexts as bounded contexts that do not alias each
other's schemas; translation at the edge. Should reach
`functional-elixir-phoenix`.

## 30. Customers define their own form fields

> Customers configure their own intake forms in our admin screen: they
> add fields, name them, pick a type and mark them required. Our
> modelling guide says to make illegal states unrepresentable. How do we
> type the submitted answers?

Must contain: the field set is not known when the code is compiled, so
there is no closed set of cases to model; a fully typed envelope
(template id, version, submitter, timestamp) around a generic answers
map; the schema stored as data, versioned, with the version recorded on
each stored submission; the costs accepted explicitly — one boundary
parse producing a distinct type, key constants in one module, named
accessors, a coverage test per dispatch site.

Must **not** contain: a branded type per customer field, or a record with
every field optional. Should reach `functional-choosing-types-or-plain-data`.

## 31. Wrapper types feel like paperwork

> In our TypeScript billing module we now have twelve branded id types --
> `CustomerId`, `InvoiceId`, `LineItemId` and so on. Every exported
> signature is three lines long. Someone suggested we drop them all and
> use plain strings with good parameter names, since it is all the same
> at runtime anyway. Should we?

Must contain: no. These ids appear in exported signatures and cross
module boundaries, which is exactly the case the wrapper exists for, and
swapping two string ids is a bug the compiler currently prevents. None of
the facts that open the generic route applies here: the set of id kinds
is closed, developers own it, and code branches on which one it is.
Verbosity is not one of those facts. The real fix for a three-line
signature is a parameter object or a narrower dependency, not deleting
the types.

The scenario is a test of the tiebreaker's direction. An answer that
takes the generic route because the caller said it feels heavy is a
failure even if it is otherwise well argued. Should reach
`functional-choosing-types-or-plain-data` or
`functional-constraining-primitive-values`.

## 32. Everyone says this needs refactoring

> This module has an `isPriced` boolean, a `priceCalculatedAt` field
> nobody reads, and a `recalculatePricing` function that returns early
> when `isPriced` is set. Everyone agrees it needs refactoring. Where do
> we start?

Must contain: ask whether the complexity is necessary before choosing a
refactor. State the requirement in the domain's words -- a booking gets a
price before it can be shipped -- and note that none of the three things
above appears in it. They exist because pricing mutates in place, so
pricing a validated booking into a new priced value deletes the boolean and
the early return rather than tidying them. The unread timestamp is
deleted or given a reader.

Must contain the explicit point that extracting the guard into a
well-named function would preserve the complexity permanently. Should
reach `functional-diagnosing-complexity`.

## 33. A reviewer wants behaviour in our records

> Our reviewer flagged our domain records as a code smell -- just fields,
> no behaviour -- and wants the behaviour moved into them. Is that right?

Must contain: no, not in a functional design. Data is inert by design and
behaviour lives in functions over it, so a record of fields is the
intended shape rather than a defect. Several symptoms that are real in
an object-oriented codebase do not survive the translation, and this is
one of them.

Must contain the redirection to what is worth checking instead: whether
the record can only be built through a constructor that enforces its
invariants, and whether any of its fields can hold a combination the
business forbids. Should reach `functional-refactoring-toward-functional-design`.

## 34. A red flag against a stated convention

> Review this container for me. Our project instructions say wrapping
> every component in `memo()` with primitive props is our default, and
> point at a rule file for the reasoning. The container wraps one hook
> call in two `useCallback`s and exports `memo(Container)`.

Must contain: the pack's memoisation rule is not a finding here, because
the codebase states the convention and gives a reason. Read the reason
before doubting it. A red flag is a place to look, and a deliberate
convention looks identical to a defect from outside.

Must contain, if the answer still doubts the convention: measure the
claim and take the numbers to whoever owns the convention, as a separate
conversation. Not as a review finding, and not as an unrequested change.

Fails if the answer reports the memoisation as a finding, proposes
removing an existing `useCallback` or `memo()`, or hands the precedence
question back to the author as work. Should reach
`functional-reviewing-functional-design`.

## 35. A one-file fix in a codebase with recorded debt

> `formatAdmissionDate` returns "Invalid Date" when the admission has no
> discharge date. The repo has thousands of lint findings grandfathered
> into a baseline that nobody is funded to clear, and every change goes
> through review by another engineer. Reading it I noticed three siblings
> in the same folder with the same class of problem, and a 400-line
> `helpers.ts` holding what look like business rules. What should my
> merge request contain?

Must contain: the calibration row chosen before anything else, and the
signature named as the cause rather than the formatter. The fix stays in
the ticketed function and whatever the compiler surfaces in its callers.

Must contain the exclusions, each with its reason: the siblings are an
unrelated refactor that would hide the real edit, the large helper is
read but not edited, and the baseline is not regenerated. What is left
goes in the merge request description as what the right design is and why
it is not in this diff.

Must contain that the grandfathered findings are the team's stated
position, not a backlog to start clearing here.

Fails if the answer edits a sibling file, leaves a `TODO` in a file it is
not otherwise changing, or proposes a redesign larger than the ticket.
Should reach `functional-programming-strategically`.

## 36. A ticket that has not been decided yet

> The ticket says "add reporting to the clinic dashboard" and nothing
> else. The product owner is on leave for a fortnight. I have been asked
> to get started. How should I model this?

Must contain: a refusal to model, and the reason — nobody can yet say
one rule a report must follow, with an example it accepts and one it
refuses, so the task sits in no row of the calibration table.

Must contain what to produce instead of types: the rules with worked
examples, and the list of questions nobody can answer yet with the owner
of each. The absent product owner is the answer to one of those
questions, not a reason to guess past them.

Must contain that this is not design work and that the pack does not
cover it. Naming `functional-capturing-the-domain` for the vocabulary and the
open questions is correct; presenting it as the whole answer is not.

Fails if the answer proposes a type, a module boundary, or a workflow;
if it invents the reporting rules and calls them assumptions to confirm
later; or if it tells the author to wait a fortnight rather than saying
what to produce now.

Should reach `functional-design`, and the routing check does not show
that it will: "how should I model this" scores hardest for the
modelling skills, which is the pull the readiness check exists to
resist. If a modelling skill is reached first, the answer must still
refuse to model. That is the part of this scenario no keyword check
can stand in for.

## 37. A decided problem that must not be gated

> We are adding a new module for clinician availability. A clinician
> publishes weekly availability; a slot cannot be published inside an
> existing booking; publishing a week replaces the previous one for that
> week. Where do I start?

Must contain: the rule stated back in one line with an example each way,
then straight into the design loop. Row four of the calibration table,
so the loop is worth its cost.

Fails if the answer stops to ask for written acceptance criteria, asks
who owns the questions, or otherwise runs the readiness check as a
gate when the person asking has just stated the rules in the request.
The check is thirty seconds and it has already passed.

## 38. Work that outlived the request

> Our export endpoint kicks off a job and returns 202 straight away.
> When a user closes the tab and retries, we end up with two exports
> running, and if the pod restarts mid-export the file is half written
> and nothing retries it. We also cannot tell how many exports are in
> flight.

Must contain: the observation that the spawned work has neither an
owner that waits for it nor a handle that cancels it, and that the
three symptoms share that one cause; an identity on the command so the
retry is recognised rather than duplicated; the half-written file
treated as an idempotency question at the adapter rather than a
cleanup script. Should reach `functional-making-effects-reliable`,
possibly via `functional-managing-state-immutably` for the ownership
mechanics.

## 39. A GenServer that became the bottleneck

> We keep each clinic's daily schedule in a GenServer so lookups are
> fast. It started as one process, then we added the waiting list to
> it, then the room assignments. Now every booking in the building
> queues behind one mailbox, and when it crashes we lose all three
> and the restart comes back empty.

Must contain: the observation that three things were put in one
process because each needed state, not because each needed to fail
independently; that the process is serialising work that has no reason
to be serialised; that state the database already has should not be
the process's to lose; and that the right question is what should
still be working after this one dies. Should reach
`functional-elixir`.
