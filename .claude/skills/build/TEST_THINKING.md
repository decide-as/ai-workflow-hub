# Test Thinking Framework

Six categories of thinking for generating world-class test plans. Organized by *thinking mode* — each category is a different way of reasoning about what to test. The output is specific tests for specific behaviors, not checkboxes to tick.

---

## Stage-aware depth

| Phase | Cat 1 | Cat 2 | Cat 3 | Cat 4 | Cat 5 | Cat 6 | Mutation |
|-------|-------|-------|-------|-------|-------|-------|----------|
| discovery–prototype | Full | Obvious only | Skip | Skip | Skip | Skip | Skip |
| mvp–alpha | Full | Systematic | Key modes | Key invariants | Skip | Skip | Skip |
| beta–production | Full | Exhaustive | Systematic | Full | Full | Where applicable | Yes |

"Skip" means don't enumerate in the test plan. It does NOT mean ignore a test that is obviously needed.

---

## Category 1: Behaviors — "What must it do?"

For each function/method in scope, think about:

- **Happy path contract**: What is the expected output for the expected input? Define the normal case precisely.
- **State transitions**: What state does this function change? What side effects does it produce? (Files written, caches updated, signals emitted)
- **Pre-conditions**: What must be true before calling this function? What happens if pre-conditions are violated?
- **Post-conditions**: What must be true after calling this function? What guarantees does it make to the caller?
- **Consumer contract**: What does the caller expect? Focus on the interface, not the implementation. If the implementation changes but the contract holds, the test should still pass.

### How to write behavior tests

```python
@pytest.mark.unit
@pytest.mark.test_value("essential")
def test_resolve_returns_only_applicable_content(metadata_fixture):
    """resolve() must return content matching the project's language and phase."""
    result = resolve(metadata_fixture)
    assert all(item.language == metadata_fixture.language for item in result.rules)
```

**Classification:** `essential` — removing these tests lets bugs ship.

---

## Category 2: Edge Cases — "What happens at boundaries?"

Think adversarially about each input and state variable. Systematically check these categories:

### Empty / zero / null
- Empty string, empty list, empty dict, zero count
- `None` where a value is expected
- Missing keys in dicts, missing fields in dataclasses
- Empty file, empty directory

### Boundary values
- Minimum and maximum valid values
- Off-by-one: one less than min, one more than max
- Exactly-at-limit vs one-over-limit
- First element, last element, single element

### Type boundaries
- Integer overflow / underflow
- Unicode edge cases: emoji, RTL text, zero-width characters, combining marks
- Very long strings (beyond reasonable buffer sizes)
- Mixed types in collections

### Ordering
- Unsorted input to functions that assume sorted
- Duplicate elements in unique-expected collections
- Already-sorted input (does it short-circuit correctly?)
- Reversed input

### Concurrency (if applicable)
- Race conditions on shared state
- Re-entrancy: calling the function from within its own callback
- Concurrent reads during writes

### Resource limits
- Very large inputs (stress the algorithm, not the machine)
- Deeply nested structures (recursion depth)
- Many concurrent operations (if the feature supports concurrency)

### How to write edge case tests

```python
@pytest.mark.unit
@pytest.mark.edge_case
@pytest.mark.test_value("thorough")
@pytest.mark.parametrize("input_val", ["", None, [], {}])
def test_validate_handles_empty_inputs(input_val):
    """validate() must raise ValueError for empty inputs, not crash or return garbage."""
    with pytest.raises(ValueError, match="non-empty"):
        validate(input_val)
```

**Classification:** `thorough` — meaningful edge cases that catch real bugs.

---

## Category 3: Failure Modes — "What can go wrong?"

Think like an attacker. Actively try to break the feature.

### Input validation failures
- Malformed input (wrong format, truncated, corrupted)
- Wrong types (string where int expected, list where dict expected)
- Missing required fields
- Injection attempts (shell metacharacters, SQL fragments, template syntax)

### External dependency failures
- File not found, permission denied
- Network timeout, connection refused
- Service returns error response, partial response, malformed response
- Dependency returns valid but unexpected data (schema change)

### State corruption
- Partial writes (crash mid-operation — is state consistent?)
- Interrupted operations (ctrl-C during long-running task)
- Stale cache (data changed underneath)
- Out-of-order events (B arrives before A)

### Resource exhaustion
- Out of memory (use large input to simulate)
- Disk full (mock filesystem errors)
- Too many open files (file descriptor exhaustion)
- Timeout (operation takes too long)

### Recovery
For each failure mode above, also ask:
- Can the system recover automatically?
- Is the failure visible to the user/operator? (Not silent)
- Is data preserved? (No silent data loss)
- Is the error message helpful? (Includes context, not just "error occurred")

### How to write failure mode tests

```python
@pytest.mark.unit
@pytest.mark.error_handling
@pytest.mark.test_value("thorough")
def test_scaffold_rolls_back_on_template_error(tmp_path):
    """scaffold() must clean up partial output if template rendering fails."""
    with pytest.raises(TemplateError):
        scaffold(broken_template, output_dir=tmp_path)
    assert not list(tmp_path.iterdir()), "No files should remain after rollback"
```

**Classification:** `thorough` (error path verification) or `defensive` (guarding against specific known failures).

---

## Category 4: Invariants — "What must always be true?"

Properties that must hold regardless of input or state. These are often the highest-value tests because breaking an invariant breaks everything built on top.

