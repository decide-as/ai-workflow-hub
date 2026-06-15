.PHONY: install test lint format clean coverage update-coverage tiered-coverage update-tier-badge typecheck quality check-sync ci-local ci-local-fast test-paradigm test-analytics test-analytics-stats update-analytics-stats test-analytics-delta check-analytics

# ── Venv-aware python ────────────────────────────────────────────────────────
# Use the venv python directly instead of relying on PATH (which may not be
# respected by sandboxed environments). All Python tools are invoked via
# $(PYTHON) -m to guarantee venv isolation.
PYTHON := $(CURDIR)/.venv/bin/python3

install:
	$(PYTHON) -m pip install -e ".[dev,test]"

test:
	$(PYTHON) -m pytest tests/ -v

coverage:
	$(PYTHON) -m pytest tests/ -v --cov=src/task_prioritiser --cov-report=term-missing --cov-report=json --cov-fail-under=60

update-coverage:
	bash .claude/scripts/update-coverage-badge.sh

tiered-coverage:
	$(PYTHON) -m pytest tests/ -v --cov=src/task_prioritiser --cov-report=json --cov-report=term-missing
	$(PYTHON) -m code_practices.quality.coverage_tiers --check coverage.json --gate $${GATE:-basic}

update-tier-badge: tiered-coverage
	$(PYTHON) -m code_practices.quality.coverage_tiers --check coverage.json --gate $${GATE:-basic} --json-summary tier-summary.json || true
	bash .claude/scripts/update-tier-badge.sh tier-summary.json


lint:
	$(PYTHON) -m ruff check .
	$(PYTHON) -m ruff format --check .

format:
	$(PYTHON) -m ruff check --fix .
	$(PYTHON) -m ruff format .

typecheck:
	$(PYTHON) -m mypy src/task_prioritiser/


quality: lint typecheck coverage

check-sync:
	bash .claude/scripts/validate-metadata-sync.sh

ci-local-fast: lint typecheck

ci-local: lint typecheck test

test-paradigm:
	$(PYTHON) scripts/test_paradigm_counts.py --update

test-analytics:
	@if [ -s .analytics-queue ]; then \
		while IFS= read -r f; do \
			$(PYTHON) .claude/scripts/evaluate_test_file.py "$$f"; \
		done < .analytics-queue; \
		rm -f .analytics-queue; \
	else \
		echo "[TQS] Queue is empty. Edit a test file to queue it, or run make update-analytics-stats."; \
	fi

test-analytics-stats:
	$(PYTHON) .claude/scripts/test_analytics_stats.py

update-analytics-stats:
	$(PYTHON) .claude/scripts/update_analytics.py $(ARGS)

test-analytics-delta:
	@$(PYTHON) .claude/scripts/analytics_delta.py

check-analytics:
	bash .claude/scripts/check-tqs.sh

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache dist build .coverage

