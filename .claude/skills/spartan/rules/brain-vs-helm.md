# Brain vs Helm

Spartan components have two layers:

| Layer | Package | Role | Distribution |
| --- | --- | --- | --- |
| Brain | `@spartan-ng/brain/<name>` | Headless behaviour and accessibility | npm dependency |
| Helm | `@spartan-ng/helm/<name>` | Tailwind styling layered over Brain | Copied into the project |

## Rules

- Use Helm by default for application UI.
- Use Brain directly only when intentionally building a fully custom styled layer that still needs Spartan behaviour/accessibility.
- Never edit or fork Brain.
- Customise copied Helm files and project theme tokens.
- Prefer each component's documented `*Imports` barrel in standalone components.
- Confirm exact import paths and selectors using MCP/docs rather than guessing.

## Composition

Spartan commonly composes behaviour using directives on host elements and portal/content directives. Triggers, items, content, and groups must follow documented nesting.

Overlay primitives such as dialogs, sheets, popovers, tooltips, and menus rely on Angular CDK stacking. Do not bolt on manual z-index systems.