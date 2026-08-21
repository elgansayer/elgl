---
name: spartan
description: >-
  Manages spartan/ui, the Angular UI library - adding, composing, fixing, debugging, and styling UI
  with the Brain (headless primitives) and Helm (styled) layers. Provides project context, component
  APIs, and usage examples. Applies when working with spartan/ui, @spartan-ng/brain, @spartan-ng/helm,
  the @spartan-ng/cli generators, or any Angular project with a components.json file. Also triggers
  for "spartan init", "add a spartan component", or "set up spartan/ui".
user-invocable: false
allowed-tools:
  - Bash(npx nx g @spartan-ng/cli:*)
  - Bash(pnpm nx g @spartan-ng/cli:*)
  - Bash(ng g @spartan-ng/cli:*)
---

# spartan/ui

spartan/ui is an Angular UI library. It uses a two-layer architecture:

- Brain (`@spartan-ng/brain`) - accessible, unstyled primitives installed from npm. This is the behaviour and accessibility layer.
- Helm (`@spartan-ng/helm`) - the styled Tailwind + class-variance-authority layer copied into the project by the CLI so the project owns and can customise it.

Compose Helm directives/components onto host elements; Helm wires up the matching Brain primitive. Always prefer existing components over hand-written markup.

## Current project context

Before generating code, gather project context with the workspace runner:

```bash
npx nx g @spartan-ng/cli:info --json
ng g @spartan-ng/cli:info --json
```

Use the output to determine workspace type, `componentsPath`, import alias, package versions, icon library, Tailwind stylesheet, installed components, and available components. Do not re-add installed components. If the project is not set up, initialise Spartan first.

## Principles

1. Use existing components first. Check installed and available components, then confirm the API through the Spartan MCP server or live docs.
2. Compose, do not reinvent. Build UI from existing Helm + Brain pieces instead of ad hoc markup.
3. Use built-in variants and sizes before custom styling.
4. Use semantic colour tokens, never raw palette values.
5. Confirm selectors and composition patterns before implementation. Never guess Spartan APIs.

## Critical rules

Read the related reference before doing the work:

- `rules/styling.md` - semantic tokens, `hlm()`, layout-only classes, spacing, dark mode, overlays.
- `rules/forms.md` - field composition, fieldsets, validation, and control selection.
- `rules/composition.md` - group nesting, dialogs/sheets, cards, tabs, avatar fallback, feedback primitives.
- `rules/icons.md` - `ng-icon`, Lucide, registration, and sizing.
- `rules/brain-vs-helm.md` - Brain/Helm responsibilities and when direct Brain usage is appropriate.
- `cli.md` - Spartan CLI generators and verification commands.
- `registry.md` - Brain npm + Helm copy-in model and `components.json`.
- `customization.md` - Tailwind preset, CSS variables, theming, and Helm customisation.
- `mcp.md` - Spartan MCP discovery tools, resources, and prompts.

## Component selection

| Need | Component(s) |
| --- | --- |
| Action / button | `button` (`hlmBtn`), `button-group` |
| Text/number input | `input`, `textarea`, `input-otp`, `input-group`, `native-select` |
| Choice input | `select`, `combobox`, `autocomplete`, `radio-group`, `checkbox`, `switch`, `slider` |
| Toggle 2-7 options | `toggle-group` |
| Form layout/validation | `field`, `label` |
| Data display | `table`, `card`, `badge`, `avatar`, `kbd`, `item` |
| Navigation | `sidebar`, `navigation-menu`, `breadcrumb`, `tabs`, `pagination` |
| Overlays | `dialog`, `sheet`, `alert-dialog`, `popover`, `hover-card`, `tooltip` |
| Menus | `dropdown-menu`, `context-menu`, `menubar`, `command` |
| Feedback | `sonner`, `alert`, `progress`, `skeleton`, `spinner` |
| Layout/containers | `card`, `separator`, `resizable`, `scroll-area`, `accordion`, `collapsible`, `aspect-ratio` |
| Empty states | `empty` |
| Dates | `calendar`, `date-picker` |
| Icons | `icon` (`@ng-icons`) |
| Typography | `typography` |

## Workflow

1. Run `@spartan-ng/cli:info --json` before generating or replacing UI.
2. Check installed components and do not create duplicates.
3. Use Spartan MCP/docs to confirm the exact component API and examples.
4. Add missing components through `@spartan-ng/cli:ui --name=<component>`.
5. Compose correctly using the component `*Imports` barrel or exact documented imports.
6. Register every `ng-icon` with `provideIcons`.
7. Run the Spartan healthcheck after meaningful Spartan changes or upgrades.
8. Customise Helm/theme tokens in-project. Never fork or edit Brain.

## Quick reference

```bash
npx nx g @spartan-ng/cli:init
npx nx g @spartan-ng/cli:info --json
npx nx g @spartan-ng/cli:ui --name=dialog
npx nx g @spartan-ng/cli:ui-theme
npx nx g @spartan-ng/cli:healthcheck --autoFix
```

This project also has repository-specific design and accessibility constraints in `AGENTS.md` and `DESIGN.md`. Those requirements remain authoritative when they are stricter than generic Spartan defaults.