# Security policy

## What this repository contains

Markdown skill files, five Node validation scripts, and two pairs of
install scripts. The skills themselves are documentation: they are read
by an agent and contain no executable content.

The parts that do run on a contributor's or a user's machine are:

- `scripts/install.sh` and `scripts/install.ps1`, which copy directories
  into `~/.claude/skills`.
- `scripts/link-local.sh` and `scripts/link-local.ps1`, which link them
  into `.claude/skills` inside a clone.
- `scripts/validate-skills.mjs`, `scripts/validate-prose.mjs`,
  `scripts/validate-examples.mjs`, `scripts/eval-routing.mjs` and
  `scripts/negative-test.mjs`, which read files in the repository. The
  last two also write to a temporary directory they create and remove.
  `validate-examples.mjs` parses the code in the documentation; it never
  runs it.
- The development dependencies installed by `npm ci`.

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
