# Motion durations and easing

Status: authoritative contract for `[Spartan UI 0015]` and `[Spartan UI 0016]`.

Relay owns product motion timing. Shared primitives and product wrappers use named durations and the standard easing curve rather than one-off Tailwind duration steps or hardcoded cubic-bezier values.

## Canonical motion roles

- `duration-fast` / `--app-motion-fast`: 140ms for immediate micro-state feedback.
- `duration-base` / `--app-motion-base`: 180ms for standard control, feedback and surface transitions.
- `duration-slow` / `--app-motion-slow`: 260ms for larger deliberate transitions where the extra time improves spatial comprehension.
- `ease-app` / `--app-ease-standard`: the standard Relay product easing curve.

The Tailwind and CSS-variable forms represent the same product roles. Use Tailwind utilities in templates/class strings and CSS variables inside keyframe/animation declarations.

## Reduced motion

Non-essential entrance, movement and decorative animation must honour `prefers-reduced-motion: reduce`. Removing motion must not hide content or delay essential state changes.

Continuous functional indicators such as media/equalizer activity may require specialised timing, but must still provide a reduced-motion treatment and should not introduce a new global product easing token without a documented need.

## Shared feedback primitives

- Toast transitions use `duration-base ease-app`; their entrance animation uses `--app-motion-base` and `--app-ease-standard`, with animation disabled for reduced motion.
- Network status feedback uses `duration-base ease-app`.
- Buttons and other shared interactive primitives already use named Relay motion roles and should continue to do so.

## Spartan integration

Spartan Brain owns interaction state, not HelloTalk product motion timing. Generated Helm code may retain upstream animation internals where necessary for regeneration fidelity. Relay wrappers own product-facing motion and should map reusable transitions to Relay roles instead of editing generated files ad hoc.

## Prohibited patterns

- Legacy generic duration utilities such as `duration-300`, `duration-500`, etc. in shared Relay primitives when a Relay role applies.
- Arbitrary duration utilities such as `duration-[175ms]` in shared primitives.
- Hardcoded `transition-duration` in shared primitives instead of a named role.
- Hardcoded product `cubic-bezier(...)` values in shared primitives when `ease-app` / `--app-ease-standard` applies.
- Non-essential movement without a reduced-motion treatment.

## Migration scope

The foundation guard applies to shared Relay primitives. Feature-level legacy animation timing is migrated alongside the corresponding numbered component/screen tickets, avoiding a visually risky repository-wide timing rewrite.

## Verification

Run:

```bash
cd frontend
npm run check:motion-contract
```

The gate verifies Relay motion tokens, canonical toast/network mappings, reduced-motion coverage for the toast entrance animation, and scans shared primitive source for legacy/arbitrary duration values or hardcoded product easing curves.
