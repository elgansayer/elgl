# CLI reference (`@spartan-ng/cli`)

The CLI is an Nx plugin that also runs as Angular CLI schematics. Pick the invocation that matches the workspace (`info --json` reports `workspaceType`):

- Nx (`nx.json` present): `npx nx g @spartan-ng/cli:<generator>` (or `pnpm nx g ...`).
- Angular CLI (`angular.json`, no `nx.json`): `ng g @spartan-ng/cli:<generator>`.

Install the plugin first: `npm i -D @spartan-ng/cli`.

## Core generators

### `init`

One-time setup. Installs the required dependencies and runs the theme generator.

```bash
npx nx g @spartan-ng/cli:init
ng g @spartan-ng/cli:init
```

`components.json` is created on the first `ui` run, not by `init`.

### `ui`

Adds components, installs Brain dependencies, and copies Helm code into `componentsPath`.

```bash
npx nx g @spartan-ng/cli:ui
npx nx g @spartan-ng/cli:ui --name=dialog
ng g @spartan-ng/cli:ui --name=button
```

Dependent components are pulled in automatically.

### `ui-theme`

Generates light and dark CSS theme variables.

```bash
npx nx g @spartan-ng/cli:ui-theme
ng g @spartan-ng/cli:ui-theme
```

### `info`

Read-only project context for agents.

```bash
npx nx g @spartan-ng/cli:info --json
ng g @spartan-ng/cli:info --json
```

### `healthcheck`

Scans for deprecated APIs, outdated imports, and breaking changes and can auto-fix them.

```bash
npx nx g @spartan-ng/cli:healthcheck
npx nx g @spartan-ng/cli:healthcheck --autoFix
ng g @spartan-ng/cli:healthcheck --autoFix
```

Run it after upgrading `@spartan-ng` packages or after broad Spartan migrations.

## Migration generators

Prefer `healthcheck` for normal upgrades. Use a specific `migrate-*` generator only when deliberately targeting one migration.

```bash
npx nx g @spartan-ng/cli:migrate-helm-imports
```
