Priority: High Impact

Description:
Audit and enforce mobile accessibility standards across primary interactions, specifically ensuring all tappable areas meet the minimum iOS/Android guidelines of 44x44px. This prevents frustrating "fat-finger" errors, particularly on close modals and small toggle pills. Additionally, ensure screen readers can navigate these custom elements correctly.

Technical Implementation:
- In `frontend/src/app/components/correction-modal/correction-modal.component.html`, increase the padding on the close button (`<button class="p-1...">✕</button>`) to at least `p-3` or apply a minimum width/height of `44px`.
- Add an explicit `[attr.aria-label]="'common.close' | t"` to the close button for screen reader support.
- In `frontend/src/app/components/discovery/discovery.component.html`, verify the language filter pills and the serious learner checkbox have sufficient touch area. Wrap the checkbox in a larger clickable label area or increase its padding.
- Review `AppGradientButtonComponent` usages to ensure they render at least 44px high.