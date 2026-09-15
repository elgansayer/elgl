# Issue 1: Missing Angular CDK Virtual Scrolling in Reading Views and Chat

## Title
perf(ui): implement virtual scrolling for reading engine and chat

## Description
A review of `frontend/src/app/components/reading-engine/reading-engine.component.ts` and `frontend/src/app/pages/chat/chat-page.component.ts` indicates that `@angular/cdk/scrolling` is not being used to render data-heavy UI components. Standard Angular `@for` loops are used for rendering potentially extensive reading articles (`@for (article of filteredArticles(); track article.id)`) and long chat histories. This approach causes severe DOM bloat, increased memory footprint, and UI lag, ultimately degrading performance.

## Acceptance Criteria
*   Import and integrate `ScrollingModule` from `@angular/cdk/scrolling` into `reading-engine.component.ts` and `chat-page.component.ts`.
*   Replace standard `@for` loops rendering large lists of articles/messages with `<cdk-virtual-scroll-viewport>`.
*   Ensure dynamic height recalculation works correctly.

## Suggested Labels
bug, performance, tech-debt, ui


# Issue 2: Race Condition / Unsafe State Clearing on Modal Close during Execution

## Title
bug(ai): race condition in ConversationAnalysisLauncher state management

## Description
In `frontend/src/app/features/premium-ai/conversation-analysis-launcher.component.ts`, the component implements a `closeResult()` method and a `runAnalysis()` method that sets a `running` signal state. The `closeResult()` method clears the `result` signal and `runError` signal but fails to reset the `running` state or abort any in-flight asynchronous operations initiated by `runAnalysis()`. Consequently, closing the modal while an analysis request is pending can lead to race conditions where stale network responses override or mutate state unexpectedly.

## Acceptance Criteria
*   Implement a cancellation mechanism (e.g., using `AbortController` or RxJS) to abort ongoing `runConversationAnalysis` requests when the component is closed or unmounted.
*   Update `closeResult()` to safely abort any pending operations and explicitly reset the `running` state to `false`.

## Suggested Labels
bug, state-management
