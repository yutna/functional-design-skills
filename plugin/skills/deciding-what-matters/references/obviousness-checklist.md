# Obviousness Checklist

Run this over a diff or a module. Each item is a question with a concrete
failure and a concrete fix. Stop at the first "no" and fix it before
continuing; obscurity compounds.

## At the interface

1. **Can a caller use this without reading the implementation?**
   Failure: the doc says "see the source for the accepted formats".
   Fix: put the accepted formats in a type, or list them in the comment.

2. **Does the signature state every way this can fail?**
   Failure: a function returning `PricedBooking` that throws on a missing
   treatment. Fix: return `Result<PricedBooking, PricingError>`.

3. **Does the signature state everything it touches?**
   Failure: a "pure-looking" function that writes an audit row.
   Fix: return the intent, and let the shell perform the write.

4. **Are two adjacent parameters of the same type distinguishable?**
   Failure: `transfer(a: String, b: String)`. Fix: distinct types, or a
   single record with named fields.

5. **Is every exported name something a caller should call?**
   Failure: `_internalRound` exported for tests. Fix: test through the
   interface, or promote the helper to its own module.

## At the call site

1. **Does the call read like the sentence a domain expert would say?**
   Failure: `handle(o, true, null, ctx)`. Fix: named record argument,
   choice types instead of booleans.

2. **Can a reader tell what happens next?**
   Failure: a call that emits an event with no indication of the handler.
   Fix: a comment at the emit site naming the handlers, or an explicit
   pipeline.

3. **Is the order of these calls enforced by something?**
   Failure: `validate(o); price(o)` where the second silently misbehaves
   alone. Fix: chain the types so the booking is the only thing that
   compiles.

## Inside the implementation

1. **Does each name say what the value is, not what shape it has?**
   Failure: `list2`, `tmpMap`, `data`. Fix: name the concept.

2. **Is any value doing two jobs?**
   Failure: a variable reused as both raw input and normalised output.
   Fix: two names.

3. **Is there a fact here that the reader cannot derive?**
   Failure: a magic constant, an ordering assumption, a workaround for
   another system's bug. Fix: a comment stating why, not what.

4. **Would a reader expect this to be pure, and it is not?**
   Failure: a `format` function that caches into module state.
   Fix: remove the cache, or name the function so the surprise is gone.

## Across the module

1. **Is there exactly one way to do each recurring thing?**
   Failure: two error mechanisms in one layer. Fix: pick one, convert at
   the boundary.

2. **Do similar things look similar and different things look different?**
   Failure: `getUser` throws while `fetchBooking` returns `Result`.
   Fix: unify, or rename so the difference is visible.

3. **Could the module's purpose be stated in one sentence without "and"?**
   Failure: "handles pricing and notification". Fix: split.

## Final question

Hand the diff to someone who did not write it and ask them to say what it
does. Every hesitation is a defect in the code, not in the reader. Record
what they hesitated at, fix that, and do not argue.
