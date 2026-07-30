# i18n Fixes for `pages-vip-subscription` Module

## File: `frontend/src/app/pages/vip-subscription/vip-subscription.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `vip.heroTitle`
- `vip.heroSubtitle`
- `vip.seePlans`
- `vip.startFree`
- `vip.tryAgain`
- `vip.freeUpgrade`
- `vip.getStartedFree`
- `vip.premiumPlans`
- `vip.premiumSubtitle`
- `vip.mostPopular`
- `vip.billedMonthly`
- `vip.keyBenefits`
- `vip.allFeatures`
- `vip.subscribeNow`
- `vip.choosePlan`
- `vip.compareAllFeatures`
- `vip.featureTableHeader`
- `vip.faqTitle`
- `vip.faqSwitchQ`
- `vip.faqSwitchA`
- `vip.faqTrialQ`
- `vip.faqTrialA`
- `vip.faqPaymentQ`
- `vip.faqPaymentA`
- `vip.faqCancelQ`
- `vip.faqCancelA`
- `vip.ctaTitle`
- `vip.ctaSubtitle`
- `vip.viewPlans`
- `vip.continueFree`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Popular`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
