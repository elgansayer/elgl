# Dedicated Admin Portal

## Decision

Build the administration UI as a **separate Angular application** in the monorepo, proposed path: `admin-portal/`.

It may share selected packages, generated API types and design tokens with the main frontend, but it must have an independent build, routing tree, authentication entry point, deployment configuration and security policy.

## Why separate it

A dedicated application gives clearer privilege boundaries, smaller privileged bundles, independent deployment/rollback, stricter CSP and network policy, reduced accidental exposure of admin routes in the consumer app, and easier security review.

The separation is not itself authorization. The backend still enforces every capability.

## Proposed structure

```text
admin-portal/
  src/app/
    core/
      auth/
      capabilities/
      api/
      audit-context/
      errors/
    layout/
    features/
      dashboard/
      users/
      moderation/
      reports/
      appeals/
      groups/
      messaging/
      live-rooms/
      media/
      trust-safety/
      fraud/
      payments/
      privacy/
      logs/
      incidents/
      jobs/
      system-health/
      feature-flags/
      configuration/
      roles/
      audit/
      support/
    shared/
      tables/
      filters/
      timelines/
      confirmations/
      reason-dialogs/
      permission-gates/
```

## Portal shell

The shell should provide:

- secure admin sign-in and MFA state;
- current admin identity, role/scopes and session expiry;
- capability-aware navigation;
- global entity/investigation search;
- command palette for permitted actions;
- clear production/staging environment indicator;
- active impersonation/break-glass banners;
- recent admin actions;
- incident banner and emergency controls;
- accessible keyboard navigation and high-zoom support.

## Main screens

### Dashboard

- platform health;
- moderation queue backlog;
- abuse/spam anomalies;
- registration and active-user anomalies;
- failed jobs;
- messaging/media delivery failures;
- active incidents;
- recent high-risk admin actions.

### User detail

A single investigation workspace should aggregate permission-appropriate information:

- profile/account state;
- verification state;
- security/session history;
- restrictions and suspensions;
- moderation cases and appeals;
- public content summary;
- linked abuse signals;
- groups/rooms where operationally relevant;
- payment/support state when the admin has those capabilities;
- audit timeline.

Actions should be grouped by risk and require reasons/step-up as dictated by the API.

### Moderation workspace

- queue filters and assignment;
- evidence viewer;
- related reports/cases;
- target history;
- action composer;
- policy/reason selection;
- preview of user-visible consequences;
- appeal/reversal history.

### Operations

- structured log search and correlation trace;
- health and dependency status;
- queue/job inspection and retry;
- feature flags and kill switches;
- cache/search/storage/CDN maintenance actions;
- incident timeline and operator notes.

## UI security rules

- Never render raw access tokens, refresh tokens, passwords, hashes or secrets.
- Never persist privileged API responses in browser storage unless specifically designed and encrypted appropriately; default to memory/session-limited state.
- Avoid putting sensitive values in URLs, analytics events, client logs or error-report payloads.
- Dangerous actions must have explicit confirmation screens that state target, scope and consequence.
- Bulk actions must show target counts and preview before execution.
- Impersonation must be visually unmistakable and must disable forbidden high-risk actions.
- Break-glass mode must be visually unmistakable and show expiry.

## Accessibility

The admin portal is an operational tool and must remain usable for long sessions and high-information-density work.

Requirements:

- WCAG-oriented semantic structure and keyboard operation;
- screen-reader labels/status announcements;
- no state conveyed by colour alone;
- robust 200%+ zoom and responsive reflow;
- large-text mode/high-density mode options;
- focus management for dialogs/drawers;
- reduced-motion support;
- accessible data tables with a card/list fallback when zoomed.

## Deployment

Prefer a distinct hostname such as `admin.<domain>` or an equivalent dedicated internal origin.

Recommended controls:

- independent deployment pipeline;
- strict CSP;
- no public indexing;
- strong security headers;
- environment-specific API allowlist;
- optional identity-aware proxy/VPN layer as defense in depth;
- no provider/infrastructure credentials shipped to the browser.

## Build sequence

1. Scaffold `admin-portal/` and CI commands.
2. Generate admin API client from OpenAPI.
3. Implement admin auth/session and capability store.
4. Build accessible shell/navigation/error handling.
5. Implement dashboard and user search/detail.
6. Implement moderation cases/reports/actions.
7. Add logs/health/jobs/incident tooling.
8. Add remaining feature modules incrementally.

## Definition of done for each feature

A portal feature is not complete until its backend authorization, redaction, audit behavior, OpenAPI contract, typed client, loading/error/empty states, accessibility, unit tests and E2E authorization tests exist.