### Pre/post conditions
- What does a function guarantee if given valid input?
- What state transformations are promised?
- What relationships between inputs and outputs must hold?

### Data integrity
- Referential integrity (every reference points to something that exists)
- Schema compliance (output always matches expected schema)
- Format consistency (dates are always ISO format, IDs are always UUIDs)

### Idempotency
- Can the operation be safely retried with the same result?
- Does calling it twice differ from calling it once?
- Is there a risk of duplicate side effects?

### Monotonicity
- Does version always increase?
- Does the sequence number never go backwards?
- Does the output grow/shrink monotonically with input where expected?

### Conservation
- Are resources properly acquired and released? (Files closed, connections returned, locks freed)
- Does every `open()` have a corresponding `close()`?
- Does every acquired lock get released, even on error paths?

### How to write invariant tests

```python
@pytest.mark.unit
@pytest.mark.test_value("essential")
@pytest.mark.parametrize("metadata", DIVERSE_METADATA_FIXTURES)
def test_resolve_output_always_valid_schema(metadata):
    """ResolvedContent must always pass schema validation, regardless of input metadata."""
    result = resolve(metadata)
    assert validate_schema(result), "Output must conform to ResolvedContent schema"
```

**Classification:** `essential` — if the invariant breaks, everything built on top breaks.

---

## Category 5: Integration Points — "How do components interact?"

Not unit-level — how the components work together.

### Interface contracts
- Does component A's output match component B's expected input format?
- Does the data type/structure survive the boundary crossing?
- Are optional fields handled correctly on both sides?

### Error propagation
- When component A fails, does component B handle it correctly?
- Does the error message/type survive translation across boundaries?
- Does component B distinguish "A failed" from "A returned empty"?

### State dependencies
- Does component B assume state that component A may not have set?
- What happens if components execute in unexpected order?
- Are there implicit coupling through shared state?

### Data flow
- Does data transform correctly as it passes through the pipeline?
- Are there data loss points (fields dropped, precision lost)?
- Does the end-to-end result match expectations?

### How to write integration tests

```python
@pytest.mark.integration
@pytest.mark.test_value("thorough")
def test_scaffold_uses_resolver_output(tmp_path, sample_metadata):
    """scaffold() must correctly consume ResolvedContent from resolve()."""
    resolved = resolve(sample_metadata)
    result = scaffold(resolved, output_dir=tmp_path)
    assert result.exists()
    assert (result / ".claude" / "rules").is_dir()
```

**Classification:** `thorough` — integration verification.

---

## Category 6: Properties — "What must hold for all inputs?"

For algorithmic or data-transformation code. Skip for simple CRUD, config, or UI.

### Round-trip
- Encode then decode → original value?
- Serialize then deserialize → identical object?
- Write to file then read → same content?

### Equivalence
- Do two implementations produce the same result? (Useful during refactors)
- Does the optimized path match the naive path?

### Commutativity / Associativity
- Does order of operations matter when it shouldn't?
- Does `f(a, b)` equal `f(b, a)` when commutativity is expected?
- Does `f(f(a, b), c)` equal `f(a, f(b, c))` when associativity is expected?

### Idempotency
- Does `f(f(x))` equal `f(x)` when idempotency is expected?
- Does applying the operation N times equal applying it once?

### Bounds
- Is the output always within expected range?
- Does the algorithm always terminate?
- Is the output size bounded relative to input size?

These are candidates for property-based testing (e.g., `hypothesis` in Python). Even without property-based testing tools, thinking about properties reveals invariants that should be tested with representative cases.

### How to write property tests

```python
@pytest.mark.unit
@pytest.mark.test_value("thorough")
@pytest.mark.parametrize("text", ["hello", "Hello World", "UPPER", "already-slug", "with spaces"])
def test_slugify_is_idempotent(text):
    """slugify(slugify(x)) must equal slugify(x) for all inputs."""
    once = slugify(text)
    twice = slugify(once)
    assert once == twice
```

**Classification:** `thorough`.

---

## Mutation test awareness

After generating the test plan, do a mutation check. For each `essential` and `thorough` test, ask:

> If the production code had a subtle bug — off-by-one, wrong comparison operator (`<` vs `<=`), swapped arguments, missing negation — would this test catch it?

If the answer is no:
- Strengthen the assertion (check specific values, not just truthiness)
- Add a complementary test that would catch the mutation
- Use parametrized tests with boundary values where mutations would flip behavior

A test that passes for both correct and incorrect code is a false safety net.

---

## Test plan output format

Present the test plan as a summary table followed by the skeleton list:

```markdown
### Test Plan: [feature name]

**Depth tier:** [lite/standard/full]
**Categories covered:** [1, 2, ...] of 6

| Category | Tests | Essential | Thorough | Defensive | Structural |
|----------|-------|-----------|----------|-----------|------------|
| Behaviors | N | N | 0 | 0 | 0 |
| Edge Cases | N | 0 | N | 0 | 0 |
| Failure Modes | N | 0 | N | N | 0 |
| Invariants | N | N | 0 | 0 | 0 |
| Integration | N | 0 | N | 0 | 0 |
| Properties | N | 0 | N | 0 | 0 |
| **Total** | **N** | **N** | **N** | **N** | **N** |

### Skeleton list

1. `test_<name>` — [essential] [unit] — <what it verifies>
2. `test_<name>` — [thorough] [edge_case] — <what it verifies>
...
```
