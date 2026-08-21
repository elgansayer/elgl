# Relay + Spartan reduced-motion architecture

Issues: #5497 (`Spartan UI 0031`) and #5498 (`Spartan UI 0032`)

## Current implementation audit

Relay already exposes shared motion duration and easing tokens in `frontend/src/styles.scss`, and product surfaces use shared animation classes such as skeleton, empty-state, content-state, and partner-card transitions. The remaining architectural requirement is a single user-preference boundary that makes those motions non-essential when `prefers-reduced-motion: reduce` is active.

## Canonical contract

1. Product motion must use Relay duration/easing roles rather than ad-hoc timing values where shared roles exist.
2. `prefers-reduced-motion: reduce` must disable or collapse non-essential animation and transition duration globally.
3. Reduced motion must preserve state changes, focus, loading meaning, and content visibility.
4. Components must not override the reduced-motion boundary with `!important` animation declarations outside the central accessibility layer.
5. Spartan/Helm components inherit the same boundary. Feature code must not create a second motion preference system.

## Verification

Run `npm run check:reduced-motion-contract` from the repository root. The verifier fails closed when the central preference query or required suppression rules disappear.
