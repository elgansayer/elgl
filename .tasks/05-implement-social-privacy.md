# Priority: High Impact

# Description
Implement the Social & Privacy settings pane, providing granular controls for profile visibility, custom statuses, read receipts, DM controls (e.g., from server members only), and friend request filters.

# Technical Implementation
1. Generate component: `ng g c components/settings/privacy-settings --standalone`
2. Utilize the reactive form setup outlined in `.tasks/02-setup-settings-architecture.md`, subscribing to `valueChanges` for auto-saving.
3. Bind form controls to semantic HTML elements like toggles and select dropdowns, ensuring accessibility (e.g., proper `aria-labels` using `[attr.aria-label]="'settings.privacy.dmControls' | t"`).
4. Connect the custom status UI to update the `UserStatus` state in the backend, utilizing `ChangeDetectionStrategy.OnPush` to render emoji/text updates efficiently.