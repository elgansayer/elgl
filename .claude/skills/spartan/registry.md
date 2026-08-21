# Distribution and registry

Spartan uses a two-layer distribution model:

- Brain primitives are npm packages under `@spartan-ng/brain/*`. Do not edit them.
- Helm components are copied into this repository by the CLI. They are project-owned code and can be customised.

## `components.json`

`components.json` is the Spartan project marker and records the Helm component path and import alias. Read effective values with `@spartan-ng/cli:info --json` rather than guessing them.

This repository already has `frontend/components.json`. Treat that file as authoritative for the frontend Spartan layout.

## Component catalogue

Use the CLI's reported `availableComponents` list and MCP component discovery. Do not invent remote registry URLs or assume an unavailable component exists.

## Adding components

Use the CLI, not manual copy/paste from memory:

```bash
npx nx g @spartan-ng/cli:ui --name=<component>
ng g @spartan-ng/cli:ui --name=<component>
```

Do not duplicate components already present in `installedComponents` or already implemented under the project's Helm UI directory.