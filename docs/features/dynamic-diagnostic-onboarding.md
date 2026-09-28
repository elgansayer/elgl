# Dynamic diagnostic onboarding

Issue: #1032

## User flow

New authenticated users select a native language and at least one target language before entering the diagnostic step. The first selected target language is the diagnostic context. The user must answer every question before the final submission can complete. A successful, server-authoritative result unlocks the final display-name step; a failed submission leaves the learner on the quiz with their answers intact so they can retry.

The standalone `/diagnostic-quiz` route remains available and uses English when no target language input is supplied.

## API contract

Both diagnostic endpoints require a valid Supabase session.

- `GET /api/quiz/questions?language=<code>` returns a bounded question set. Option identifiers and copy are returned, but scoring weights are never exposed to the browser.
- `POST /api/quiz/results` accepts `{ targetLanguage, answers }`, where `answers` maps each question id to one option id. The backend reloads the canonical question bank, requires exactly one valid answer for every question, computes the score and CEFR result, and persists only the resulting `users.proficiency_level`.

If a target-specific question bank is not configured, the service uses the generic English self-assessment bank. Storage/provider failures do not fall back to synthetic questions and return a retryable service-unavailable response instead.

## Security and privacy

Scoring is authoritative on the server. Clients cannot choose point values, maximum scores, percentages, or CEFR levels. Request language codes and payload shape are validated, answer counts are bounded, option ids are checked against the current canonical bank, and result submissions are throttled.

Raw diagnostic answers are not persisted. The existing user proficiency level is the only durable learner datum written by this flow. Provider/database error details and user ids are not included in application log messages from the diagnostic service.

## Accessibility and failure handling

The quiz retains Spartan radio-group semantics, labelled progress, native disabled states, 44px minimum targets, logical spacing, and translated labels. Loading and empty outcomes use status semantics; load/submission failures are announced as alerts. A submission error never emits `quizCompleted`, so onboarding cannot advance on an unsaved result.

Changing the target-language selection invalidates the previous result and requires a fresh diagnostic. Moving backwards within the quiz preserves current answers.

## Verification

Automated coverage should verify:

1. public question payloads omit point values;
2. unsupported target banks fall back only to the configured English bank;
3. question-store failures fail closed;
4. missing/forged answers are rejected;
5. server scoring and CEFR mapping drive the persisted profile value;
6. persistence failure does not produce a successful completion;
7. the Angular component submits option ids and emits only the backend result;
8. a target-language change clears stale answers/results;
9. onboarding cannot advance past the diagnostic until completion succeeds.

## Rollout and rollback

No schema migration is required. Deploy backend and frontend together because the frontend now submits option ids instead of point values. During rollback, revert both halves together to avoid a mixed-version result payload mismatch. The backend writes to the existing `users.proficiency_level` field, so rollback requires no data migration.
