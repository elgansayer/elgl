# HelloTalk Information Architecture Audit

> **Scope note (2026-08-19):** This document audits user-facing routes and information architecture. The repository-wide framework, package, platform and subsystem assessment is maintained separately in [`technology-modernisation-audit-2026-08.md`](./technology-modernisation-audit-2026-08.md), with execution sequencing in [`technology-modernisation-roadmap.md`](./technology-modernisation-roadmap.md) and tracking issue #7458. Do not use this route audit as the source of truth for backend, database, UI-platform, offline, automation or dependency decisions.

## Route Mapping and Capability Analysis

We have analyzed all user-facing routes defined in the application (`frontend/src/app/app.routes.ts`) and identified several areas of duplication, redundancy, and fragmented capabilities.

### 1. Settings & Preferences

The settings and configuration options are heavily fragmented, with multiple top-level routes that should logically be grouped under the `settings/` hierarchy.

**Redundant / Fragmented Paths:**

- `notification-preferences` vs `settings/notification` vs `settings/notification-customization`
- `chat-settings` (top-level) vs `settings/backup-restore` vs `settings/message-filters`
- `message-filters` (top-level) vs `settings/message-filters`
- `language` (top-level) should be under `settings/language`
- `data-storage` (top-level) should be under `settings/data-storage`
- `blocks` (top-level) should be under `settings/blocks` or `settings/privacy`

**Consolidation Recommendation:**
Consolidate all user-specific configurations into a unified settings portal with clear sub-navigation. Deprecate the top-level routes in favor of `settings/*`.

### 2. Help & Support

There are multiple routes providing help and support resources.

**Redundant Paths:**

- `help` (HelpCentreComponent)
- `support` (SupportCentreComponent)
- `help-about` (HelpAboutComponent)

**Consolidation Recommendation:**
Merge these into a single Help & Support portal at `support` (or `help`), with sub-sections for FAQs, Contact, and About information.

### 3. Profile & Visitors

Profile visibility and visitor tracking features are split.

**Redundant Paths:**

- `visitors` (VisitorLogsComponent)
- `profile/visitors` (ProfileVisitorsComponent)

**Consolidation Recommendation:**
Unify visitor logging capabilities under `profile/visitors`.

### 4. Subscription & VIP

The subscription management and onboarding flows are scattered across the top-level namespace.

**Fragmented Paths:**

- `vip` (VipComponent)
- `subscription` (SubscriptionPageComponent)
- `my-subscription` (MySubscriptionComponent)
- `subscription/success` and `subscription/cancel`

**Consolidation Recommendation:**
Group under a single portal, e.g., `subscription` for browsing plans, and `settings/subscription` (or `my-subscription`) for managing an active plan.

### 5. Social & Community

Several major capabilities overlap in the domain of finding groups and communities.

**Overlapping Paths:**

- `groups` and `groups/create`
- `communities`
- `language-islands`
- `language-parties`

**Consolidation Recommendation:**
Group community features under a unified `community` or `discover` hub, providing distinct tabs for different event/group types.

### 6. Admin vs User Management

There is a slight overlap in terminology between user tools and admin tools.

**Paths:**

- `blocks` (User-facing BlockManagementComponent) vs `admin/blocks` (AdminBlocksComponent)

**Recommendation:**
Keep admin routes explicitly under `admin/*` but move user-facing `blocks` to `settings/blocks` to avoid namespace ambiguity.

### Conclusion

To improve discoverability and maintainability, the application's information architecture should follow a strict hierarchical structure, avoiding flat, top-level routes for nested features (especially configuration and settings). Legacy top-level routes should be preserved using route redirects (`redirectTo`) to ensure deep links are not broken.

## Related architecture and technology audits

This document is intentionally limited to routes and information architecture. For framework, package, API, data, realtime, observability, build, testing and platform decisions, see the [2026 Technology Modernization Audit](technology-modernization-audit-2026.md).
