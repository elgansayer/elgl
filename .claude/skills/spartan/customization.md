# Theming and customisation

spartan/ui requires Tailwind CSS and the Spartan preset. Theme colours are semantic CSS variables with light and dark definitions. Use the project's existing Relay/Spartan token layer rather than introducing raw palette values.

## Core rules

- Keep semantic tokens defined for both light and dark themes.
- Prefer theme variables and existing Helm variants over local overrides.
- Helm code is owned by this repository and may be customised.
- Brain is an npm dependency and must not be forked or edited.
- After Spartan package upgrades, run `@spartan-ng/cli:healthcheck --autoFix`.

## Semantic variables

Canonical Spartan roles include `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring`, radius, and sidebar roles.

When adding a project-specific semantic role, define it for both themes and expose it through Tailwind rather than hard-coding colours in components.

## Dark mode

Theme switching must happen through semantic variables. Components should not need one-off dark-mode colour patches when a semantic token exists.

## Project precedence

`DESIGN.md`, `AGENTS.md`, Relay tokens, accessibility requirements, RTL rules, and the per-user primary accent contract are authoritative project-specific constraints. Adapt copied Helm code to these contracts instead of replacing them with generic defaults.