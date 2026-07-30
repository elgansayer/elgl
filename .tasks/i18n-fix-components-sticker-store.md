# i18n Fixes for `components-sticker-store` Module

## File: `frontend/src/app/components/sticker-store/sticker-store.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Sticker Store`
- `🪙 {{ userCoins() }} Coins`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
