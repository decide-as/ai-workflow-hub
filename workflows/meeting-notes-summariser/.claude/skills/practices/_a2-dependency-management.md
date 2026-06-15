# Dependency Management

## The diamond dependency problem

When package A requires `requests>=2.25` and package B requires `requests==2.20`, pip resolves this by picking one version. The problem is that pip's resolver will often pick a version that satisfies one constraint and silently breaks the other — and you won't know until runtime.

The practical fix is not "use a better resolver" but rather **don't let your direct dependencies have conflicting transitive requirements**. When you hit a diamond conflict:

1. Check if the stricter pin in the transitive dep is actually necessary (often it isn't — the lib author was just conservative).
2. Open an issue upstream to relax the constraint. Meanwhile, pin the resolution explicitly in your lock file.
3. If you cannot reconcile the conflict, you need to vendor one of the two packages or isolate them via subprocess boundary.

Tools: `pip-tree` and `pipdeptree` show the full transitive graph. Run `pipdeptree --warn fail` in CI to catch conflicts before they bite you in production.

## Phantom dependencies

The most common production surprise: your code imports `yaml` and it works in development because `PyYAML` was installed as a transitive dependency of something else. You never listed it in your `pyproject.toml`. Then you upgrade that other package, it drops `PyYAML`, and your production deploy fails.

How to catch phantoms: run `importchecker src/` or use `deptry` — it compares your actual imports against your declared dependencies and flags anything you import but don't declare. Add `deptry` to your CI lint step, not just as a one-time audit.

A subtler variant: you use `from pkg_resources import ...` without declaring `setuptools`. It works because pip installs setuptools everywhere. Until it doesn't.

## Vendoring vs abstracting vs pinning: the decision criteria

**Pin** when: you're building an application (not a library), the dependency is stable and well-maintained, and you're comfortable with the operational cost of regular updates.

**Abstract** (use an interface/adapter pattern) when: the dependency is an integration point (a database driver, a cloud SDK, a payment processor). You're not trying to hide complexity — you're isolating change. When AWS renames a method, you change one file.

**Vendor** when: the dependency is abandoned and you need security patches, the transitive tree is a mess you need to control, or you need to modify the source for your use case. Vendoring is not a last resort — it's the appropriate choice for small utilities you depend on critically. Copy the source into your repo, remove the dependency from your manifest, and own it.

The trap to avoid: abstracting a dependency "in case we switch later" when you never will. Every abstraction layer has a maintenance cost. Abstract when the abstraction already pays for itself (because it simplifies the interface), not speculatively.

## Auditing your transitive tree

```bash
pip install pipdeptree
pipdeptree --packages YOUR_PACKAGE --reverse  # who depends on this?
pipdeptree --json-tree | python -m json.tool  # full graph
```

Why it matters: a transitive dep you've never heard of is a supply chain attack surface. In 2022, `ctx` and `rectifier` were typosquatted packages that stole environment variables. They got installed as transitive dependencies in real projects. Knowing your transitive tree means you can audit it — and set up alerts when it changes unexpectedly.

Make transitive tree changes visible in PRs: commit your `pip-compile` output (the full `requirements.txt` with hashes), not just `requirements.in`. When a PR changes a transitive dep you didn't directly touch, that's a signal to review.

## The abandoned dependency decision framework

Before abandoning a dependency, answer these questions:

1. **Is the abandonment real?** No commits for 2 years is not abandonment if the library is complete and correct. `six` doesn't need updates. Check whether there are open security issues or compatibility failures, not just commit recency.

2. **What is your actual exposure?** Read the CVE. Many CVEs affect only specific code paths. If you use `requests` for internal service calls over TLS and the CVE is about MITM on untrusted certificates, your threat model may exclude it. Reachability matters.

3. **Is forking viable?** If the library is small (<2000 lines), forking and owning it is often cheaper than migration. Rename it, vendor it, maintain the patch. This is underused.

4. **What is the migration blast radius?** Count call sites. If you have 3 call sites behind an abstraction, migrate. If you have 300 direct usages, the migration is a multi-sprint project and you should weigh it against the actual risk.

The naive path — "it's abandoned, find an alternative" — often creates more risk than it resolves when the replacement is newer and less battle-tested.

## CVE reachability: what `pip-audit` doesn't tell you

`pip-audit` will report a vulnerability in a package you have installed. It will not tell you whether your code ever reaches the vulnerable code path.

A CVE in `Pillow`'s TIFF parser doesn't affect you if you only process PNGs from internal sources. A CVE in `cryptography`'s legacy cipher support doesn't affect you if you never instantiate those ciphers.

The practical process:

1. Read the CVE description. Find the specific function, class, or code path that is vulnerable.
2. Search your codebase for usage of that specific path. `grep -r "CVE_CLASS_NAME" src/` is a start.
3. Assess your input sources. Remote user input requires more caution than internal data.
4. Document your reachability analysis. "CVE-2024-XXXX: affects TIFF parsing, we only process JPEG from authenticated upload endpoint — not reachable in current config" is a valid decision, not negligence. Write it down.

If you cannot perform reachability analysis (the library is too deeply integrated), default to patching. But don't treat every `pip-audit` finding as equally urgent — triage matters.

## Lock file strategy

For applications: commit the full lock file (pip-compile output with `--generate-hashes`). Reproducible builds are non-negotiable. The lock file is the artifact, not an implementation detail.

For libraries: do not commit a lock file. Your lock file becomes the constraint on everyone who installs your library. Use `pyproject.toml` bounds only, and test against multiple dependency versions in CI using a matrix.

Dependency update cadence: automated weekly PRs from Dependabot or Renovate for patch versions, manual review for minor/major. The goal is small, frequent updates — not quarterly "let's update everything" sessions that become impossible to debug when something breaks.
