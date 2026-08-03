Priority: High Impact

Description:
The current `AudioIntroFeedComponent` displays a basic vertical list of users for discovery. To match the Bumble/Hinge paradigm, we should transition this into a Tinder/Bumble-style card swiping interface. This provides a more engaging, gamified discovery experience, focusing the user's attention on one profile at a time, making the audio intro more prominent.

Technical Implementation:
1.  **Component Architecture:** Refactor `AudioIntroFeedComponent` to display a single active user profile card at a time, with the next card pre-loaded behind it.
2.  **Angular CDK Drag & Drop:** Utilize `@angular/cdk/drag-drop` (specifically `cdkDrag`) on the profile cards to handle touch and mouse dragging interactions.
3.  **Animations (SCSS/Angular Animations):**
    *   Bind the drag position to CSS transforms (`transform: translate3d(x, y, z) rotate(deg)`). As the card is dragged left/right, subtly rotate it.
    *   Use Angular Animations or CSS transitions to animate the card off-screen when the drag threshold (e.g., > 50% width) is met, triggering the "like" or "pass" action.
    *   Scale up the background card slightly (`transform: scale(0.95)` to `scale(1)`) as the foreground card is swiped away.
4.  **UI Layout:** Design a large portrait-oriented card with the user's avatar as the background or a large prominent image. Place the audio playback controls centrally or prominently at the bottom of the card. Add explicit "Like" (Heart) and "Pass" (X) buttons at the bottom for accessibility and explicit actions.
5.  **State Management:** Update the Signal-based resource to manage a queue of profiles, shifting the queue when a swipe completes.