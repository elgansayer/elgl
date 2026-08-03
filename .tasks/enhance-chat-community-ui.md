Priority: Medium Impact

Description:
Improve the real-time social and chat interface to be more aligned with dense, highly readable layouts found in Discord and X. The current chat components lack a sense of structural hierarchy and density, which is crucial for power users engaged in multiple communities and active threads. This task focuses on tightening UI spacing, emphasizing active states, and ensuring contextual replies are crisp and immediately readable.

Technical Implementation:
- In `frontend/src/app/chat/threaded-reply/threaded-reply.component.ts`, reduce the outer padding and margins (`ps-4 pe-4 py-2` -> `ps-3 pe-3 py-1.5`) to create a denser visual footprint.
- Decrease text sizes slightly in the reply preview to differentiate it more strongly from primary message text (`text-sm` -> `text-xs`).
- Introduce sticky headers for date groupings in the main chat room view using Tailwind's `sticky top-0 z-10` classes.
- Add distinct hover/active states for chat list items in the inbox using SCSS variables or Tailwind (e.g., `hover:bg-surface-300 focus-within:bg-surface-300`).