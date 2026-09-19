# Routing Cases

Symptoms in the words someone would actually use, each with the skill
that should answer it. Read by `scripts/eval-routing.py`, which checks
that each expected skill's `name` and `description` contain enough of
those words to be found.

Format: `symptom -> expected-skill`, split on the last arrow.

```text
a one line change forced edits in six files -> diagnosing-complexity
a change broke a module i never opened -> diagnosing-complexity
nobody can estimate work in this area without reading everything -> diagnosing-complexity
is this complexity in the problem or did we add it ourselves -> diagnosing-complexity
is this complexity self-inflicted or is it in the problem -> diagnosing-complexity
there is a flag that only exists because we mutate the record in place -> managing-state-immutably
we are behind, should we take the shortcut this once -> programming-strategically
the codebase gets a little worse with every change we make -> programming-strategically
the reviewer said it is correct but they had to read it three times -> deciding-what-matters
i cannot tell which parts of this module are the important ones -> deciding-what-matters
this module exports twelve functions and the file is fifteen lines -> designing-deep-modules
the interface is as complicated as the code behind it -> designing-deep-modules
two modules both know the date format we use -> hiding-information
callers have to know how this stores things internally -> hiding-information
this wrapper just forwards every call to the one below -> separating-layers
every caller does the same two lines after calling this -> separating-layers
should i split this forty line function -> splitting-and-joining-code
these two files always change together in the same commit -> splitting-and-joining-code
a boolean parameter picks which behaviour this function performs -> splitting-and-joining-code
adding a new payment provider means editing ten files -> applying-solid-functionally
this function takes a whole service and uses one method -> applying-solid-functionally
the code says UserRecord but the business says applicant -> capturing-the-domain
customer means something different in billing and in shipping -> capturing-the-domain
this record has five optional fields and only some combinations are legal -> modeling-with-algebraic-types
should this be a record or a union -> modeling-with-algebraic-types
this record has three booleans and a nullable date -> making-illegal-states-unrepresentable
we have four nullable fields that only make sense in some combinations -> making-illegal-states-unrepresentable
the code defends against a state that should never happen -> making-illegal-states-unrepresentable
customer id and booking id are both plain strings -> constraining-primitive-values
the same postcode check appears in three modules -> constraining-primitive-values
should this be a branded type or just a plain map -> choosing-types-or-plain-data
the admin screen lets each customer add their own form fields -> choosing-types-or-plain-data
the field set varies per tenant so one type cannot cover it -> choosing-types-or-plain-data
we wrap everything in types and it feels like paperwork now -> choosing-types-or-plain-data
the report columns are whatever the user picked at request time -> choosing-types-or-plain-data
the entity has a status column and every function branches on it -> modeling-state-machines
a booking went backwards through its lifecycle somehow -> modeling-state-machines
should one transaction cover the booking and the customer -> enforcing-consistency-boundaries
two records have to stay in step and sometimes do not -> enforcing-consistency-boundaries
the logic for confirming a booking is spread over three services -> designing-workflow-pipelines
i am implementing a use case and do not know how to structure it -> designing-workflow-pipelines
these two functions almost fit together but not quite -> composing-functions
what order should the parameters go in -> composing-functions
the domain function calls the database directly -> parameterizing-dependencies
our tests need a mocking framework to run at all -> parameterizing-dependencies
this function throws and the caller cannot tell -> handling-errors-with-results
the form should report every invalid field not just the first -> handling-errors-with-results
the error handling is longer than the code it protects -> defining-errors-out-of-existence
callers have to handle a failure they can do nothing about -> defining-errors-out-of-existence
testing a pricing rule needs a running database -> separating-pure-core-from-shell
where should the http call go in all this -> separating-pure-core-from-shell
two requests updated the same cart and one update was lost -> managing-state-immutably
this function mutates the array its caller passed in -> managing-state-immutably
the json field names have leaked into our business logic -> crossing-io-boundaries
changing a domain type forces a database migration -> crossing-io-boundaries
i was about to write an abstract factory here -> translating-gof-patterns
how do i port this observer pattern to functional style -> translating-gof-patterns
this loop builds up a total in a mutable variable -> folding-over-data
i keep writing the same tree walk in different places -> folding-over-data
the stack overflows on large input -> using-recursion-and-laziness
we read the whole file into memory before processing it -> using-recursion-and-laziness
i cannot think of a name for this, nothing fits -> choosing-precise-names
this variable is called data and nobody knows what it holds -> choosing-precise-names
these comments just restate what the code does -> writing-useful-comments
how do i document what a caller has to guarantee -> writing-useful-comments
how much should we test and at what level -> testing-functional-code
our tests assert which functions were called -> testing-functional-code
i want to check this pull request before merging -> reviewing-functional-design
is this design any good, what should i look for -> reviewing-functional-design
we have a legacy object oriented service to move to functional style -> refactoring-toward-functional-design
this design cannot absorb the new requirement without a flag -> refactoring-toward-functional-design
is a data class with no methods a smell in functional code -> refactoring-toward-functional-design
the code smells but the types are fine, what move do i apply -> refactoring-toward-functional-design
this function does two things in sequence, split the phases -> splitting-and-joining-code
which refactoring moves still apply without classes -> refactoring-toward-functional-design
a timeout left us unsure whether the payment went through -> making-effects-reliable
we saved the booking but the event was never published -> making-effects-reliable
the retry charged the customer twice -> making-effects-reliable
we had an incident and the logs could not tell us why -> designing-what-to-observe
what should we measure and what should we alert on -> designing-what-to-observe
which of these skills applies to my problem -> functional-design
how much design does a one-off throwaway script need -> functional-design
we have no type checker, plain javascript, how do tagged unions work -> functional-javascript
how do i make a nominal type in typescript -> functional-typescript
we use the effect library, how do i declare a service and a layer -> functional-typescript-effect
we use ts-pattern, how do i make the match exhaustive -> functional-typescript-ts-pattern
should this be react state or should i derive it during render -> functional-react-nextjs
how do i do this in elixir with ecto changesets -> functional-elixir-phoenix
this function had to become async just because one thing it calls is -> separating-pure-core-from-shell
adding one lookup deep inside made every caller asynchronous -> separating-pure-core-from-shell
which layer should this helper live in -> separating-layers
a utility module imports a policy from a feature module -> separating-layers
a business threshold ended up inside a database query -> separating-pure-core-from-shell
why do i keep having to re-check a value that was already checked -> constraining-primitive-values
i cannot test this legacy code and i cannot safely change it either -> refactoring-toward-functional-design
how do i pin what this untested code currently does before moving it -> refactoring-toward-functional-design
two requests read the same balance and one update was lost -> managing-state-immutably
how do i test a lifecycle against random sequences of commands -> testing-functional-code
which property testing library should we use -> testing-functional-code
copying a large map on every update shows up in the profile -> managing-state-immutably
```
