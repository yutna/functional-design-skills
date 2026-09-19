# Routing Cases

Symptoms in the words someone would actually use, each with the skill
that should answer it. Read by `scripts/eval-routing.mjs`, which checks
that each expected skill's `name` and `description` contain enough of
those words to be found.

Format: `symptom -> expected-skill`, split on the last arrow.

```text
a one line change forced edits in six files -> functional-diagnosing-complexity
a change broke a module i never opened -> functional-diagnosing-complexity
nobody can estimate work in this area without reading everything -> functional-diagnosing-complexity
is this complexity in the problem or did we add it ourselves -> functional-diagnosing-complexity
is this complexity self-inflicted or is it in the problem -> functional-diagnosing-complexity
there is a flag that only exists because we mutate the record in place -> functional-managing-state-immutably
we are behind, should we take the shortcut this once -> functional-programming-strategically
the codebase gets a little worse with every change we make -> functional-programming-strategically
the reviewer said it is correct but they had to read it three times -> functional-deciding-what-matters
i cannot tell which parts of this module are the important ones -> functional-deciding-what-matters
this module exports twelve functions and the file is fifteen lines -> functional-designing-deep-modules
the interface is as complicated as the code behind it -> functional-designing-deep-modules
two modules both know the date format we use -> functional-hiding-information
callers have to know how this stores things internally -> functional-hiding-information
this wrapper just forwards every call to the one below -> functional-separating-layers
every caller does the same two lines after calling this -> functional-separating-layers
should i split this forty line function -> functional-splitting-and-joining-code
these two files always change together in the same commit -> functional-splitting-and-joining-code
a boolean parameter picks which behaviour this function performs -> functional-splitting-and-joining-code
adding a new payment provider means editing ten files -> functional-applying-solid-functionally
this function takes a whole service and uses one method -> functional-applying-solid-functionally
the code says UserRecord but the business says applicant -> functional-capturing-the-domain
customer means something different in billing and in shipping -> functional-capturing-the-domain
this record has five optional fields and only some combinations are legal -> functional-modeling-with-algebraic-types
should this be a record or a union -> functional-modeling-with-algebraic-types
this record has three booleans and a nullable date -> functional-making-illegal-states-unrepresentable
we have four nullable fields that only make sense in some combinations -> functional-making-illegal-states-unrepresentable
the code defends against a state that should never happen -> functional-making-illegal-states-unrepresentable
customer id and booking id are both plain strings -> functional-constraining-primitive-values
the same postcode check appears in three modules -> functional-constraining-primitive-values
should this be a branded type or just a plain map -> functional-choosing-types-or-plain-data
the admin screen lets each customer add their own form fields -> functional-choosing-types-or-plain-data
the field set varies per tenant so one type cannot cover it -> functional-choosing-types-or-plain-data
we wrap everything in types and it feels like paperwork now -> functional-choosing-types-or-plain-data
the report columns are whatever the user picked at request time -> functional-choosing-types-or-plain-data
the entity has a status column and every function branches on it -> functional-modeling-state-machines
a booking went backwards through its lifecycle somehow -> functional-modeling-state-machines
should one transaction cover the booking and the customer -> functional-enforcing-consistency-boundaries
two records have to stay in step and sometimes do not -> functional-enforcing-consistency-boundaries
the logic for confirming a booking is spread over three services -> functional-designing-workflow-pipelines
i am implementing a use case and do not know how to structure it -> functional-designing-workflow-pipelines
these two functions almost fit together but not quite -> functional-composing-functions
what order should the parameters go in -> functional-composing-functions
the domain function calls the database directly -> functional-parameterizing-dependencies
our tests need a mocking framework to run at all -> functional-parameterizing-dependencies
this function throws and the caller cannot tell -> functional-handling-errors-with-results
the form should report every invalid field not just the first -> functional-handling-errors-with-results
the error handling is longer than the code it protects -> functional-defining-errors-out-of-existence
callers have to handle a failure they can do nothing about -> functional-defining-errors-out-of-existence
testing a pricing rule needs a running database -> functional-separating-pure-core-from-shell
where should the http call go in all this -> functional-separating-pure-core-from-shell
two requests updated the same cart and one update was lost -> functional-managing-state-immutably
this function mutates the array its caller passed in -> functional-managing-state-immutably
the json field names have leaked into our business logic -> functional-crossing-io-boundaries
changing a domain type forces a database migration -> functional-crossing-io-boundaries
i was about to write an abstract factory here -> functional-translating-gof-patterns
how do i port this observer pattern to functional style -> functional-translating-gof-patterns
this loop builds up a total in a mutable variable -> functional-folding-over-data
i keep writing the same tree walk in different places -> functional-folding-over-data
the stack overflows on large input -> functional-using-recursion-and-laziness
we read the whole file into memory before processing it -> functional-using-recursion-and-laziness
i cannot think of a name for this, nothing fits -> functional-choosing-precise-names
this variable is called data and nobody knows what it holds -> functional-choosing-precise-names
these comments just restate what the code does -> functional-writing-useful-comments
how do i document what a caller has to guarantee -> functional-writing-useful-comments
how much should we test and at what level -> functional-testing-functional-code
our tests assert which functions were called -> functional-testing-functional-code
i want to check this pull request before merging -> functional-reviewing-functional-design
is this design any good, what should i look for -> functional-reviewing-functional-design
we have a legacy object oriented service to move to functional style -> functional-refactoring-toward-functional-design
this design cannot absorb the new requirement without a flag -> functional-refactoring-toward-functional-design
is a data class with no methods a smell in functional code -> functional-refactoring-toward-functional-design
the code smells but the types are fine, what move do i apply -> functional-refactoring-toward-functional-design
this function does two things in sequence, split the phases -> functional-splitting-and-joining-code
which refactoring moves still apply without classes -> functional-refactoring-toward-functional-design
a timeout left us unsure whether the payment went through -> functional-making-effects-reliable
we saved the booking but the event was never published -> functional-making-effects-reliable
the retry charged the customer twice -> functional-making-effects-reliable
we had an incident and the logs could not tell us why -> functional-designing-what-to-observe
what should we measure and what should we alert on -> functional-designing-what-to-observe
which of these skills applies to my problem -> functional-design
how much design does a one-off throwaway script need -> functional-design
the requirement is too vague to start designing -> functional-design
how do i start designing when the rules are not agreed yet -> functional-design
how much design can i do before the rules are decided -> functional-design
we were asked to design this but nobody agrees what it does -> functional-design
we have no type checker, plain javascript, how do tagged unions work -> functional-javascript
how do i make a nominal type in typescript -> functional-typescript
we use the effect library, how do i declare a service and a layer -> functional-typescript-effect
we use ts-pattern, how do i make the match exhaustive -> functional-typescript-ts-pattern
should this be react state or should i derive it during render -> functional-react-nextjs
how do i do this in elixir with ecto changesets -> functional-elixir-phoenix
this function had to become async just because one thing it calls is -> functional-separating-pure-core-from-shell
adding one lookup deep inside made every caller asynchronous -> functional-separating-pure-core-from-shell
which layer should this helper live in -> functional-separating-layers
a utility module imports a policy from a feature module -> functional-separating-layers
a business threshold ended up inside a database query -> functional-separating-pure-core-from-shell
why do i keep having to re-check a value that was already checked -> functional-constraining-primitive-values
i cannot test this legacy code and i cannot safely change it either -> functional-refactoring-toward-functional-design
how do i pin what this untested code currently does before moving it -> functional-refactoring-toward-functional-design
two requests read the same balance and one update was lost -> functional-managing-state-immutably
how do i test a lifecycle against random sequences of commands -> functional-testing-functional-code
which property testing library should we use -> functional-testing-functional-code
copying a large map on every update shows up in the profile -> functional-managing-state-immutably
updating one field three levels down means rebuilding every level above it -> functional-managing-state-immutably
should we adopt an effect system or just return a result -> functional-parameterizing-dependencies
is an effect library worth it for this project -> functional-parameterizing-dependencies
do we need an effect type or is a plain function enough -> functional-parameterizing-dependencies
every function returns an effect and the simple ones got harder to read -> functional-parameterizing-dependencies
what law should this combining operation obey -> functional-folding-over-data
is my merge operation associative and does it matter -> functional-folding-over-data
how do i check an abstraction obeys the laws i claimed for it -> functional-testing-functional-code
loading and error and data are three separate booleans -> functional-making-illegal-states-unrepresentable
our loading flag and our error flag can both be true at once -> functional-making-illegal-states-unrepresentable
a background task outlives the request that started it -> functional-making-effects-reliable
we spawn work and nobody waits for it -> functional-making-effects-reliable
the request returned but the work it started is still running -> functional-making-effects-reliable
who cancels this background job when nobody needs it any more -> functional-making-effects-reliable
two concurrent operations need to be cancelled together -> functional-managing-state-immutably
we fire off parallel work and one failure leaves the others running -> functional-managing-state-immutably
```
