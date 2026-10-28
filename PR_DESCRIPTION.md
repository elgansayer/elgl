Fixes #1395

**Verification:**
- Verified `UnreadCounterService` is properly integrated into both desktop (`desktop-sidebar.component.html`) and mobile (`app.component.html`) navigation tabs.
- Verified badges use `tabCount()` for precise per-tab unread numbers and correctly fallback to `badgeText()` for compact '99+' rendering.
- Accessibility is confirmed: visual badges are `aria-hidden` while `sr-only` text and `aria-label` elements expose the localized unread count to screen readers.
- All 315 files and 2767 frontend unit tests (including `app-navigation-tabs.contract.spec.ts`) pass, ensuring correct rendering logic and no regression.

**Rollout/Rollback:**
- **Rollout:** This is a strictly frontend UI presentation change. No backend, schema, API, or data migration changes are required. It can be safely deployed with the next frontend release.
- **Rollback:** Safe to rollback via a standard git revert if needed. No state downgrade required.
