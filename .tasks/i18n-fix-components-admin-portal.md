# i18n Fixes for `components-admin-portal` Module

## File: `frontend/src/app/components/admin-portal/admin-portal.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `admin.title`
- `admin.subtitle`
- `admin.searchLabel`
- `admin.searchPlaceholder`
- `admin.searchBtn`
- `admin.loading`
- `admin.empty`
- `admin.joined`
- `admin.badgeAdmin`
- `admin.badgeVip`
- `admin.badgeFree`
- `admin.coinsBadge`
- `admin.viewLoginHistory`
- `admin.loginHistoryLoading`
- `admin.loginHistoryEmpty`
- `admin.paginationAria`
- `admin.prevPage`
- `admin.pageIndicator`
- `admin.nextPage`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `= totalPages()"         (click)="goToPage(1)"       >         {{ 'admin.nextPage' | t }}`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
