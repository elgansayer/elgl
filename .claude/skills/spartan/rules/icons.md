# Icons

Spartan uses `@ng-icons`, with Lucide as the canonical icon set in this project.

## Rules

- Render vector UI icons with `<ng-icon>` and documented Lucide names.
- Register every used icon through `provideIcons` at the appropriate component/app scope.
- Prefer the existing `@ng-icons/core` + `@ng-icons/lucide` stack. Do not introduce a competing icon library.
- Use semantic colour classes for icon colour.
- Follow Spartan/component size APIs and the project's icon sizing contract before adding manual size utilities.
- Keep flags, language indicators, product illustrations, and content imagery semantically separate from generic UI icons.
- Decorative icons must not create redundant accessible names; meaningful icon-only controls require translated accessible labels.

If an icon fails to render, first verify its `provideIcons` registration and exact Lucide symbol name.