Priority: High Impact

Description:
The current `ChatPageComponent` has a split-pane layout but lacks the density and structural clarity of modern community chat platforms like Discord or X's DMs. The room list is static, active states are basic, and the messaging area wastes horizontal space. The mobile experience needs to be improved by making the sidebar collapsible.

Technical Implementation:
1.  **Sidebar Refactoring (Collapsible):**
    *   On mobile (`< 768px`), hide the `aside` room list by default, converting it into a slide-out drawer using an Angular component or CSS `transform: translateX(-100%)` with a transition. Add a hamburger menu in the chat header to toggle it.
    *   On desktop, ensure the sidebar uses a fixed width (`w-72` or `w-80`) and standard flex layout.
2.  **Dense Message Layout:**
    *   Reduce padding inside the message bubbles (e.g., from `py-2` to `py-1`).
    *   For consecutive messages from the same user, hide the avatar and name on subsequent messages, only showing the time on hover. Group them visually.
    *   Ensure the max-width of message bubbles is appropriate for reading (e.g., `max-w-2xl` rather than a percentage).
3.  **Active States & Hover Micro-interactions:**
    *   Enhance the selected room styling in the sidebar to be more prominent (e.g., a solid background color like `bg-surface-300` and a bright left border indicator `border-l-4 border-blue-500`).
    *   In the message list, make the message action buttons (Correct, Ask for correction, Fix) appear on hover over the entire message row, not just inline, improving discoverability without cluttering the UI. Use a small floating action bar for these.
4.  **Hierarchy (Discord-style):** If applicable to the product direction, group the chat rooms in the sidebar by categories (e.g., "Direct Messages", "Language Exchange Groups", "AI Partners").