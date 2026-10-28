# Pull request

<!-- PR title must follow Conventional Commits, e.g. "feat: add login" -->

Closes #

## What changed

Describe the change and which skill it affects.

## Why

What prompted it. For a correction, say what you observed that the
current guidance got wrong.

## How to test

## Checklist

- [ ] Linked issue is in the correct version milestone
- [ ] `npm test` and `npm run test:guards` pass locally
- [ ] `metadata.version` matches `package.json`
- [ ] No `markdownlint` configuration file or inline suppression comment
      was added
- [ ] Frontmatter stays within the set the validator accepts
- [ ] No book titles, author names, or citations were added
- [ ] Any tool named in new content was checked against its current
      documentation
- [ ] A new check comes with the defect it catches
- [ ] For a new skill, routing cases exist and coverage still passes
