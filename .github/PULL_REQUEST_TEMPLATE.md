# Pull request

## What changed

Describe the change and which skill it affects.

## Why

What prompted it. For a correction, say what you observed that the
current guidance got wrong.

## Labels

Two are required, and a check enforces them:

- One type: `feature`, `release`, `bug`, `hotfix`, `chore`, or
  `documentation`.
- One priority: `priority: high`, `priority: medium`, or `priority: low`.

Anything else is optional. `breaking-change`, `security`, and `skill` are
worth reaching for when they apply.

## Checklist

- [ ] `npm test` and `npm run test:guards` pass locally.
- [ ] A type label and a priority label are set.
- [ ] No `markdownlint` configuration file or inline suppression comment
      was added.
- [ ] Frontmatter stays within the set the validator accepts.
- [ ] `metadata.version` matches `package.json`.
- [ ] No book titles, author names, or citations were added.
- [ ] Any tool named in new content was checked against its current
      documentation, not written from memory.
- [ ] A new check comes with the defect it catches, in
      `scripts/negative-test.mjs` or the prose self-test.
- [ ] For a new skill, routing cases exist and coverage still passes.
