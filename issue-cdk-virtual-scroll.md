# Issue: Implement Angular CDK Virtual Scrolling for Chat and Reading Views

## Title
feat(ui): implement cdk-virtual-scroll-viewport for data-heavy views

## Description
A review of the frontend codebase (`chat-page.component.ts` and `reading-engine.component.ts`) reveals that standard Angular control flow (`@for`) is currently used to render potentially unbounded lists of chat messages and reading articles. Although `@angular/cdk` is present in `package.json`, `cdk-virtual-scroll-viewport` is not implemented. Without virtual scrolling, rendering large chat histories or extensive reading lists will cause DOM bloat, increased memory usage, and UI lag, degrading performance on mobile and desktop browsers.

## Acceptance Criteria
*   Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into `chat-page.component.ts` and `reading-engine.component.ts`.
*   Replace standard `@for` loops rendering chat messages and reading articles with `<cdk-virtual-scroll-viewport>` and `*cdkVirtualFor`.
*   Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio) using `itemSize="auto"` or a custom virtual scroll strategy if required.
*   Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
*   Update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes.

## Suggested Labels
bug, performance, tech-debt, ui
