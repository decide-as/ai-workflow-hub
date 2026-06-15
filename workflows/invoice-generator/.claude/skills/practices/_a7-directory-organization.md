# Directory Organization

## Why directory size matters

A flat directory with 10+ files exceeds working memory capacity (Miller's Law, 7+/-2 items). You can no longer scan the listing and hold its contents mentally. IDE file trees overflow, tab bars saturate, and the directory almost certainly contains 2-3 cohesive subgroups hiding in plain sight.

The inverse problem is equally damaging: subdirectories with 1-2 files add navigation depth without reducing cognitive load. Every click costs attention.

## Thresholds

| Context | Max files | Rationale |
|---------|-----------|-----------|
| Python directories | 12 | Django apps produce 9 framework files naturally; 12 gives headroom without masking bloat |
| Test directories | 15 | Test files mirror source 1:1, so test dirs are inherently larger |
| All other languages | 10 | Aligned with cognitive load research and industry convention |

**What counts**: only substantive source files. Infrastructure files are excluded:
- **Python**: `__init__.py`, `conftest.py`, `setup.py`, `setup.cfg`, `py.typed`
- **TypeScript**: `index.ts`, `index.tsx`, `index.js`, `package.json`
- **Go**: `doc.go`, `go.mod`, `go.sum`
- **Rust**: `mod.rs`, `lib.rs`, `main.rs`, `build.rs`, `Cargo.toml`
- **Universal**: `.gitignore`, `LICENSE`, `Makefile`, `Dockerfile`, `.dir-size-exempt`

Gitignored files are never counted. Hidden files (`.` prefix) are never counted.

## Minimum subdirectory size

Subdirectories must contain at least **3 substantive files**. A subdirectory with 1-2 files is over-organization — collapse it into the parent directory.

Exceptions:
- **Namespace packages** (`__init__.py`-only directories) are not flagged
- Directories with a `.dir-size-exempt` marker are skipped

## Enforcement

This is a **hard requirement** enforced by `check-dir-size.py`. The script exits non-zero on overflow violations.

### Running the check

```bash
# Run against current directory
python3 .claude/scripts/check-dir-size.py

# Run against a specific root
python3 .claude/scripts/check-dir-size.py --root src/

# Dry run (report violations but exit 0)
python3 .claude/scripts/check-dir-size.py --dry-run

# Verbose (show all directories, not just violations)
python3 .claude/scripts/check-dir-size.py --verbose
```

### CI enforcement

Add a structural test to your test suite:

```python
import subprocess
import sys
from pathlib import Path

def test_directory_sizes():
    """All directories must be within size thresholds."""
    project_root = Path(__file__).resolve().parents[1]
    script = project_root / ".claude" / "scripts" / "check-dir-size.py"
    result = subprocess.run(
        [sys.executable, str(script), str(project_root)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Directory size violations found:\n{result.stdout}"
    )
```

Or add a Makefile target:

```makefile
check-dir-size:
	python3 .claude/scripts/check-dir-size.py
```

## Opting out

When a directory intentionally exceeds the threshold (generated code, migrations, vendor bundles), opt out per-directory:

### Universal marker file

Create a `.dir-size-exempt` file in the directory. Optionally include a reason:

```
Generated code — models auto-generated from OpenAPI spec.
```

### Init file marker comment

Add a marker comment to the directory's init file:

**Python** (`__init__.py`):
```python
# dir-size: exempt
```

**TypeScript** (`index.ts`):
```typescript
// dir-size: exempt
```

**Go** (`doc.go`):
```go
// dir-size: exempt
```

**Rust** (`mod.rs`):
```rust
// dir-size: exempt
```

Languages without init files (R, Swift, Ruby) use only the universal `.dir-size-exempt` marker.

## How to reorganize

When a directory exceeds the threshold, split it into semantic subdirectories. The names should reflect the concern, not be mechanical groupings.

**Good**: `models/`, `services/`, `handlers/`, `validators/`
**Bad**: `part1/`, `group_a/`, `misc/`

### Python reorganization

1. Create the subdirectory with an `__init__.py`
2. Move files into the subdirectory
3. Update `__init__.py` in the parent to re-export moved symbols for backwards compatibility (if this is a library):
   ```python
   from .validators.email import validate_email  # noqa: F401
   ```
4. Update all import statements across the project
5. Run tests to verify nothing broke

### TypeScript reorganization

1. Create the subdirectory with an `index.ts` barrel file
2. Move files into the subdirectory
3. Update `index.ts` to re-export:
   ```typescript
   export { validateEmail } from './validators/email';
   ```
4. Update import paths across the project
5. Run tests and type-checking

### Go reorganization

Go packages are directories. Splitting a large package means creating new packages:

1. Create a new directory (this becomes a new package)
2. Move files, updating the `package` declaration
3. Update import paths across the project
4. Consider whether the new package should be internal (`internal/`)

### R reorganization

1. Create subdirectories under `R/`
2. Move `.R` files into semantic subdirectories
3. Update `NAMESPACE` if using explicit exports
4. Update `source()` calls or `devtools::load_all()` configuration

## Multi-language directories

When a directory contains files from multiple languages (e.g., Django templates mixed with Python), **all substantive files count together**. The threshold is determined by the majority language in that directory.

A Django app's `templates/` subdirectory with 12 `.html` files triggers at the default threshold of 10 — split templates into subdirectories by feature area, matching the pattern you'd use for the source code.

## Supported languages

| Language | Threshold | Init file | Marker pattern | Extensions |
|----------|-----------|-----------|----------------|------------|
| Python | 12 | `__init__.py` | `# dir-size: exempt` | `.py` |
| TypeScript | 10 | `index.ts`, `index.tsx` | `// dir-size: exempt` | `.ts`, `.tsx`, `.js`, `.jsx` |
| Go | 10 | `doc.go` | `// dir-size: exempt` | `.go` |
| Swift | 10 | — | — (use `.dir-size-exempt`) | `.swift` |
| Rust | 10 | `mod.rs` | `// dir-size: exempt` | `.rs` |
| HCL/Terraform | 10 | — | — (use `.dir-size-exempt`) | `.tf`, `.tfvars`, `.hcl` |
| Other | 10 | — | — (use `.dir-size-exempt`) | — |
