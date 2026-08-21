# Component-system verification

Run `npm run check:component-system` from the repository root. It fails when a shared primitive bypasses the owned Helm Button/Input/Textarea layer or reintroduces local focus mechanics.

The check is part of `npm run verify`; a failing result blocks the canonical component-system PR.
