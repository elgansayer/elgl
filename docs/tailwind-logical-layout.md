# Tailwind logical layout contract

Issue #1283 is satisfied by the existing Angular/Tailwind integration plus the regression contract added alongside it.

## Runtime ownership

- `frontend/src/styles.scss` loads Tailwind theme, preflight, and utilities layers and points Tailwind at `frontend/tailwind.config.js`.
- `frontend/tailwind.config.js` scans Angular HTML, TypeScript, and SCSS under `frontend/src` and uses class-based dark mode.
- Relay semantic colours, radii, elevation, and typography remain defined through the existing Tailwind/CSS-variable contract. This change does not introduce a second token system.

## Directional layout

Application UI must use CSS logical directions rather than physical left/right spacing. Tailwind examples include `ps-*`, `pe-*`, `ms-*`, `me-*`, `border-s-*`, and `border-e-*`. Raw CSS should use logical properties such as `padding-inline-start` or `margin-inline-end` where a utility is not appropriate.

The canonical `frontend` static-analysis path runs `npm run check:rtl-logical`. That guard rejects physical Tailwind utilities such as `pl-*`, `pr-*`, `ml-*`, `mr-*`, `left-*`, and `right-*`, as well as physical CSS declarations including `margin-left`, `margin-right`, `padding-left`, and `padding-right` outside test fixtures.

## Verification

`frontend/src/app/tailwind-logical.contract.spec.ts` protects the installation/configuration boundary by asserting that Tailwind and its PostCSS integration remain installed, global styles continue to load Tailwind and the project config, the Angular source globs remain configured, and `lint:check` continues to run the logical-direction guard.

Normal pull-request CI remains authoritative for frontend unit tests, static analysis, production build, RTL checks, design-system governance, and visual contracts.

## Accessibility and localisation

Logical spacing is required for RTL language support and must not be bypassed for one-off layouts. Responsive changes must continue to reflow at high zoom and must not encode reading order through physical positioning. Theme changes must continue to use semantic Relay tokens rather than direction-specific colour or layout overrides.

## Rollout and rollback

There is no schema, API, persisted-state, or runtime migration. Rollout is the normal frontend deployment. A rollback may revert the regression test/documentation, but removing Tailwind integration or the logical-direction static-analysis guard would re-open the original requirement and should be accompanied by an intentional architecture change.
