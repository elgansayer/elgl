# Shared primitives

These components are the product compatibility layer between feature code and the owned Spartan Helm layer in `../ui`.

Interactive wrappers must delegate their native control to Helm (`hlmBtn`, `hlmInput`, `hlmTextarea`, and generated equivalents) rather than implementing a parallel focus/disabled/keyboard system. Non-interactive primitives remain Relay-token components.

Run `npm run check:component-system` from the repository root to verify this boundary.
