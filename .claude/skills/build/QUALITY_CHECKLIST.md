# Quality Checklist — Self-Review

Run at each verification gate during the build loop (Step 5) and during final verification (Step 6). Two sections: conceptual and mechanical.

The conceptual review is what separates world-class self-review from running a linter. It requires reading your own code as if someone else wrote it — looking for design drift, contract violations, and cohesion problems that no automated tool catches.

---

## Conceptual review

Read the changes critically. For each question, the answer should be confident — not "I think so" or "probably."

### Design intent
- Does the implementation match what was designed in Step 2?
- Has the design drifted during implementation? If so, is the drift an improvement or an accident?
- Are there any "I'll fix this later" shortcuts that weren't in the design?

### Mental model
- If you describe what this code does in one paragraph, does that description match what the code actually does?
- Is there a gap between what the code *looks like* it does and what it *actually* does?
- Would a new reader build the correct mental model from reading this code?

### Contract fidelity
- Are all interfaces from Step 2 honored exactly?
- Do callers get what they expect? (Return types, error types, side effects)
- Are there any implicit contracts that aren't documented or tested?

### Error honesty
- Is every error path intentional? (No bare `except`, no silent `pass`, no swallowed exceptions)
- Do error messages include enough context to diagnose the problem?
- Are there any paths where an error is possible but not handled?
- Is there any place where success is assumed when failure is possible?

### Coupling
- Does this component know about things it shouldn't?
- Could you change component A's internals without breaking component B?
- Are there hidden dependencies through global state, shared files, or environment variables?

### Cohesion
- Does this module do one thing?
- Could you describe this module's purpose in one sentence without using "and"?
- Are there functions here that belong in a different module?

### Naming
- Would a reader understand each function/variable/class name without reading its implementation?
- Are there any misleading names? (e.g., `get_user()` that also modifies state)
- Do names follow the project's naming conventions?

### Complexity justification
- Is every abstraction pulling its weight?
- Is there speculative generality? (Building for hypothetical future needs)
- Could any part be simpler without losing correctness or clarity?
- Are there helper functions that are called exactly once and obscure the flow?

### Observability (standard + full tiers)

For pure functions (no side effects, no I/O, no state mutation), observability review is N/A — failures surface through callers. For everything else:

- Can you tell if this works in production without reading the code?
- Are important operations logged at function boundaries?
- Are failures visible? (Not just logged at DEBUG level)
- If this breaks at 3 AM, would the on-call engineer know where to look?

### Reversibility (full tier only)
- Can this change be safely rolled back?
- If the feature is disabled, does the system return to its previous state?
- Are there database migrations or state changes that can't be undone?

---

## Mechanical review

Automated checks. All must pass before proceeding. Run these commands:

### Always required

- [ ] **Tests pass**: `pytest tests/ -v`
- [ ] **Lint clean**: `ruff check src/ tests/`
- [ ] **Format clean**: `ruff format --check src/ tests/`
- [ ] **Types clean**: `mypy src/<package>/`

### When quality gate is basic or strict

- [ ] **Coverage meets tier targets**: `pytest tests/ --cov=<package> --cov-report=json` then `python -m code_practices.coverage_tiers --check coverage.json --gate <gate>`
- [ ] **No anti-gaming patterns**: `pytest tests/test_test_quality.py::TestAntiGamingT1T2 -v`
- [ ] **Test markers present**: Every test has at least one classification marker (`unit`, `integration`, etc.)
- [ ] **test_value markers present**: Every test has a `test_value` marker (`essential`, `thorough`, `defensive`, `structural`)

### When quality gate is strict

- [ ] **Security scan**: `bandit -r src/<package>/ -q`
- [ ] **Dependency audit**: `pip-audit`
- [ ] **No bare except blocks**: grep for `except:` without a specific exception type
- [ ] **No TODO/FIXME without tracking**: grep for untracked TODO/FIXME in production code

### Documentation checks

- [ ] **New public APIs have docstrings**: Every new public function, method, or class has a docstring
- [ ] **No secrets in code**: No API keys, tokens, passwords, or credentials
- [ ] **Non-obvious logic has comments**: Comments explain *why*, not *what*

---

## When to use each section

| Context | Conceptual | Mechanical |
|---------|-----------|------------|
| Step 5: Per-component verification | Key questions only (design intent, contracts, errors) | Tests + lint + types |
| Step 6: Final verification | Full checklist — all questions | Full checklist — all checks |
| Lite depth tier | Skip conceptual | Mechanical only |
| Standard depth tier | Key conceptual (design, contracts, errors, coupling) | Full mechanical |
| Full depth tier | Full conceptual | Full mechanical |
