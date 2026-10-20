# Consolidated Product Backlog

This backlog synthesises and organises open issues into cohesive, outcome-driven objectives, removing duplicate or obsolete reports, and shifting focus from individual technical chores to complete user experiences.

## Objective 1: Deliver a Robust, Modern Communities Navigation Experience
**Outcome:** Users can intuitively navigate between communities and specific groups using a dense, responsive layout with clear visual feedback, interactive states, and reliable error handling.

**Consolidated Tasks:**
*   **Implement Denser Multi-Pane Layout:** Transition the UI to a CSS Grid/Flexbox three-pane layout on desktop (Communities sidebar, Groups sidebar, Main chat) with a mobile-friendly drawer/sliding pane.
*   **Enhance Active States & Micro-interactions:** Use Angular signals to apply distinct visual indicators for the selected community, and introduce hover effects and unread notification badges.
*   **Improve Architectural Scalability:** Extract the community creation form and list items into dedicated sub-components.
*   **Ensure Reliable Operations:** Wrap asynchronous operations (`create` and `delete`) in robust error handling (`try...catch`) with user-facing toast notifications.

## Objective 2: Deliver a Robust and Performant Real-Time Chat Experience
**Outcome:** Users experience reliable real-time messaging without encountering missing messages, N+1 API request storms, or UI race conditions when switching rooms.

**Consolidated Tasks:**
*   **N+1 API Request Mitigation:** Batch the 'delivered' and 'read' status updates for unread messages into a single bulk update endpoint rather than firing two API calls per message upon entering a room.
*   **Prevent Room Selection Race Conditions:** Add a guard condition after fetching messages (`this.selectedRoom()?.id === room.id`) or use `switchMap` to prevent delayed HTTP responses from overwriting the state of the currently viewed room.
*   **Refine Message Deletion Logic:** Clean up redundant conditional branches in `chat-page.component.ts` when handling `message_deleted` Centrifugo events.

## Objective 3: Evidence-Based Rendering Optimization for Large Data
**Outcome:** Ensure smooth, lag-free scrolling for large data views, driven by empirical measurement rather than preemptive virtualization.

**Consolidated Tasks:**
*   **Measure Before Virtualising:** Profile representative article and chat histories to record DOM-node count, frame time, and memory usage.
*   **Implement Virtualization (If Justified):** If data proves severe lag, implement `<cdk-virtual-scroll-viewport>` in `chat-page.component.ts` and `reading-engine.component.ts`, ensuring dynamic heights, backward pagination, and scroll positions are preserved.

## Objective 4: Accurate and Accessible Visual Diff Corrections
**Outcome:** The language correction interface accurately tracks words and is fully accessible to keyboard navigation.

**Consolidated Tasks:**
*   **Fix Flashcard Translation Mapping:** Correct the `translation` payload field in `createFlashcard()` within `visual-diff.component.ts` to use the appropriate intended translated context.
*   **Improve Accessibility:** Add `focus:opacity-100` (or an equivalent focus-visible class) to the translate button in the explanation section so it is visible to keyboard-only users.
*(Note: O(N) diff algorithm replacement and `Intl.Segmenter` instantiation fixes are already completed in the source tree).*

## Objective 5: Unified Language Learning and Spaced Repetition Synergy
**Outcome:** Core language learning principles (spaced repetition, active production, comprehensible input) are interconnected across all application features rather than siloed.

**Consolidated Tasks:**
*   **Automated SRS Extraction:** Build a background worker in `nlp.service.ts` to automatically extract and suggest new vocabulary from completed AI Conversations and Voice Transcriptions.
*   **Active Production Testing:** Integrate Pronunciation Scoring with the SRS engine to grade spoken retrieval.
*   **Dynamic Comprehensible Input:** Map the user's dynamic Assessment proficiency score to the Reading Engine to scale tokenized difficulty appropriately.
*   **Correction Integration:** Automatically queue corrected words from the Visual Diff tool into the user's flashcard deck.
