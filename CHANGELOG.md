# Changelog

Notable changes to this pack. Versions follow [semantic versioning]:
a major bump changes something people depend on, a minor one adds
skills or guidance, a patch one corrects what is already there.

[semantic versioning]: https://semver.org

## 2.0.0

Claude Code only, shipped as a plugin.

### Changed, and breaking

- **The skills moved to `plugin/skills/`.** Every documented install
  route changed with them. A lock file at a plugin's root makes
  `claude plugin install` run npm on the machine of everyone who
  installs it, so the packaging tooling now stays one directory up where
  the installer cannot see it.
- **Codex support is gone.** Supporting two runtimes from one set of
  files cost the platform actually in use: frontmatter was held to
  `name` and `description`, so `license` and `metadata` were
  unavailable, and the description budget was squeezed to fit a limit
  only the other runtime had. Nothing was ever run against Codex to
  confirm the support worked.
- **`scripts/verify.sh` and `scripts/eval-routing.py` are gone**,
  replaced by `validate-skills.mjs`, `validate-prose.mjs`,
  `eval-routing.mjs` and `negative-test.mjs`. The routing scorer is a
  faithful port, producing byte-identical output on the summary,
  `--report` and `--profile full`; ties in the `--noise` table now break
  alphabetically rather than by which case was scored first.
- **Two descriptions gained a trigger word** they were missing, in
  `separating-pure-core-from-shell` and `separating-layers`, after
  routing cases for the new guidance failed to reach them.

### Fixed

Thirty-two defects that no linter could see.

Twenty-five of them came from one cause. A word-level rename of the
example domain had broken prose wherever the replaced word meant
something else, and the audit that checked it recorded the skills clean.
They were not. Each of these is recovered from the tree as it stood
before that rename rather than rewritten from guesswork.

- Seventeen places where `order` meant a sequence, so the substitution
  produced a sentence that parses and means nothing.
- Two where `service` meant a service object, turning the rule against
  wide dependencies into a rule about the example domain.
- One where `production` contained `product`, coining a word that does
  not exist.
- Five articles left disagreeing with the noun after them, one of them
  split across a line wrap.

The other seven were found by reading the examples as a compiler would
rather than as prose.

- A box diagram whose lines ran 45, 46 and 47 characters.
- `>=/>` in the Elixir notation table, which is not an operator.
- A monoid example labelled "not associative" above a comment saying it
  is associative, when the operation shown is a maximum and therefore
  associative. It is replaced by an averaging example, which genuinely
  is not associative, and by the repair.
- An Elixir example naming a nested module as `Appointment.Id` from
  inside `Clinic.Scheduling.Appointment`, which resolves to
  `Elixir.Appointment.Id` and does not exist.
- A wrapper class defining `valueOf`, which silently restores the
  defect the wrapper removed: `quantity + price` coerces both and
  compiles.
- Two worked examples reachable only from the index, so a reader inside
  the skill that owned each never learned it existed.

### Added

- **Every tool named.** Guidance that said "use a persistent collection
  library" could not be followed, and one sentence of it was wrong:
  JavaScript and TypeScript ship no persistent collections, and they are
  two of the six language packs. Named and verified against current
  documentation: `fast-check`, `stream_data`, `propcheck`, `immutable`,
  `immer`, `oban`, `broadway`, `pg-boss`, `bullmq`, `Ecto.Multi`, `mox`,
  `:telemetry`, `useActionState`, `@tanstack/react-query`, `swr`,
  `xstate`.
- **Effects spread upward**, as the mechanic behind the core-and-shell
  split coming undone, with the drill for finding where to cut.
- **Layers ordered by how often each changes**, as a second axis beside
  vocabulary.
- **Why a constructor returns a value rather than a verdict**, which is
  where duplicated validation comes from.
- **Pinning untested behaviour**, as the move before every other move,
  and where to stand when the code cannot be called at all.
- **Reading two sequences of effects against each other**, with the
  questions to ask and the repairs in order.
- **Stateful property testing** in full, where it had six lines.
- A contents list on all seventy-one references over a hundred lines.
- Twelve routing cases for the new material; coverage is 100 of 100.
- `CLAUDE.md`, which this repository never had. Its house rules lived in
  `CONTRIBUTING.md`, which no agent working here reads.
- Guards for every defect above, each with a test that breaks it
  deliberately and confirms the guard fires.
- **A readiness check before the design loop.** The pack answered
  "we do not know what this should do yet" with a module-boundary skill,
  because `know`, `build` and `report` are ordinary words that sit in
  those descriptions as structural vocabulary. `functional-design` now
  asks for one rule with an example it accepts and one it refuses,
  keyed to the two heaviest rows of the calibration table, and says
  what to produce when the answer is no. It does not add a
  specification method; it declines the work and names what is
  missing.

### Removed

- `AUDIT.md`. It recorded how each round was verified, and one of its
  claims — that the skills were clean of rename damage — is disproved by
  the thirty-two fixes above. What was still true about scope and
  limits has moved into `README.md` and `CONTRIBUTING.md`; the rest is
  in the history.

## 1.0.0

First release. Forty skills: an index, thirty-three design rules, and
six language packs, copied into a target project rather than installed.
Worked in Claude Code and, structurally, in Codex.
