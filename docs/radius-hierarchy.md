# Radius hierarchy

Status: authoritative contract for `[Spartan UI 0011]` and `[Spartan UI 0012]`.

Relay uses named radius roles so shape communicates component class consistently instead of drifting through arbitrary Tailwind radius steps.

## Canonical roles

- `rounded-app` (`0.75rem`): controls such as buttons, inputs and compact interactive containers.
- `rounded-card` (`1rem`): cards and standard content containers.
- `rounded-sheet` (`1.25rem`): dialogs, bottom sheets and large overlay surfaces.
- `rounded-bubble` (`1.125rem`): chat/message bubbles where the genre convention benefits from a distinct shape.
- `rounded-pill` (`9999px`): chips, pills, tags and badges whose pill silhouette is semantically intentional.
- `rounded-full`: reserved for truly circular geometry such as avatars, circular icon buttons, presence dots and circular progress indicators. It is not the generic pill token.

## Shared primitive mappings

- `AppButtonPrimaryComponent` and other standard controls use `rounded-app`.
- `AppCardComponent` uses `rounded-card`.
- `AppPillComponent` uses `rounded-pill`, not generic `rounded-full`.
- Dialog/sheet wrappers use `rounded-sheet` where Relay owns their presentation.
- Chat bubbles use `rounded-bubble` when they are actual conversational bubbles.

## Spartan integration

Spartan's generic `--radius` alias maps to Relay's control radius. Generated Helm files should remain close to upstream. Product-facing wrappers translate component classes to the correct named Relay role where the component category is known.

Do not globally redefine every Spartan radius to one value: a button, card, sheet and chat bubble intentionally have different product roles.

## Prohibited patterns

- Generic `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` or arbitrary radius utilities in shared Relay primitives where a named role exists.
- `rounded-full` for pills/chips/tags simply because it creates a capsule.
- Using `rounded-pill` for ordinary rectangular buttons.
- Hardcoded `border-radius` declarations in shared primitives when a Relay radius role exists.
- Flattening all component types to one Spartan radius.

## Accessibility and responsive behaviour

Radius is presentation only and must never be the sole carrier of state or meaning. At high zoom/reflow, rounded containers must not clip labels, focus rings, translated text or projected content. The hierarchy is theme-independent and direction-neutral.

## Migration scope

The foundation guard applies to shared Relay primitives first. Existing feature-level generic radii are converted by their numbered feature/screen migration tickets so this architectural batch does not trigger uncontrolled visual churn.

## Verification

Run:

```bash
cd frontend
npm run check:radius-hierarchy
```

The gate verifies the named Tailwind radius roles, canonical card/button/pill mappings, and prevents generic large/arbitrary radii or hardcoded `border-radius` values from being introduced into shared primitives.
