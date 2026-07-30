# i18n Fixes for `components-visitor-logs` Module

## File: `frontend/src/app/components/visitor-logs/visitor-logs.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Who viewed me`
- `Recent profile visitors and language matches.`
- `Visible: {{ visibleVisitorsCount() }}`
- `Blurred: {{ blurredVisitorsCount() }}`
- `Unlock full visitor identities with VIP`
- `Visitor details are blurred on the free tier.`
- `8 UKP / $10 USD per month`
- `Loading visitors...`
- `No visitors yet.`
- `VIP only`
- `Visible`
Attributes:
- `alt="visitor avatar"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
