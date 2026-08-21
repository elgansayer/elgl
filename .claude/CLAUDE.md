# HelloTalk Project Instructions for Claude

## Design System

This project has a `DESIGN.md` at the repo root. Use it for design context.

## Spartan UI - Mandatory Frontend Default

Spartan UI is the canonical component architecture for frontend UI work.

- The official Spartan agent skill is installed at `.claude/skills/spartan/SKILL.md`. Load and follow it for frontend component, form, overlay, icon, styling, theming, and UI migration work.
- Before generating or replacing Spartan UI, inspect `frontend/components.json` and run the appropriate `@spartan-ng/cli:info --json` command from the frontend workspace.
- Use Spartan MCP/docs to confirm component APIs and examples. Never guess Spartan selectors, inputs, variants, or composition rules.
- Prefer existing Spartan Helm components under `frontend/src/app/components/ui` before creating new primitives or ad hoc Tailwind markup.
- Use Helm by default. Brain owns behaviour/accessibility and must not be forked or edited.
- Add missing components through `@spartan-ng/cli:ui`, not by recreating them from memory.
- Use documented component variants/sizes before local class overrides.
- Keep Relay semantic tokens, `DESIGN.md`, accessibility, RTL, i18n, theme parity, reduced-motion, and per-user primary accent rules as project-specific constraints over generic Spartan defaults.
- After broad Spartan changes or dependency upgrades, run the Spartan healthcheck and the repository frontend verification gates.

See `frontend/AGENTS.md` for the scoped frontend Spartan rules.

## Open CoDesign (Local Desktop Tool)

Open CoDesign v0.2.1 is installed at `~/.local/bin/open-codesign`.
Launch it to generate prototypes and UI mockups locally with your own API key.
It reads `DESIGN.md` from the project root for brand tokens and component primitives.

## Claude Design (Web)

`docs/claude-design-two-way-sync.md` is the authoritative contract for design-first, code-first, and reconciliation workflows.

- Before UI design work, run `/design-sync` so Claude Design starts from the latest repository design system.
- Use `/design` or the Claude Design MCP to prototype and edit components, screens, and flows.
- After implementation, reconcile the final runtime state back to the mapped Claude Design artefacts before declaring a material visual contract complete.
- Runtime Angular code, Relay semantic tokens, approved Relay primitives, Spartan interaction contracts, and automated tests remain authoritative for shipped software. Claude Design is the editable design-intent and review workspace.
- Never silently overwrite one side when both code and Claude Design changed after the last reconciliation. Resolve the conflict explicitly using the two-way sync contract.
- Design-first changes enter runtime through ordinary reviewed branches and PRs. Claude Design is not a deployment path.
- Keep `frontend/design-preview/` as the deterministic repository-local visual mirror and fallback when the external design service is unavailable.
- Once stable design-sync IDs and provenance metadata are available, include the affected IDs in material UI PRs.

## Claude Code Integration

- `@design` -- reference the DESIGN.md for visual context
- The project uses Angular v22 (standalone, signals, control flow) and NestJS
- See `AGENTS.md` for the full engineering constitution
- See `.claude/skills/spartan/SKILL.md` for Spartan component workflow and procedural rules

## Key Files

- `DESIGN.md` -- design system tokens and guidelines
- `docs/claude-design-two-way-sync.md` -- bidirectional code and Claude Design reconciliation contract
- `docs/spartan-relay-architecture.md` -- ownership boundary between feature, Relay, Helm, and Brain layers
- `AGENTS.md` -- engineering standards and conventions
- `frontend/AGENTS.md` -- scoped Spartan-first frontend implementation rules
- `.claude/skills/spartan/` -- installed Spartan agent skill and references
- `frontend/components.json` -- Spartan CLI/project configuration
- `specs/` -- feature specifications
- `original-hello-talk-screenshots/` -- reference screenshots for visual parity

## Frontend Stack

- Angular v22+, Tailwind CSS v4, Spartan UI Brain + owned Helm layer
- No NgModules -- all standalone components
- No decorator Input/Output -- use signal input()/output()
- No *ngIf/*ngFor -- use @if/@for control flow
- No hardcoded strings -- use TranslatePipe (`| t`)
- No physical direction CSS -- use logical properties (ps/pe/ms/me)
- Do not create a custom primitive when a suitable Spartan component already exists
