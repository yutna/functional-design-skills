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

## Order and pacing

Moves 1 to 4 are local and can be done in any module at any time. Moves 5
to 7 need 4 to be useful. Moves 8 to 10 are module-scale and are worth
scheduling into work you are doing anyway.

Do not attempt more than one move per commit. The value of this list is
that each row is separately reviewable, and that property is lost the
moment two are combined.

## Move 0: pin what it does now

Every move above says "tests green between each", and in the code this
skill is for, there are no tests. That is not an obstacle to work
around; it is the first move, and it has its own technique.

### Characterisation tests

A characterisation test records what the code **currently does**,
including the parts that look wrong. It is not a specification and it
does not assert anything is correct. Its only job is to fail if a move
changed behaviour.

The mechanics, which are different from writing an ordinary test:

1. Call the code with some input and assert something deliberately
   false — `expect(result).toBe("?")`.
2. Run it. The failure message tells you what the value actually is.
3. Paste that in as the expectation.
4. Repeat until the branches you are about to touch are covered.

Guessing what the code should return wastes the afternoon; letting it
tell you takes minutes. Cover the inputs the moves will pass through,
not every input — these are scaffolding, and once the design is right
most of them are replaced by tests that assert a rule instead of a
recording.

Two things to record that people skip: the failure paths, which is
where the surprising behaviour lives, and anything the code writes
besides its return value, since a move that changes what gets written
is a behaviour change too.

### Finding somewhere to stand

Characterisation needs the code to be callable without its world. When
it is not, the question is where behaviour can be changed **without
editing that code in place** — the clock it reads, the function it
calls, the module it imports. Every such point is somewhere a test can
stand.

In functional code the answer is usually one of three, in order of
preference:

| What blocks the test         | Where to stand                    |
| ---------------------------- | --------------------------------- |
| It reads the clock or random | Add the parameter; default it     |
| It calls storage directly    | Take the one function it calls    |
| It is wired at module load   | Move the wiring to a caller       |

All three are move 5 or move 6 applied early, and each is small enough
to review on its own. Prefer the parameter with a default: existing
callers keep compiling, so the change is additive and the test gets
what it needs in the same commit.

When even that is too invasive to do first, two fallbacks that touch
nothing:

- **Write the new behaviour beside the old** as a separate function and
  call it from the one place that needs it, leaving the original
  untouched. Nothing existing can break, because nothing existing
  changed.
- **Wrap the call site** rather than the function, so the old code runs
  unchanged inside something you can test around.

Both leave the original in place, which is the point: they buy a tested
path in without a move that cannot be verified. Neither is a resting
place — the original still owes every move above — but they turn "this
cannot be refactored safely" into an ordered list of commits.
