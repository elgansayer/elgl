# Frontend build reproducibility

The Angular production build must complete without internet access. External font stylesheets may remain runtime resources, but Angular font inlining is disabled in the production build configuration so compilation never depends on a third-party font host.

`frontend/scripts/build-config.test.mjs` locks this configuration and runs automatically before `npm run build` in the frontend workspace. If the application later self-hosts all fonts, the external stylesheet and this exception can be removed together.
