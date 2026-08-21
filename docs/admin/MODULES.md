# Admin Platform Modules

This map defines the main administrative surfaces expected in the dedicated admin portal. Each module should have a backend capability set, API contract, audit events, frontend feature area and tests.

## Core administration

- Admin dashboard and global investigation search.
- Admin identities, roles, capabilities, scopes and temporary grants.
- Admin sessions, MFA, step-up authentication and session revocation.
- Approval requests for high-risk actions.
- Audit history and sensitive-access review.
- Break-glass grants and emergency controls.

## Users and identity

- Search users by stable identifiers and approved contact metadata.
- Inspect safe profile/account state.
- Correct support-safe profile fields.
- Verification-state workflows.
- Restrict, suspend, lock, restore and deactivate accounts.
- Per-feature restrictions with expiry.
- Credential-compromise and forced-reset workflows.
- Session/device security review and revocation.
- Duplicate-account resolution and safe merge workflow.
- Account moderation/security timeline.

## Reports, moderation and appeals

- Unified report queues.
- Case creation, assignment, priority and SLA state.
- Evidence snapshots and related-target linking.
- Warning/strike system.
- Content/account actions.
- Moderator notes and internal collaboration.
- Appeal queues and independent review.
- Decision reversal and state restoration.
- Policy/category configuration.

## Content and media

- Posts/comments/profile content inspection.
- Quarantine, hide, remove and restore.
- Media metadata and ownership tracing.
- Media quarantine/deletion/restore.
- Derived-asset and CDN invalidation.
- Hash-based re-review workflows.
- Spam campaign detection and bulk quarantine.

## Trust, safety and abuse

- Bot-risk review queue.
- Coordinated-abuse cluster investigations.
- Raid detection and community lockdown.
- IP/network/ASN reputation signals.
- Privacy-minimized device linkage signals.
- Signup-domain risk policies.
- Rate-limit state and emergency throttling.
- Abuse anomaly dashboards.

## Groups and communities

- Group/community search and inspection.
- Membership and moderator roster review.
- Freeze/unfreeze communities.
- Transfer ownership with safeguards.
- Remove/restore shared content.
- Emergency raid controls.
- Community moderation history.

## Messaging

- Report-linked evidence review only when policy allows.
- Message abuse cases and related-account investigations.
- Emergency messaging restrictions.
- Delivery/queue health diagnostics.
- Privacy-safe access auditing.

## Live audio/video

- Live room search and state inspection.
- End room.
- Remove/suspend participant.
- Disable chat or joins.
- Preserve moderation evidence.
- Live infrastructure health and incident links.

## Search, feeds and recommendations

- Search/index health.
- Reindex/recompute operations.
- Abuse exclusions.
- Recommendation/feed kill switches.
- Sanitized ranking diagnostics.
- Search safety rules and blocked entities.

## Notifications and broadcasts

- Global/scoped announcements.
- Cohort targeting.
- Preview and scheduling.
- Cancellation.
- Localization.
- Delivery metrics.
- Emergency broadcasts with stronger authorization.

## Payments, marketplace and fraud

- Transaction search/read-only investigation.
- Refund/dispute workflow integrations.
- Account/payout holds where supported.
- Fraud signals and linked investigations.
- Reconciliation state.
- Separate finance permissions and mandatory step-up for mutations.

## Privacy, legal and compliance

- DSAR/access/export/deletion workflow.
- Identity-verification state for requests.
- Export generation and redaction controls.
- Legal holds.
- Retention/deletion policy state.
- Sensitive-access review queue.
- Compliance audit exports.

## Operations

- Structured application-log search.
- Correlation-ID tracing.
- Permissioned live log tail.
- Saved investigations/bookmarks.
- Service/dependency health.
- Queue/job inspection, retry, cancellation and pause/resume.
- Cache/search/storage/CDN operational controls.
- Feature flags and configuration.
- Emergency kill switches.
- Incident timeline and operator notes.
- Backup/restore status and disaster-recovery operations.

## Support

- User investigation workspace.
- Safe impersonation/support session.
- Support notes/history.
- Notification/resend workflows.
- Known incident linking.
- Escalation to moderation/security/privacy/finance teams.

## Analytics

- Platform health metrics.
- Moderation backlog and SLA metrics.
- Abuse and fraud trends.
- Admin action volume and high-risk action reports.
- Operational failure metrics.
- Privacy-safe aggregate user metrics.

## Shared platform components

Every module should reuse common components for:

- capability gates;
- reason selection;
- step-up prompts;
- approval state;
- confirmation/impact preview;
- timelines;
- audit-event links;
- pagination/filtering;
- bulk actions;
- redaction notices;
- loading/error/empty states;
- accessible tables and high-zoom views.
