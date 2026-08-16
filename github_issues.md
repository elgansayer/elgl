# GitHub Issues for Communities UI Improvements

## Issue 1: Refactor `CommunitiesComponent` to a Three-Pane Responsive Layout

**Description**
The current `CommunitiesComponent` uses a basic single-column list flow that does not scale well for deep hierarchies. To align with modern real-time platforms (e.g., Discord), we need to transition the desktop interface into a multi-pane layout. This refactor should establish a 3-pane responsive structure: a primary narrow sidebar for top-level communities, a secondary sidebar for groups within the selected community, and a main central area (initially housing the chat or content/form).

**Acceptance Criteria**
- Refactor `communities.component.html` using Tailwind CSS Grid or Flexbox to create a three-pane layout on desktop.
- Pane 1: A narrow sidebar containing the list of Communities.
- Pane 2: A secondary sidebar containing the list of Groups for the active Community.
- Pane 3: The main central area for active content (e.g., chat interface or the existing community creation form).
- Ensure the layout degrades gracefully on smaller screens (mobile responsiveness logic to be handled in a separate issue).
- Ensure existing functionality (fetching and displaying communities and groups) remains intact.

**Suggested Labels**
- enhancement
- ui
- layout

---

## Issue 2: Implement Dynamic Active States and Micro-interactions

**Description**
The current navigation lacks clear visual feedback regarding spatial position and interaction state. We need to implement distinct active states for selected items and micro-interactions (like hover effects) to improve the user experience and make navigation intuitive.

**Acceptance Criteria**
- Apply distinct active styles to the selected community using Tailwind classes like `bg-surface-300` and `border-l-4 border-indigo-500` (or the theme's equivalent primary border, e.g. `border-primary`).
- Implement the same active state logic for selected groups.
- Introduce hover effects on list items (e.g., `hover:bg-surface-200`, `transition-colors duration-150`).
- Ensure all styling changes rely on the existing Angular signals (e.g., `selectedCommunityId()`).

**Suggested Labels**
- enhancement
- ui
- good first issue

---

## Issue 3: Implement Mobile Off-Canvas Drawer / Sliding Pane Navigation

**Description**
The proposed complex multi-pane navigation layout will overwhelm mobile devices if displayed simultaneously. We need to implement an off-canvas drawer or a sliding pane view for smaller screens to ensure a responsive, uncluttered experience.

**Acceptance Criteria**
- Design and implement a mobile-specific layout that triggers on small screens (using Tailwind responsive prefixes, e.g., `md:`).
- On mobile, display only one pane at a time (e.g., start with the Communities list).
- Implement a sliding pane or off-canvas drawer mechanism to transition between the Community list, Group list, and Main Chat area.
- Utilize Angular animations for smooth transitions between views.
- Ensure easy navigation back up the hierarchy (e.g., a 'Back' button or swipe gestures).

**Suggested Labels**
- enhancement
- mobile
- responsive

---

## Issue 4: Add Unread Notification Badges to Communities and Groups

**Description**
To keep users engaged and informed about new activities within their communities, we need to introduce visual indicators for unread content. Small notification badges should be added to the list items for communities and groups that have new, unread activity.

**Acceptance Criteria**
- Update the `Community` and `CommunityGroup` interfaces/models (if necessary) to include an unread count or a boolean flag indicating new activity.
- Implement a UI component or inline HTML for an unread badge (e.g., a pill-shaped red div: `bg-red-500 text-white rounded-full px-1.5 text-[10px]`).
- Display the badge conditionally on community and group list items if there are unread notifications.
- Ensure the badge disappears or its count resets when the user navigates into that community or group.

**Suggested Labels**
- enhancement
- feature
- engagement

---

## Issue 5: Add Error Handling and Loading States to Communities UI

**Description**
The current `CommunitiesComponent` handles data fetching via Angular signals/resources but lacks explicit user feedback for loading states and error conditions (e.g., network failure when fetching communities or creating one).

**Acceptance Criteria**
- Add loading spinners or skeleton loaders to the `communities.component.html` to indicate when `communitiesResource` and `groupsResource` are loading (`communitiesResource.isLoading()` / `groupsResource.isLoading()`).
- Implement a try/catch block around `createCommunity()` to handle and display creation errors gracefully.
- Show user-friendly error messages if fetching communities or groups fails.
- Disable the "Create" button while the creation request is in flight to prevent double-submissions.

**Suggested Labels**
- bug
- tech-debt
- ui

## Issue 6: Implement Advanced Ranking Signals for Partner Discovery

**Description**
To enhance the partner discovery algorithm beyond basic language pairing, we need to introduce multiple ranking signals. These signals should calculate a compatibility score based on complementary languages, proficiency levels, timezone overlap, shared interests, response behavior (e.g., response rate and time), correction behavior (e.g., correction ratio), and overall learning seriousness (e.g., study streak).

**Acceptance Criteria**
- Update the `DiscoveryService` and `RecommendationsService` to compute a multi-dimensional compatibility score.
- Integrate timezone overlap calculation based on user timezone or availability preferences. Add necessary timezone/availability fields to the user profile if they do not currently exist.
- Factor in `correction_ratio`, `study_streak_days`, and `is_serious_learner` into the weighting.
- Include a response behavior metric (e.g., average response time) if available in metrics/stats.
- Return the computed scores as part of the matchmaking API responses.

**Suggested Labels**
- enhancement
- matchmaking
- algorithm

---

## Issue 7: Add Explanations for Partner Recommendations

**Description**
To build trust and transparency in the matchmaking system, the UI and API should explain *why* a specific user was recommended. The backend needs to provide a breakdown of the match criteria (e.g., "Matches your target language", "Both online now", "Shared interest in Music").

**Acceptance Criteria**
- Update `RecommendedUserDto` and discovery response DTOs to include a `matchReasons` array or object.
- Modify the recommendation engine (in `RecommendationsService` and `DiscoveryService`) to populate `matchReasons` based on the ranking signals that contributed most to the match.
- Examples of reasons: 'Complementary language exchange', 'High timezone overlap', '3 shared interests', 'Top corrector in the community'.
- Ensure this data is cleanly serialized and available for the Angular frontend to render.

**Suggested Labels**
- enhancement
- user-experience
- matchmaking
