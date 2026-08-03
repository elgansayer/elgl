# Daily Frontend Performance & Bundle Audit

## Objective
Maintain strict performance standards and prevent bundle bloat to ensure 60 FPS on mobile.

## Instructions
1. Run `npx ng build --stats-json` in the frontend directory.
2. Analyze the bundle using `webpack-bundle-analyzer` or similar tools.
3. Identify any exceptionally large third-party dependencies imported recently.
4. Refactor heavy imports to use lazy loading where appropriate (e.g., lazy loading the LiveKit SDK or charting libraries).
5. Ensure `TokenisedTextComponent` utilizes `cdk-virtual-scroll-viewport` for long lists.
