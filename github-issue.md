Title: Implement Angular CDK Virtual Scrolling for Chat and Reading Views

Description:
A review of the frontend codebase shows that `@angular/cdk` is present in `package.json` (`^22.1.3`), but `cdk-virtual-scroll-viewport` is not implemented in data-heavy components such as `chat-page.component.ts` and `reading-engine.component.ts`. Without virtual scrolling, rendering large chat histories or extensive reading texts will cause severe DOM bloat, increased memory usage, and UI lag, ultimately degrading performance on mobile and desktop browsers.

Acceptance Criteria:
- [ ] Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into the relevant Angular standalone components (e.g., `chat-page.component.ts`, `reading-engine.component.ts`).
- [ ] Replace standard loops rendering chat messages with `<cdk-virtual-scroll-viewport>`.
- [ ] Implement virtualised rendering or windowing in the reading components for extensive texts.
- [ ] Ensure dynamic height recalculation works correctly for chat messages with varying content lengths (text, media, audio).
- [ ] Verify scrolling backwards in chat accurately triggers pagination/loading without breaking the viewport position.
- [ ] Write or update unit tests to verify that the virtual scroller correctly limits the rendered DOM nodes to the visible viewport slice.

Suggested Labels: bug, performance, tech-debt, ui
