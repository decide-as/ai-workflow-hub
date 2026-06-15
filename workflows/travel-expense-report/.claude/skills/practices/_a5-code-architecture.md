# Code Architecture

## The wrong abstraction is worse than no abstraction

The most damaging architectural pattern isn't the god class or the missing interface. It's the abstraction that was created for the wrong reason, with the wrong seam, and now costs more to work around than it would have cost to just write the code directly.

The canonical example: a `Repository` interface created because "we might switch databases later." You never switch databases. Now every data access goes through a layer that adds indirection, makes tracing harder, and forces every new query through a ceremony of interface definition, concrete implementation, and mock creation in tests. The abstraction has accumulated negative value.

The concrete test for whether an abstraction earns its keep: **can you explain what the abstraction *prevents*, not just what it *provides*?** A `UserRepository` interface prevents callers from knowing they're talking to PostgreSQL. Is that something that needs preventing? If you're writing the only application that will ever use this database, the answer is probably no.

When abstractions genuinely pay for themselves:
- When they reduce cognitive load for callers (the interface is simpler than the underlying thing)
- When they isolate a known volatility (payment processors change, email providers change)
- When they exist at a natural boundary between components you want to be able to test independently

When they don't:
- When the interface mirrors the implementation 1:1 (an `IUserService` that has exactly the same methods as `UserService`)
- When the "might swap this out later" motivation has been true for more than a year without happening
- When you write the interface before you've written two implementations (you don't yet know where the seam should be)

## Cross-cutting concerns without violating layer boundaries

Auth, logging, tracing, and error handling don't belong to any one layer. Putting them in the wrong place causes either duplication (every layer logs) or leakage (your domain model knows about HTTP request context).

The patterns that work:

**Middleware / decorator chains** for request-scoped concerns. Auth, rate limiting, and request logging belong here. They see every request and don't need to know about business logic.

**Structured context propagation** for tracing. Don't pass a `trace_id` parameter through every function. Use Python's `contextvars` to carry trace context:

```python
from contextvars import ContextVar
trace_id: ContextVar[str] = ContextVar('trace_id', default='')

# Set at request boundary
trace_id.set(request_headers.get('X-Trace-ID', generate_trace_id()))

# Read anywhere in the call stack, without passing it as a parameter
def log_event(event: str) -> None:
    logger.info(event, extra={'trace_id': trace_id.get()})
```

**Domain events** for audit logging. Instead of sprinkling audit log calls through business logic, have operations emit domain events (`UserPasswordChanged`, `OrderCancelled`), and have an observer write the audit trail. The domain doesn't know anything about the audit system.

**The anti-pattern to avoid**: a `utils.py` or `helpers.py` that accumulates cross-cutting code until it becomes its own god module. Cross-cutting concerns need explicit homes — middleware, observers, context — not a junk drawer.

## The real module boundary test

A module boundary is genuine when you can answer yes to all three:

1. Can you describe the module's responsibility in one sentence without using "and"?
2. Can you change the module's internal implementation without any of its callers knowing?
3. Can you delete the module and replace it with a different implementation that satisfies the same contract?

The third test is the most rigorous and the most ignored. If "replacing" the module would require changing calling code, the boundary is leaky. Common leaks: callers receive the module's internal types (they now depend on internal details), callers must sequence multiple module calls to accomplish one logical operation (the module's interface is too low-level), or callers must handle the module's internal error types.

## Dependency injection without frameworks

Python doesn't need a DI framework. The patterns that work:

**Constructor injection** — pass dependencies in, don't instantiate them inside:

```python
# Not this
class OrderService:
    def __init__(self):
        self.db = PostgresConnection()  # hardwired
        
# This
class OrderService:
    def __init__(self, db: DatabaseProtocol, mailer: MailerProtocol):
        self.db = db
        self.mailer = mailer
```

**Module-level factories** for wiring up the application:

```python
# app/container.py
from functools import lru_cache

@lru_cache(maxsize=1)
def get_order_service() -> OrderService:
    return OrderService(
        db=get_database(),
        mailer=get_mailer(),
    )
```

The `lru_cache` makes the factory a singleton without global state. Tests replace it by calling the factory directly with test doubles.

**Protocol-based interfaces** instead of ABCs for flexibility:

```python
from typing import Protocol

class DatabaseProtocol(Protocol):
    def execute(self, query: str, params: dict) -> list[dict]: ...
```

Any object with an `execute` method satisfies this interface without inheriting from it. Your production Postgres adapter and your in-memory test fake both work.

## When flat is better than layered

The cost of layering: every additional layer adds indirection. Finding where a thing actually happens requires traversing more files. Debugging requires understanding more levels of abstraction.

For projects under ~5000 lines of application code, flat often wins. One layer: business logic functions, called directly by handlers, using injected data access functions. No service layer, no repository layer, no use case layer.

The signal to add a layer is not "the project grew" — it's "I am now making the same structural mistake repeatedly." You add a repository layer when you notice that your business logic is scattered with direct SQL queries that make testing painful. You add a service layer when you notice that your HTTP handlers contain business logic that needs to be called from a worker too.

Layers should be extracted, not anticipated. The refactoring cost of extracting a layer after the fact is much lower than the carrying cost of an unnecessary layer throughout the project's life.

## The strangler fig for god modules

When you have a 2000-line module that does too many things, the naive approach is to refactor it top-to-bottom. This always fails partway through — you've broken things, you can't see the full scope, and the PR is unbounded.

The strangler fig approach:

1. Don't touch the existing module.
2. When you need to add new functionality that conceptually belongs in the new design, add it to the new module instead.
3. When you touch existing functionality in the god module for any reason (bug fix, feature change), extract it to the new module at that time, not as a separate task.
4. Add a thin delegation shim in the old module: `from new_module import handle_payment` and then `handle_payment = handle_payment`.
5. When the old module contains only delegation shims, delete it.

The key discipline: you never set aside time to "refactor `payments.py`." The extraction happens as a side effect of normal work. This makes it sustainable.

The test coverage prerequisite: you can only safely strangle a module that has tests. If it doesn't have tests, your first task is to write characterization tests (tests that document the current behavior, not tests that verify correctness) before moving anything.
