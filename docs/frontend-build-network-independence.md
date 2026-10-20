# Frontend build network independence

Production frontend builds keep Angular's script and style optimisation enabled, but do not inline external font stylesheets. Font inlining requires internet access and makes otherwise deterministic builds fail when the font host is unavailable.

The application continues to request Instrument Sans at runtime and retains the existing system-font fallback stack. `frontend/scripts/build-network-independence.contract.test.mjs` protects the build configuration from regressing to network-dependent font inlining.
