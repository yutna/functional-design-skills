# Pulling Complexity Downward

When complexity is unavoidable, decide which side of an interface it
lives on. The default is: the implementation, not the callers.

The reason is arithmetic. A module has one implementation and many
callers, now and in future. Complexity in the implementation is paid once
by one author; complexity in the interface is paid by every caller, every
reader, and every future call site.

## Procedure

1. Name the complexity precisely. "Callers must remember to normalise the
   phone number before comparing."
2. Count the callers, including the ones that do not exist yet but
   obviously will.
3. Ask whether **all** callers want the same handling.
   - Yes: pull it down. The module does it, and the interface loses a
     rule.
   - No: do not pull it down yet; go to step 4.
4. Ask whether the callers differ on the outcome or only on the details.
   - Differ on outcome: this is genuinely two operations. Expose two
     functions with clear names, not one with a flag.
   - Differ on details only: pull the common part down, and let callers
     supply the varying part as a function or a value.
5. Re-check the interface. It should be smaller than before, not the same
   size with different words.

## What "down" looks like

```text
-- before: three rules in the interface, enforced by convention
-- 1. call normalisePhone first
-- 2. compare with compareNormalised, not equality
-- 3. a missing country code means the default region
normalisePhone : String -> String
compareNormalised : String -> String -> Boolean

-- after: no rules in the interface
type PhoneNumber = PhoneNumber of String   -- always normalised
parsePhone : Region -> String -> Result<PhoneNumber, PhoneError>
-- equality on PhoneNumber is now correct by construction
```

The implementation got harder: it must normalise, and it must own the
region default. The interface lost three rules that every caller had to
know, and the class of bugs where someone compared raw strings is gone.

## Limits

Pulling down is wrong when:

- **Callers genuinely disagree.** Absorbing a decision half the callers
  reject produces a mode flag, which is worse than either choice.
- **It would leak knowledge into the wrong module.** If absorbing means
  the lower module must learn about the caller's domain, the complexity
  is being pushed sideways, not down. Find the module that owns the
  knowledge instead.
- **It hides a decision the caller must make.** Silently choosing a
  currency, a timezone, or a rounding rule on the caller's behalf trades
  visible complexity for an invisible bug.
- **It makes the module unbounded.** If absorbing every caller's needs
  means the module grows without limit, the abstraction is wrong.

## The configuration test

An option parameter is complexity moved upward. Before adding one, ask:

- Do two real callers need different values today? If not, delete the
  option and pick the value.
- Can the module determine the right value itself from what it already
  has? If so, do that.
- Is the option a symptom of two operations wearing one name? If so,
  split into two named functions.

Every option removed is a decision made once instead of at every call
site, and one fewer combination to test.
