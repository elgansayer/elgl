# Hourly Dead Code & Import Pruning

## Objective
Eliminate dead code, unused CSS, and orphaned files before they accumulate.

## Instructions
1. Run a dead code analysis tool or inspect recent commits.
2. Remove any unused imports, commented-out code blocks, and orphaned variables in `.ts` files.
3. Ensure no component has an inline `template:` if it also has an unused sibling `.html` file.
4. Verify all components declared are actually used or routed to.
