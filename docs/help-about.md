# Help and About runtime contract

The Help and About page is the user-facing source for the running frontend version, build identity, and production open-source dependency licences.

## Runtime ownership

`frontend/src/app/pages/help-about/help-about.component.ts` owns presentation. It reads generated `APP_VERSION` and `BUILD_NUMBER` values and loads `/assets/generated/third-party-licences.json`. The page already provides translated loading, empty, unavailable, and successful states.

`frontend/scripts/generate-help-about-data.mjs` owns build metadata and licence generation. The frontend `prestart` and `prebuild` scripts run the generator so local development and production builds use the same contract.

The generator derives:

- app version from `APP_VERSION` when supplied, otherwise `frontend/package.json`;
- build number from `APP_BUILD_NUMBER` or the GitHub run number plus the short commit SHA;
- a deterministic `local.<sha>` build value outside CI;
- production dependency licence metadata from `package-lock.json` and installed package metadata;
- licence text from package `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` files where available.

Dev-only packages are excluded from the public licence manifest.

## Licence completeness gate

A production dependency without declared licence metadata now fails Help and About data generation with `PRODUCTION_DEPENDENCY_LICENCE_REQUIRED:<package>@<version>`. The generator no longer publishes an `UNKNOWN` licence that could make an incomplete disclosure look valid.

This failure is intentional. `prebuild` runs the generator before the Angular production build, so adding an unlicensed or incorrectly packaged production dependency is caught before deployment. A developer must verify the dependency's licensing and package metadata rather than bypassing the gate or hand-editing the generated manifest.

The generated npm package URL is derived from the lockfile package identity and version rather than copied from package-controlled repository metadata.

## Trust and privacy boundary

The generated manifest is public application metadata and must never contain credentials, user data, environment variables, private package registry tokens, or private repository URLs.

The browser does not infer or fabricate missing licence records. Manifest request or parsing failures remain an unavailable state in the existing Help and About page.

External package links open with `rel="noopener noreferrer"`.

## Accessibility and localisation

Visible page labels and loading/error/empty states use the application translation layer. Package names, versions, and licence identifiers are package-owned technical metadata and remain verbatim. External links are native anchors with visible keyboard focus. The layout uses logical direction utilities so it remains valid in RTL locales.

## Verification

Run the generator contract tests:

```bash
cd frontend
npm run test:help-about-data
```

Run the Help and About component tests:

```bash
cd frontend
npm test -- --include='src/app/pages/help-about/help-about.component.spec.ts'
```

Canonical frontend static analysis and the production build must also pass. The production build runs `generate:help-about` automatically through `prebuild`, exercising the real installed production dependency corpus.

## Rollout and rollback

There is no database, API, or persisted-user-state migration. Frontend deployment is sufficient.

A normal code rollback restores the previous generator behavior. Keep the generated asset path stable across mixed-version deployments so an older frontend can still load its expected manifest. Never roll back by hard-coding build metadata, inventing licence identifiers, or hand-maintaining third-party licence entries.
