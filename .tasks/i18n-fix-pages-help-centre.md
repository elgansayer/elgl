# i18n Fixes for `pages-help-centre` Module

## File: `frontend/src/app/pages/help-centre/help-centre.component.ts`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `help_centre.title`
- `help_centre.all_categories`
- `help_centre.search_placeholder`
- `common.error_occurred`
- `help_centre.no_articles`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

## File: `frontend/src/app/pages/help-centre/help-centre.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Help Centre`
- `Loading…`
- `No articles found.`
- `Previous`
- `Page {{ page() }} of {{ totalPages() }}`
- `Next`
Attributes:
- `placeholder="Search…"`
- `aria-label="Search"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
