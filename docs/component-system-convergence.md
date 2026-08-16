# Component-system convergence

This is the canonical implementation contract for the Relay + Spartan migration of `frontend/src/app/components`.

## Ownership

- Spartan Helm owns interaction mechanics and baseline accessibility for controls.
- Relay owns semantic product tokens, density, motion, state and product-specific visual meaning.
- Feature components compose Helm directly or consume the thin `app-*` compatibility wrappers in `components/primitives`.
- Compatibility wrappers must delegate native interactive elements to Helm. They must not recreate focus, disabled, keyboard or ARIA mechanics in parallel.

## Generated Helm surface

The repository-owned Helm layer currently includes button, dialog, input, textarea and shared utilities under `frontend/src/app/components/ui`. New Spartan primitives must follow the same local generated-source/TypeScript-path convention.

## Migration rule

A shared primitive containing `<button>`, `<input>` or `<textarea>` is incomplete unless the element carries `hlmBtn`, `hlmInput` or `hlmTextarea` respectively. `npm run check:component-system` enforces this fail-closed rule across every non-test shared primitive source file.

Native controls may remain where the platform-native behavior is an explicit product requirement, but they must not recreate a competing visual/focus system. Select is intentionally retained as the native mobile picker boundary until the generated Spartan select is introduced without regressing mobile picker behavior.

## Design synchronization

`spartan.component-system` in `design-sync.manifest.json` maps the entire component tree to `frontend/design-preview/components/component-system.html`. Any visual component-system change therefore participates in the two-way Claude Design reconciliation gate.

## Completion definition

The component migration is complete when:

1. all shared interactive primitives delegate to the owned Helm layer;
2. feature components use Helm or those shared primitives rather than bespoke interaction styling;
3. no new raw feature control bypasses the existing Spartan changed-file boundary;
4. the component-system verifier, design-sync checks, frontend static analysis/build/unit suite and Spartan health workflow all pass.
