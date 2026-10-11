# When a Step Assumes People

Some steps in this pack ask for a person: a domain expert to describe a
process, a colleague to read a diff, the owner of a convention. An agent
working alone often has none of them, and neither does a developer on a
small team. Where a skill asks for one, substitute in this order.

## 1. The repository

Tests, documentation, type names, the issue being worked on, and an
owners file already say what the business calls things, what must hold,
and who owns what. Use the words found there before any word you would
choose. A requirement stated in a test is evidence. A requirement read
off the code under review is not: that code is the thing in question.

## 2. The user

Ask one specific question, and give the answer you would otherwise
assume: "I am treating a lapsed hold as a refusal the patient sees; is
that right?" Ask before the step whose result depends on the answer, not
after it. A question that needs no thought to answer gets answered.

## 3. A fresh reader

Where the step is "show it to someone who has not seen it", the point is
a reading without context. Give a reader that has none only the thing to
be judged: the name and its signature, the diff, the module's header and
exported names. Then ask what it does. A subagent started without the
conversation is such a reader. You are not, and re-reading later does
not make you one: you cannot forget what you have just read.

## 4. Say it was not done

Where none of the three is available, take the most cautious reading and
carry on. Then, in what you hand back, list each assumption you made in
place of an answer, and each step you could not carry out. An unverified
step that is reported can be finished by someone else. One that is
passed off as done cannot.

## What does not substitute

- **Your own judgement of your own work.** Whether a name is clear or a
  diff is obvious is exactly what its author cannot tell.
- **An invented answer.** Do not write what an expert "would say". If
  nobody said it and no file says it, it is an assumption, and it goes
  on the list.
- **A feeling.** Where a trigger reads "everyone agrees" or "it feels
  hard to change", look for what can be counted: files a typical change
  touches, how many places hold the same literal, what the history
  shows.
