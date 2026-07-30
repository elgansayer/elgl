# i18n Fixes for `components-vocabulary-dashboard` Module

## File: `frontend/src/app/components/vocabulary-dashboard/vocabulary-dashboard.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `vocab.title`
- `vocab.subtitle`
- `vocab.tabReview`
- `vocab.tabDeck`
- `vocab.tabAiPractice`
- `vocab.chipSrs`
- `vocab.chipGrammar`
- `vocab.chipPronunciation`
- `vocab.noReviewCards`
- `vocab.cardProgress`
- `vocab.levelProgress`
- `vocab.tapToFlip`
- `vocab.gradeAgain`
- `vocab.gradeGood`
- `vocab.gradeKnown`
- `vocab.noSavedWords`
- `vocab.nextReviewPrefix`
- `vocab.aiBannerTitle`
- `vocab.aiBannerSubtitle`
- `vocab.practiceLabel`
- `vocab.practicePlaceholder`
- `vocab.checkGrammarBtn`
- `vocab.scorePronunciationBtn`
- `vocab.grammarAnalysisTitle`
- `vocab.originalPrefix`
- `vocab.correctedPrefix`
- `vocab.pronunciationScorePrefix`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `L{{ fc.srs_level }}`
- `= 90"                 [class.border-emerald-300]="item.score >= 90"                 [class.text-emerald-400]="item.score >= 90"                 [class.bg-amber-500/20]="item.score`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
