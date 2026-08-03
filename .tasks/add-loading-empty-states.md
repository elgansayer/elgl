Priority: Low Impact

Description:
The application currently uses basic empty states (e.g., raw text "Select a room" or "No audio intros") and standard spinners. To elevate the UX to a premium level, we should implement loading skeletons (skeleton screens) to reduce perceived loading time, and add illustrative empty states to guide users when no content is present.

Technical Implementation:
1.  **Loading Skeletons:**
    *   Create a reusable Angular component or CSS utility for skeletons (e.g., using `animate-pulse` and `bg-surface-200`).
    *   In `AudioIntroFeedComponent`, replace the `i-ph-spinner-gap-bold` spinner with a skeleton card that matches the layout of the proposed swipe card.
    *   In `ChatPageComponent`, show skeleton room items in the sidebar while rooms are fetching, and skeleton message bubbles in the main area while messages load.
2.  **Empty States:**
    *   Create an `EmptyStateComponent` that accepts an icon name, title, description, and an optional action button (e.g., "Find Partners").
    *   Use this component in `ChatPageComponent` when `!selectedRoom()`, providing a clear call to action to go to the discovery page.
    *   Use this component in `AudioIntroFeedComponent` when the feed is exhausted.