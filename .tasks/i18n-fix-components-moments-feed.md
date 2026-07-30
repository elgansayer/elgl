# i18n Fixes for `components-moments-feed` Module

## File: `frontend/src/app/components/moments-feed/moments-feed.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `moments.correctBtn`
- `moments.quoteBtn`
- `moments.replyBtn`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Replying to`
Attributes:
- `placeholder="Image URL..."`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
