# SRS typo-aware partial credit

Issue: #2036

## Product contract

Flashcard review keeps the existing reveal-and-self-grade flow and adds an optional typed recall check before the answer is revealed. The submitted text is compared locally with the card translation. No typed answer is sent to a provider, logged, persisted, or added to analytics.

Scoring is intentionally conservative:

- Exact normalized matches suggest **Known**.
- Minor edit-distance mistakes suggest **Good**, providing partial credit without treating the answer as mastered.
- Materially different answers suggest **Again**.
- The learner can always ignore the suggestion and use the existing Again / Good / Known controls.

The comparison performs Unicode NFKC normalization, case folding, whitespace/punctuation normalization, and optimal-string-alignment Damerau-Levenshtein distance so an adjacent transposition counts as one typo. Explicit translation alternatives separated with ` / `, semicolons, or newlines are scored independently and the best match wins.

## Bounds and failure handling

Typed answers and expected alternatives are capped at 256 Unicode code points and eight alternatives. This bounds the quadratic edit-distance calculation. Blank, malformed, or overlong values return an `unavailable` assessment and do not mutate SRS state automatically.

The scoring helper is deterministic and has no network dependency. SRS persistence still uses the existing `VocabularyStore.updateSrsLevel` path, including its existing degraded/offline recovery behavior. Duplicate grade submissions remain protected by the parent review component's `isSaving` guard.

## Privacy and security

Typed recall text stays in component memory only and is reset when the card changes. It is not stored in local storage, the database, URLs, logs, telemetry, or third-party services. The feature does not change authentication, authorization, or the flashcard persistence API.

## Accessibility and internationalisation

The answer control uses the shared Spartan input/button primitives, a programmatically associated label, a 44px minimum touch target, `dir="auto"` for mixed RTL/LTR text, Enter submission, and a polite status region for the score. Existing translated review labels are reused so non-English locales continue to use the established fallback behavior.

## Verification

Focused tests cover:

- exact normalized matches;
- adjacent transpositions and ordinary one-edit typos;
- non-Latin text;
- alternative translations;
- deliberately strict short answers;
- bounded overlong inputs;
- the SRS transitions Known / Good / Again;
- continued availability of manual self-grading.

Run the frontend unit suite, or target the two new specs under `frontend/src/app/components/flashcard-review/`.

## Rollout and rollback

No schema, API, or persisted-state migration is required. The change is additive and safe for mixed frontend versions because older clients continue using the unchanged SRS write endpoint. Rollback consists of reverting the answer-check component/scorer integration; existing flashcard records and SRS levels need no repair.
