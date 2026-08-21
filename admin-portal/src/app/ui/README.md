# Admin Spartan UI ownership

The admin portal uses the same Spartan two-layer model as the consumer frontend:

- `@spartan-ng/brain` supplies accessible/headless behavior.
- Styled Helm-like wrappers and semantic tokens are repository-owned code under this application and `src/styles.scss`.
- `@spartan-ng/cli` is the supported generator/migration tool. Generated code is reviewed before adoption.

Admin UI must not introduce Angular Material or another parallel primitive library. New interactive primitives should prefer Spartan Brain behavior, then wrap it in repository-owned styles that use the `--admin-*` semantic token system.

Every component must preserve keyboard operation, visible focus, logical RTL properties, forced-colours behavior and reduced-motion behavior. Dense administrative layouts may use the `data-density="compact"` token mode; they must not shrink interactive targets below accessible sizes.

The consumer frontend remains the reference implementation for Spartan version selection. `scripts/verify-admin-ui-contract.mjs` prevents the two applications from silently drifting to different Brain/CLI version ranges.
