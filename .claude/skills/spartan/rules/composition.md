# Component composition

Always confirm selectors through Spartan MCP/docs before writing templates. Use each component's documented imports and nesting.

## Required composition patterns

- Select items belong inside select content/groups.
- Toggle-group items belong inside `hlm-toggle-group`.
- Tab triggers belong inside `hlm-tabs-list`.
- Accordion trigger/content belong inside accordion items, inside the accordion root.
- Dialogs, sheets, and alert dialogs require an accessible title. Use `sr-only` if the visual design hides it.
- Use complete card structure instead of styling arbitrary `div`s when the Card primitive fits.
- Avatars require a fallback.
- Buttons do not gain invented loading APIs. Compose the documented spinner and disabled state.

## Prefer Spartan primitives over custom markup

- Callouts/messages: Alert
- Empty states: Empty
- Toasts: Sonner/toaster
- Dividers: Separator
- Loading placeholders: Skeleton
- Status pills: Badge
- Loading indicators: Spinner
- Modal/overlay UI: Dialog, Sheet, Alert Dialog, Popover, Tooltip as appropriate

Project i18n still applies: examples from upstream docs may contain literal English for illustration, but production templates in this repository must use the translation system from `AGENTS.md`.