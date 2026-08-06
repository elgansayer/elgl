Priority: High Impact

Description:
The current Discovery UI (`discovery.component.html`) utilizes a dense, vertical list with a `divide-y` approach. This feels more like reading a directory than an engaging social discovery experience. To improve user engagement and modernise the interaction model (inspired by Bumble and Hinge), the discovery experience should pivot to a card-based swipeable interface. This layout will increase the visual hierarchy of profile pictures, give more breathing room to user bios and language fluency tags, and provide intuitive gesture hints for matching or skipping profiles.

Technical Implementation:
- **Angular Integration:** Utilise the `@angular/cdk/drag-drop` module to implement a stack of swipeable profile cards in `discovery.component.ts`. Use `cdkDrag` on individual cards and hook into the `(cdkDragEnded)` event to detect left/right swipe thresholds for "pass" or "wave/connect" actions.
- **Component Refactoring:** Update `profile-discovery-card.component.ts` to occupy a larger footprint (e.g., `h-[70vh] w-full max-w-sm`), featuring a prominent cover image and overlaying textual details at the bottom using Tailwind gradients (`bg-gradient-to-t from-black/80 to-transparent`) for text readability.
- **Micro-interactions:** Add CSS transition animations in SCSS for the entering and leaving cards. Bind Angular signals to track swipe direction and apply dynamic Tailwind classes (e.g., a green tint and "LIKE" stamp for right swiping, red tint and "NOPE" stamp for left swiping) via conditional classes.
- **Empty State:** Provide an engaging empty state illustration with a loading skeleton (e.g., `animate-pulse`) when fetching new partners.
