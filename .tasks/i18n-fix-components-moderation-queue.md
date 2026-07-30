# i18n Fixes for `components-moderation-queue` Module

## File: `frontend/src/app/components/moderation-queue/moderation-queue.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Moderation queue`
- `Flagged Moments`
- `Flagged Profiles`
- `No flagged moments to review.`
- `Reported by:`
- `User:`
- `Approve`
- `Reject`
- `No flagged profiles to review.`
- `Profile`
- `Reported user:`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
