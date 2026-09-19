# Migration Moves

Each move is small, behaviour-preserving, and independently valuable.
Apply in order where possible; each makes the next easier.

## 1. Wrap primitives in domain types

**Mechanics.** Create the wrapper and its parser in one module. Change
one function's signature to take the wrapper. Follow the compile errors
or test failures outward, converting at each call site, until the
conversions have moved to the boundary.

**Verify.** Tests pass at each step; the parser has its own tests.

**Payoff.** Transposed arguments become impossible; the format rule gets
one owner.

## 2. Replace status strings with choice types

**Mechanics.** Define the choice type. Add conversions to and from the
string at the storage and transport boundaries. Replace comparisons
against literals, one module at a time, starting with the one that owns
the concept.

**Verify.** A test that every stored status value maps to a case, and
that unknown values produce a named error rather than a default.

**Payoff.** The spelling stops leaking; exhaustive matching starts
listing the places that must change.

## 3. Collapse correlated optionals into cases

**Mechanics.** Write the choice type beside the record. Add a function
from the old record to the new type, returning `Result`, and one back.
Move consumers over one at a time. Delete the old fields last.

**Verify.** The conversion functions round-trip for every legal
combination, and reject the illegal ones.

**Payoff.** The largest single reduction in representable states, and
every consumer loses its checks.

## 4. Return `Result` instead of throwing

**Mechanics.** Work outward from the leaves. Change the innermost
function to return `Result`; its caller catches nothing and binds
instead. Stop at the module boundary, and convert once there if the rest
of the system still expects exceptions.

**Verify.** No `catch` remains inside the converted region; the boundary
conversion has a test per error case.

**Payoff.** Failures become visible in signatures, which is what makes
the rest of the migration reviewable.

## 5. Pass the clock, random, and identifiers in

**Mechanics.** Add a parameter for the value, defaulting to the ambient
source at the outermost call site only. Remove the ambient calls from the
inner functions. Then remove the default.

**Verify.** The function's tests no longer need to freeze anything.

**Payoff.** The functions become deterministic, which unlocks property
testing and parallel execution.

## 6. Turn a service parameter into function types

**Mechanics.** For each service member the function actually uses,
declare a function type in the domain module. Change the signature to
take those. At the call site, pass method references bound to the
service.

**Verify.** The tests replace the mock with plain functions.

**Payoff.** The dependency narrows from twenty operations to two, and the
domain stops importing the service's type.

## 7. Extract the pure decision from the effects

**Mechanics.** Inside one function, separate the reads at the top, the
decision in the middle, and the writes at the bottom. Then lift the
middle into its own function taking values and returning a decision or
events. The original function becomes the shell.

**Verify.** The extracted function has no imports of infrastructure, and
its tests need no setup.

**Payoff.** The rule becomes testable, reviewable, and reusable. This is
the move that most changes how the code feels.

## 8. Give the workflow stage types

**Mechanics.** Rename the input type to `UnvalidatedX`. Add
`ValidatedX`, initially a copy. Change the validation step to return it,
and the next step to require it. Repeat for each stage.

**Verify.** No step accepts the raw input type any more.

**Payoff.** Steps can no longer receive unprepared data, and re-checks
can be deleted.

## 9. Add a boundary mapping and split the DTO

**Mechanics.** Copy the current type into a `...Dto`, keeping every
compromise. Write `toDto` and `fromDto`, with the latter returning
`Result`. Point serialisation at the DTO. Then start improving the
domain type freely.

**Verify.** A round-trip property test, plus stored samples of every
historical payload.

**Payoff.** The domain type is released from the schema, which unblocks
moves 1 to 3 wherever they were stuck.

## 10. Make the aggregate opaque

**Mechanics.** Stop exporting the constructor and the fields. Export the
operations callers actually need, plus the accessors that are genuinely
part of the interface. Fix the call sites the compiler or tests find.

**Verify.** No code outside the module constructs or mutates one.

**Payoff.** The invariants become enforceable, and the module becomes
deep.

## Booking and pacing

Moves 1 to 4 are local and can be done in any module at any time. Moves 5
to 7 need 4 to be useful. Moves 8 to 10 are module-scale and are worth
scheduling into work you are doing anyway.

Do not attempt more than one move per commit. The value of this list is
that each row is separately reviewable, and that property is lost the
moment two are combined.

## Characterisation tests

Where the existing behaviour is not covered, write tests that record what
the code currently does, including the parts that look wrong. They are
scaffolding: they make the moves safe, and they can be replaced by proper
tests once the design is right.
