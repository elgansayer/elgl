Priority: High Impact

Description:
Transform the current vertical list view in the `discovery` component into an engaging, card-based swiping interface inspired by Bumble and Hinge. This will enhance the serendipity of discovering language partners and provide a more interactive user experience, replacing the basic scrollable list with a more tactile gesture-based approach.

Technical Implementation:
- Import and integrate Angular CDK (`@angular/cdk/drag-drop`) in `frontend/src/app/components/discovery/discovery.component.ts`.
- Refactor `frontend/src/app/components/discovery/discovery.component.html` to remove the `<div class="divide-y divide-surface-200">` list structure.
- Replace the `<article>` elements with a stacked layout using CSS Grid or Absolute positioning (`position: absolute; inset: 0`).
- Utilize the existing `ProfileDiscoveryCard` component (if available, or abstract the current markup into one) and bind `cdkDrag` to enable horizontal swiping.
- Implement gesture handlers (`(cdkDragEnded)`) in the component class to handle "Like" (right swipe) or "Pass" (left swipe) actions, firing corresponding API calls and removing the card from the local signal array.