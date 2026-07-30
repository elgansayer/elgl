# i18n Fixes for `components-developer-dashboard` Module

## File: `frontend/src/app/components/developer-dashboard/developer-dashboard.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `{{ store.developerStats()?.avg_latency_ms || 18 }} ms`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
