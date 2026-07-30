---
Priority: High Impact
Description: Redesign the messaging interface to handle multi-device views efficiently. On desktop, implement a persistent two-panel view (Chat window + Profile/Details/History); on mobile, use a modal or dedicated view stack.
Technical Implementation: Use component logic (e.g., `isDesktopView`) within the Chat component to conditionally render the layout, maintaining a persistent header/sidebar regardless of screen size.
---

