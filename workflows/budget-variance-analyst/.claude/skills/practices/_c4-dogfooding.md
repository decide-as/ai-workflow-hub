# Dogfooding

## What dogfooding catches that testing doesn't

Tests validate behavior in isolation. Dogfooding validates experience end-to-end. These are different failure modes:

- **Unit tests** verify that a function returns the right value given specific inputs.
- **Integration tests** verify that components connect correctly.
- **Dogfooding** verifies that the system, as shipped, does what a real user needs — including the parts of the experience that aren't in the spec.

The canonical dogfooding catch: the tool works correctly, but the default configuration makes it painful to use. Tests don't catch this. Tests don't feel pain.

## The "works on my machine" problem

"Works on my machine" is always a dogfooding failure. The developer's environment diverges from the user's environment over time: different OS versions, different default configurations, implicit dependencies installed for other projects, environment variables set by habit, mental models about how the tool works that users don't have.

Dogfooding closes this gap, but only if it's done in a clean environment. Dogfooding on your development machine with your personal configuration is not dogfooding — it's confirming that the tool works for you, which you already knew. Genuine dogfooding requires:

- A clean environment (fresh venv, fresh config, fresh working directory)
- Following the documented workflow, not the shortcut you know from building it
- Using the tool for real work, not contrived examples

## Dogfooding levels

**L1: Artifact parity** — the artifacts produced for the project match what users would receive. For example, the project's own `.claude/` directory should contain the same rules, scripts, and skills that scaffolded projects receive. Tests can enforce this mechanically.

**L2: Workflow parity** — the team uses the same workflow that users follow. For example, using `cp create` to scaffold new projects rather than manually setting up directories, using the PR skill to do PRs rather than running the workflow from memory, and feeling the friction when something is cumbersome.

**L3: Internalized pain** — the team feels and fixes problems that users would encounter. L3 requires that pain points from dogfooding flow back to the backlog. Without a channel from experience to improvement, dogfooding is just suffering.

Most teams stop at L1. L2 is where you catch the ergonomic bugs. L3 is where you improve the product.

## The asymmetry problem

The team building the tool knows workarounds that users don't. When the default configuration is wrong, the team instinctively sets the right config. When an error message is cryptic, the team decodes it from memory. This institutional knowledge masks problems that every new user will encounter.

Genuine dogfooding must be done by someone who doesn't have the insider knowledge — an engineer on the team who hasn't worked on that subsystem, a new hire, or by a team member deliberately following only the documented path with no recourse to internal knowledge. This is uncomfortable, which is exactly why it's valuable.

## When dogfooding doesn't apply

Dogfooding is valuable for tools and platforms with repeated use. It doesn't apply equally to:

- **Pure libraries**: a cryptography library doesn't have an "operational experience" to dogfood. What you can do is audit whether your own production code uses the library the way you intend users to.
- **One-shot migration scripts**: there's no repeated use to generate feedback. Integration testing is the better investment.
- **Infrastructure primitives**: Terraform modules, base Docker images, CI templates. These can be dogfooded at the configuration level (does our own CI use the same template we distribute?) but not at the operational level.

## The feedback loop requirement

Dogfooding without a feedback mechanism is not dogfooding — it's using your own tool and hoping pain points somehow fix themselves. The feedback loop requires:

1. A channel for recording pain points (an issue label, a Slack channel, a backlog tag)
2. Regular review of pain points to identify patterns (one-off annoyances are noise; repeated friction is signal)
3. Prioritization of dogfooding-sourced issues at par with user-reported issues

Teams that dogfood but don't close the feedback loop often end up with a growing collection of workarounds rather than an improving product.
