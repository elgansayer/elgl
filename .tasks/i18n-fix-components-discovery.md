# i18n Fixes for `components-discovery` Module

## File: `frontend/src/app/components/discovery/global-search/global-search.component.ts`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `discovery.global_search_title`
- `discovery.native_languages`
- `discovery.any_language`
- `discovery.target_language`
- `discovery.proficiency_level`
- `discovery.any_level`
- `discovery.search_button`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

## File: `frontend/src/app/components/discovery/discovery.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `discovery.genderAny`
- `discovery.genderMale`
- `discovery.genderFemale`
- `discovery.seriousModeToggle`
- `discovery.seriousModeDesc`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Attributes:
- `alt="avatar"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
