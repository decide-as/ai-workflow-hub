# Testing Strategy

## The test pyramid is wrong for most projects

The classic pyramid — lots of unit tests, fewer integration tests, few E2E tests — was derived from enterprise Java applications in the 2000s where unit tests ran in milliseconds and E2E tests took hours. Your project is probably not that.

For a typical Python service:
- Unit tests for pure business logic (free, fast, high signal)
- Integration tests against a real database (not slow if you use pytest-asyncio and connection pools correctly — often under 1 second each)
- Minimal E2E tests for the critical user paths (not a full regression suite)

The real question is: **where do bugs actually occur in your system?** If your bugs are in the interaction between your service layer and your database queries, integration tests catch them and unit tests don't. If your bugs are in pure algorithmic logic, unit tests are the right tool.

Trace your last 10 bugs. Plot where they would have been caught. That's your test shape.

The shape that's almost always wrong: a large unit test suite that mocks everything, achieving high coverage numbers while catching almost none of the real bugs, because real bugs are at the integration boundaries.

## Test doubles taxonomy: they are not interchangeable

These terms are used interchangeably in most tutorials. They shouldn't be.

**Fake**: a working implementation with a simplified internals. An in-memory database that implements the same interface as your real database. Fakes are the gold standard for testing — they let you test real behavior without real infrastructure.

**Stub**: returns canned answers. `stub.get_user(id=1)` always returns the same `User` object. Use stubs when you need to control what a dependency returns. They don't verify that the dependency was called correctly.

**Mock**: verifies behavior. A mock fails the test if you don't call it in the expected way. Use mocks when the *call itself* is the contract — sending an email, publishing a message, calling a webhook. Don't use mocks to replace data access or computation.

The common mistake: using mocks for everything. You end up with tests that verify implementation details (the method was called with these exact arguments) rather than behavior (the user received an email). When you refactor, the mocks break even though the behavior is unchanged.

The heuristic: use a fake when you want to test how your code behaves when the dependency works. Use a stub when you want to control what data the dependency returns. Use a mock only when the act of calling the dependency is the externally observable effect you're testing.

## Property-based testing with Hypothesis

Property-based testing is not about exhaustive coverage — it's about finding the edge cases you didn't think to test.

When it's the right tool:

- **Parsing and serialization**: any `serialize(deserialize(x)) == x` invariant. Hypothesis will find the string that your JSON serializer doesn't round-trip correctly.
- **Data structure invariants**: "after any sequence of operations, the structure is still valid."
- **Equivalence**: "this new fast implementation produces the same results as the slow reference implementation."
- **Boundary conditions**: "this function never returns a negative value, regardless of input."

```python
from hypothesis import given, strategies as st

@given(st.text())
def test_slugify_is_idempotent(s: str) -> None:
    """Slugifying twice should give the same result as slugifying once."""
    assert slugify(slugify(s)) == slugify(s)
```

When it's overkill: testing functions with complex, structured inputs that you can enumerate explicitly. Testing behavior that depends on external state. Testing things where "any valid input" isn't a useful concept.

The workflow: run Hypothesis in CI with a low example count (default 100). When it finds a failure, Hypothesis shrinks the counterexample to the minimal failing case and saves it in its database. Future CI runs replay the known failures first.

## Testing time-dependent code

`time.sleep()` in tests is a test smell. `datetime.now()` called directly inside business logic is a testability smell.

The injection pattern:

```python
from datetime import datetime
from typing import Callable

def create_session(
    user_id: int,
    now: Callable[[], datetime] = datetime.utcnow  # injectable
) -> Session:
    return Session(user_id=user_id, created_at=now(), expires_at=now() + timedelta(hours=24))
```

In tests, pass `now=lambda: datetime(2024, 1, 15, 12, 0, 0)`. In production, the default is used.

When you can't inject (third-party code, legacy code): use `time_machine` (preferred) or `freezegun`:

```python
import time_machine

@time_machine.travel("2024-01-15 12:00:00 UTC")
def test_session_expires_correctly():
    session = create_session(user_id=1)
    assert session.expires_at == datetime(2024, 1, 16, 12, 0, 0)
```

`time_machine` is faster than `freezegun` and patches at the C level, so it works with libraries that call `time.time()` directly.

The anti-pattern: `time.sleep(0.1)` to wait for an async operation. This makes your test suite slow and flaky. Use event-based synchronization: `asyncio.Event`, `threading.Event`, or mock the clock.

## Testing async code

The gotcha that wastes hours: creating a new event loop per test causes subtle state leakage and "coroutine was never awaited" warnings.

The correct setup with pytest-asyncio:

```python
# conftest.py
import pytest

@pytest.fixture(scope="session")
def event_loop_policy():
    return asyncio.DefaultEventLoopPolicy()
```

In `pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"  # auto-detects async test functions
```

The "fire and forget" anti-pattern in tests:

```python
# BAD: task runs after the test ends, corrupts other tests
async def test_something():
    asyncio.create_task(background_work())
    assert something()

# GOOD: wait for background work explicitly
async def test_something():
    task = asyncio.create_task(background_work())
    assert something()
    await task  # or cancel it explicitly if you don't want the result
```

Tasks created in a test that run after the test ends will corrupt the event loop state for subsequent tests. This is the most common source of mysterious async test failures.

## Contract testing at module boundaries

Unit tests verify that a module works correctly given some input. Contract tests verify that the interface a module *expects* matches the interface its callers *provide*.

The practical version without a contract testing framework: write a test suite that exercises the interface of a dependency using only its public contract, not its internal implementation. When you replace the real implementation with a fake, run the same test suite against the fake:

```python
# test_user_repository_contract.py

class UserRepositoryContractTests:
    """Run these tests against any UserRepository implementation."""
    
    @pytest.fixture
    def repo(self) -> UserRepository:
        raise NotImplementedError
    
    def test_find_by_id_returns_none_for_missing_user(self, repo):
        assert repo.find_by_id(999) is None
    
    def test_save_then_find_returns_same_user(self, repo):
        user = User(name="Alice")
        saved = repo.save(user)
        assert repo.find_by_id(saved.id).name == "Alice"


class TestPostgresUserRepository(UserRepositoryContractTests):
    @pytest.fixture
    def repo(self, db_connection):
        return PostgresUserRepository(db_connection)


class TestInMemoryUserRepository(UserRepositoryContractTests):
    @pytest.fixture
    def repo(self):
        return InMemoryUserRepository()
```

Now you know your in-memory fake is a faithful substitute for the real thing. When the fake passes the contract tests, you can trust unit tests that use the fake.

## Flaky test discipline

A flaky test that sometimes fails and sometimes passes is worse than no test. It teaches you to ignore failures. It erodes trust in the entire test suite. When a critical failure occurs, you dismiss it as "probably flaky."

The discipline:

1. **Quarantine immediately** when a flakiness is detected. Move it to a `@pytest.mark.flaky` group that doesn't block CI but is reported separately. Never let a flaky test block a ship with no investigation.

2. **Investigate within 24 hours**. The categories: timing dependency (use synchronization primitives, not sleep), test ordering dependency (tests leaking state into each other — use isolation fixtures), external service dependency (use a fake or VCR cassettes), or genuine race condition in the code under test (a real bug).

3. **Fix or delete**. A flaky test that you've given up investigating and left quarantined for more than a week should be deleted. A test that never runs is still better than a test that sometimes fails for reasons you've stopped caring about.

The investigation tool: `pytest --count=20 -x test_file.py::test_function` (requires `pytest-repeat`) — run the test 20 times in isolation and see if it's consistently flaky. Then run with `--randomly-seed=12345` to check for ordering dependencies.
