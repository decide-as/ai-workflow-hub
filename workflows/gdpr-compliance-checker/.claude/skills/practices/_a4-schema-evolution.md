# Schema Evolution

## You're changing a contract while people hold references to the old one

Schema evolution is deceptively hard because it looks like a data problem but is actually a coordination problem. Your configuration file has 200 users. You need to rename a field. The moment you deploy the new code, every existing config file is broken — and unlike an API where you control both sides, config files live on other people's machines where you cannot reach them.

The naive approach — "just rename it and tell people to update" — fails at any non-trivial scale. People don't read changelogs. Automated systems don't update themselves. And "it worked in development" means nothing when production has configs created six months ago that have never been touched.

The disciplined approach: make every schema change through a system that classifies the change, enforces compatibility rules, and provides automated migration. This costs more upfront and saves orders of magnitude more when your user base grows past a handful.

## Version field strategy

Every schema needs a version field from day one. Retrofitting one later is the first migration problem you'll face, and it's harder than any subsequent one.

```yaml
# project-meta.yaml
schema_version: "1.0"
name: my-project
version: "0.1.0"
```

Use `MAJOR.MINOR` format — schemas don't have patch versions because schemas don't have bug fixes. A schema is either a valid contract or it isn't.

- **MAJOR bump**: a field was removed, renamed, or changed type. Existing configs will not validate against the new schema without migration.
- **MINOR bump**: a new optional field was added with a default value. Existing configs are automatically valid — the new field simply isn't present, and tools fill in the default.

The temptation is to avoid bumping the major version because it forces migration work. Resist this. A major version bump that provides clean migration is far better than a "compatible" change that silently changes semantics and breaks downstream tools in ways that are impossible to debug.

## Change classification

Not all changes are equal. Classify every proposed change before making it:

| Change type | Version bump | Migration needed | Example |
| --- | --- | --- | --- |
| Add optional field with default | Minor | No | Add `has_ui: false` |
| Add required field | Major | Yes | Add `schema_version` (required) |
| Remove field | Major | Yes | Remove deprecated `forge_version` |
| Rename field | Major | Yes | `test_cmd` → `test_command` |
| Change field type | Major | Yes | `tags: string` → `tags: list` |
| Add enum value | Minor | No | New category option |
| Remove enum value | Major | Yes | Drop deprecated category |
| Change default value | Minor | No | `quality_gate` default `none` → `basic` |

The critical insight: "add a field" is only a minor change if the field has a sensible default. A field that defaults to empty string or `null` and then causes downstream code to behave differently is a major change wearing minor clothing.

## The "additive by default" principle

Every new field should be optional with a default that preserves the current behavior. This is the single most important rule for schema evolution: existing configs must continue to work identically without modification.

When you need a required field, the rollout sequence is:

1. Add it as optional with a default that matches the most common case.
2. Emit a deprecation warning when the field is absent.
3. In the next major version, make it required. The migration function fills in the default for configs that don't have it.

Never add a required field without a migration step. "Just add it and let validation fail" means every user's next interaction with your tool starts with a cryptic validation error and a hunt through changelogs.

## Forward-only migration chains

Migrations apply in strict sequence: `1.0 → 1.1 → 1.2 → 2.0`. Never skip versions. Each migration function handles exactly one step, and the chain composes them.

```python
MIGRATIONS = {
    ("1.0", "1.1"): lambda data: {**data, "has_ui": data.get("has_ui", False)},
    ("1.1", "1.2"): lambda data: {**data, "practice_overrides": data.get("practice_overrides", {})},
    ("1.2", "2.0"): migrate_1_2_to_2_0,
}

def apply_migrations(data: dict, from_version: str, to_version: str) -> dict:
    current = from_version
    while current != to_version:
        next_ver = find_next_version(current)
        migration = MIGRATIONS[(current, next_ver)]
        data = migration(data)
        data["schema_version"] = next_ver
        current = next_ver
    return data
```

Why forward-only: backward migrations are rarely needed and double the test surface. If someone needs to downgrade, they can check out the old code and the old config from version control.

## Migration function contracts

Each migration function must satisfy four properties:

1. **Pure**: takes a dict, returns a new dict. No in-place mutation, no side effects.
2. **Idempotent**: running it twice on the same input produces the same result. This protects against accidental double-migration.
3. **Preserves unknown fields**: if the input has a field the migration doesn't recognize, pass it through. This enables forward compatibility — newer configs processed by older migration code don't lose data.
4. **Validates output**: after migration, validate the result against the target schema. Migration bugs should fail loudly, not produce subtly invalid configs.

The idempotency requirement is the one engineers forget most often, and it's the one that saves you when a user runs `cp migrate` on a config that was already partially migrated by a previous tool version.

## Automated migration CLI

Provide a command that handles the full lifecycle:

```bash
cp migrate project-meta.yaml
```

This should: detect the current `schema_version`, apply migrations in sequence, write the updated file (preserving comments if using ruamel.yaml), and report what changed. If the file is already at the latest version, say so and exit cleanly — don't rewrite it.

The CLI is the contract with your users. "Update your config" is not a valid migration strategy. "Run `cp migrate`" is.

## Backward compatibility windows

Define explicit support windows, not open-ended promises:

- **Current version**: fully supported. All tools work.
- **Previous major version**: read-only support. Tools can read and warn about deprecation.
- **Older versions**: tools refuse to operate and print `Run 'cp migrate' to update your config`.

The refusal to operate on old schemas is intentional. Silent best-effort handling of old schemas leads to subtle bugs that surface weeks later. A clear error message with a concrete fix is better than a mysterious misbehavior.

## Communication

When releasing a schema change:

- **Minor bump**: mention new fields in the changelog. No action required from users — this is the whole point of making changes additive.
- **Major bump**: document the migration path, provide the CLI command, and give at least one minor release of deprecation warnings before removing old behavior. Users should never be surprised by a breaking change.

The anti-pattern: releasing a major schema change in a patch version because "it's a small rename." Version numbers communicate compatibility promises. A rename that breaks existing configs is a major change regardless of how small the diff looks.
