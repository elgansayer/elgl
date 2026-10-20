Priority: High Impact

Description:
The current Communities UI (`communities.component.html`) employs basic grid layouts and standard lists, lacking clear spatial navigation between broad communities and their specific groups/channels. To align with modern real-time social paradigms like Discord and X, the interface should adopt a denser but highly readable multi-pane layout. This approach separates top-level communities from specific conversational groups, providing clear, persistent navigation and unmistakable active states.

Technical Implementation:
- **Layout Restructuring:** Refactor the page using CSS Grid or Flexbox to create a responsive three-pane layout on desktop: a narrow left sidebar for Communities, a secondary sidebar for Groups within the selected community, and a main central area for the active chat/content.
- **Active States:** Utilise Angular signals (already tracking `selectedCommunityId`) to apply distinct active styles. Apply Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` to indicate the currently viewed community or group, improving visual feedback.
- **Micro-interactions:** Introduce subtle hover effects (e.g., `hover:bg-surface-200`, `transition-colors duration-150`) on list items. Include unread notification badges (using a small, pill-shaped red div `bg-red-500 text-white rounded-full px-1.5 text-[10px]`) for communities/groups with new activity.
- **Mobile Responsiveness:** Implement an off-canvas drawer or a sliding pane view for mobile screens to ensure the complex navigation doesn't overwhelm smaller devices, possibly leveraging Angular animations for smooth pane transitions.
