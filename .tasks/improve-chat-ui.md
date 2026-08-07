Priority: High Impact

Description:
The current Chat UI (`chat-list.component.html` and `chat-room.component.html`) employs standard lists. To align with modern real-time social paradigms like Discord and X, the interface should adopt a denser but highly readable layout that emphasizes communities and active conversations, while also improving the touch targets and message interactions on mobile.

Technical Implementation:
- **Layout Restructuring:** Refactor the chat layout using CSS Grid or Flexbox to support an optional multi-pane view on desktop (Communities Sidebar + Chat List + Main Chat Room), whilst maintaining a clean sliding pane view for mobile devices using Angular router animations.
- **Micro-interactions & Touch Targets:** Increase the clickable areas of action buttons (e.g., unlocking chats, playing audio). Increase buttons from `w-6 h-6` to at least `w-10 h-10` or pad them generously (`p-3`) for mobile touch responsiveness. Introduce subtle hover and press active states (`active:scale-95 transition-transform`).
- **Active States & Readability:** Utilise Angular signals to apply distinct active styles. Emphasize unread notification badges (`bg-red-500 text-white rounded-full px-1.5`) and differentiate unread channels/chats with bolder typography (`font-black`) compared to read ones (`font-normal`).
- **Empty States:** Implement skeleton loading (`animate-pulse` list items) in `chat-list.component.html` while `isLoading()` is true, replacing the generic textual empty state block.

- **Accessibility & Error Handling:** Ensure all new multi-pane interactive elements utilize proper ARIA labels (e.g., `aria-label`, `aria-expanded` on the mobile drawer) and implement full keyboard navigation (focus traps within active drawers). Add distinct toast notifications or inline error states if a chat fails to load or send, instead of silently failing.
