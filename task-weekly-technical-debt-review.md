# Weekly Architecture Constitution Review

## Objective
Validate that the repository strictly adheres to `AGENTS.md` rules.

## Instructions
1. Read `AGENTS.md`.
2. Do a spot check across the codebase for banned decorators (`@ViewChild`, `@Output`) and banned syntax (`ngClass`, `.subscribe()`).
3. Ensure no `console.log` statements have slipped into production code.
4. Execute `node scripts/verify-constitution.mjs` and address any flagged violations.
