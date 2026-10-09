# Security policy

## What this repository contains

Markdown skill files, the Node scripts that check them, and two pairs
of install scripts. The skills themselves are documentation: they are
read by an agent and contain no executable content.

The parts that do run on a contributor's or a user's machine are:

- `scripts/install.sh` and `scripts/install.ps1`, which copy directories
  into `~/.claude/skills`.
- `scripts/link-local.sh` and `scripts/link-local.ps1`, which link them
  into `.claude/skills` inside a clone.
- The checks that `npm test` and `npm run test:guards` run: the
  `scripts/validate-*.mjs` files, `scripts/eval-routing.mjs` and
  `scripts/negative-test.mjs`. They read files in the repository.
  `negative-test.mjs` works on copies in temporary directories it
  creates and removes, and `validate-types.mjs` writes the modules it
  generates under `node_modules/.cache/`. The code in the documentation
  is parsed and type-checked, never run; asked to parse the Elixir
  examples, `validate-examples.mjs` hands them to `elixir` to read.
- `scripts/eval-scenarios.mjs` and `scripts/eval-plugin.mjs`, which no
  test runs. They start the `claude` command, which calls a model on
  the account that is signed in, against a copy of the fixture or of the
  plugin in a temporary directory, and they keep what comes back there
  or under `evals/results/`.
- `scripts/bump-version.mjs`, which rewrites the version in the
  manifests and in every skill's frontmatter.
- The development dependencies installed by `npm ci`, which include
  the libraries the examples are type-checked against.

Nothing the plugin ships needs npm. `package.json` and the lock file
live outside `plugin/` deliberately, so that installing the plugin never
runs an install on anyone's machine.

## Supported versions

The latest release on the default branch is the only supported version.
Fixes are made there rather than backported.

## Reporting a vulnerability

Report privately through the repository's GitHub security advisory page,
under the Security tab, rather than by opening a public issue.

Please include what an attacker could achieve, the steps to reproduce
it, and the versions involved. An initial response can be expected
within a few days. This is a small project maintained in spare time, so
please do not expect a same-day reply.

Do not open a public issue for anything exploitable until a fix is
available.

## Scope

In scope:

- A path traversal, injection, or unsafe expansion in the installers or
  the validation scripts.
- Anything in this repository that could overwrite or delete files
  outside the directories the installers document.
- A dependency vulnerability that is reachable through the scripts here.

Out of scope:

- Advice in the skills that you disagree with. Open an issue instead;
  corrections from real experience are welcome.
- Vulnerabilities in any library the skills name. Report those to their
  own maintainers.
- Behaviour of Claude Code itself, or of any other agent that reads
  these skills. Report those to the vendor concerned.
- Issues that require an attacker to already have write access to the
  machine running the scripts.

## What running these skills does

Installing skills places Markdown files in a directory an agent reads.
The skills instruct an agent about designing and reviewing functional
code; they do not instruct it to fetch remote content, run commands
against your systems, or transmit anything. Anything an agent does after
reading them is governed by that agent's own permission model.
