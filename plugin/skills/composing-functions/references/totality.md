# Making a Function Total

A total function returns a value of its declared output type for every
value of its declared input type. Every deviation is a promise the
signature makes and the body breaks.

## Find the partiality

Ask four questions of any function:

1. Does it throw, for any input the type permits?
2. Can it return null, undefined, or a sentinel value?
3. Does it have inputs for which the answer is meaningless, and it
   returns something anyway?
4. Can it fail to terminate?

Anything answered yes is a gap between the signature and the behaviour.

## Two repairs

**Narrow the input** so the bad case cannot arrive.

```text
head : List<A> -> A                  -- partial: empty list
head : NonEmptyList<A> -> A          -- total
```

Choose this when the caller can produce the narrower type naturally, or
already has one. It removes the failure from the system rather than
moving it, and every downstream caller stops handling a case that can no
longer happen.

**Widen the output** so the bad case has a value.

```text
parseAge : String -> Integer         -- partial: throws
parseAge : String -> Result<Age, AgeError>   -- total
```

Choose this when the input genuinely comes from outside and can be wrong.
The failure becomes data, and the caller decides.

## Choosing between them

| Situation                                 | Repair       |
| ----------------------------------------- | ------------ |
| Input is produced inside the domain       | Narrow       |
| Input arrives from a user or a system     | Widen        |
| The failure is a business outcome         | Widen, named |
| The failure means a programming bug       | Narrow       |
| Many callers already hold the narrow type | Narrow       |
| The narrow type would be awkward to build | Widen        |

A third possibility is often best of all: **define the failure out of
existence** by changing what the operation means, so the awkward case
becomes ordinary. See
[defining-errors-out-of-existence](../../defining-errors-out-of-existence/SKILL.md).

## Totality and the type's honesty

Totality is about the declared type, not about never failing. These are
all total:

```text
divide : Integer -> Integer -> Result<Integer, DivideByZero>
find : Key -> Map<Key, V> -> Option<V>
save : Booking -> AsyncResult<Unit, SaveError>
```

Each says what can happen. A caller that ignores the `Result` is making a
visible choice, and reviewers and tooling can see it.

## Effects break totality too

A function that reads the clock is not total in the sense that matters: it
returns different values for the same input. The same goes for reading
global state, generating randomness, and performing I/O. The repair is
the same shape: make the hidden input an explicit parameter.

```text
isExpired : Quote -> Boolean            -- reads the clock inside
isExpired : Instant -> Quote -> Boolean -- total, and testable
```

See
[parameterizing-dependencies](../../parameterizing-dependencies/SKILL.md).

## Where partial functions are tolerable

Inside a module, in a function that is not exported, where the caller is
the module itself and the invariant is proven a few lines above. Even
then, prefer to encode the invariant in a type if the module is going to
grow. Never across a module boundary: there the signature is the contract
and there is no context to rely on.

## Verifying totality

- Property test: for arbitrary inputs of the declared type, the function
  returns a value and does not raise.
- Review: search for `throw`, `raise`, `!`, `as`, and null returns in
  exported functions.
- Types: turn on the checks the language offers for exhaustiveness and
  for nullability, and treat their warnings as errors.
