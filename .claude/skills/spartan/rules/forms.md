# Forms and inputs

Use Spartan's `field` composition with the appropriate control instead of hand-assembling labels, errors, and validation state.

## Rules

- Wrap controls with `hlmField` where the Field component applies.
- Use `hlmFieldLabel`, `hlmFieldDescription`, and `hlm-field-error` rather than ad hoc equivalents.
- Use native `<fieldset>`/`<legend>` with Spartan fieldset directives for related checkbox/radio groups.
- For small fixed option sets, prefer `toggle-group` when its semantics match.
- Select controls by intent: input/textarea for free text, input-otp for codes, input-group for affixed controls, select/combobox/autocomplete for larger choices, radio/toggle-group for small choices, switch/checkbox for boolean state, slider for numeric range.
- Preserve Angular signal-first patterns from `AGENTS.md`.
- Production labels, descriptions, placeholders, and validation copy must use this repository's translation system.

Signal Forms, reactive forms, or other Angular form APIs may be used only in ways consistent with the repository's Angular architecture rules and the documented Spartan Field API.