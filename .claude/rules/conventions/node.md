# Node.js Coding Conventions

## Style

- Use ESM (`import`/`export`) over CommonJS (`require`)
- Prefer `const` over `let`; avoid `var`
- Use template literals for string interpolation
- Semi-colons optional but be consistent within a project

## Architecture

- `scripts/` for build and automation scripts
- `src/` or project root for source code
- Config via `package.json` scripts, not Makefiles

## Naming

- camelCase for variables and functions
- PascalCase for classes and components
- kebab-case for file names and directories
- UPPER_SNAKE_CASE for constants

## Testing

- Use the project's chosen test framework (jest, vitest, node:test)
- Test files as `*.test.js` or `*.spec.js`

## Packaging

- `package.json` for all metadata and scripts
- Lock file (`package-lock.json`) committed to repo
- Pin major versions in dependencies
