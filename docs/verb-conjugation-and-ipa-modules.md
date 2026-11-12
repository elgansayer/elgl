# Verb Conjugation Trainer and IPA Alphabet Module

## Purpose

Two learner-facing practice surfaces:

- **Verb conjugation trainer** (`/learn/verb-conjugation`) drills present and past tense forms for Spanish, French, Italian, Portuguese and German.
- **IPA alphabet module** (`/learn/ipa-alphabet`) documents the phoneme inventory for English, Spanish and French, and offers a symbol-to-word recognition quiz.

Both surfaces use the NestJS API. The Angular frontend never reads learning data from Supabase directly.

## API

All endpoints require a Supabase bearer token through `SupabaseAuthGuard`.

### Verb conjugation (`/api/learning/verb-conjugation`)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/languages` | Reviewed languages, tenses and verb counts |
| `GET` | `/session?language=es&tense=present&limit=5` | Builds a bounded session of multiple-choice exercises |
| `POST` | `/attempts` | Grades `{ exerciseId, answer }` and records the attempt |
| `GET` | `/progress` | Aggregated recent attempt totals for the signed-in learner |

Exercise identifiers are self-contained (`verb:<language>:<verb>:<tense>:<personIndex>`), so grading is stateless and retries are safe. The API does not return the expected form before an attempt.

### IPA alphabet (`/api/learning/ipa-alphabet`)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/languages` | Reviewed languages and inventory sizes |
| `GET` | `/catalogue?language=en` | Full phoneme chart with symbol, type, example and description |
| `GET` | `/quiz?language=en&limit=5` | Bounded symbol-to-word recognition quiz |
| `POST` | `/attempts` | Grades `{ exerciseId, answer }` and records the attempt |
| `GET` | `/progress` | Aggregated recent attempt totals for the signed-in learner |

Quiz option order is shuffled server-side. The grader normalises case, Unicode composition and whitespace, and remains accent-sensitive so that learners practise the written form accurately.

## Persistence

`supabase/migrations/20261110000000_learning_practice_attempts.sql` adds `public.learning_practice_attempts`:

- `module`: `verb_conjugation` or `ipa_alphabet`
- `item_id`, `language_code`, `submitted_answer`, `correct`, `created_at`
- `user_id` references `public.users(id)` with `ON DELETE CASCADE`, so attempts are removed with the account.
- Index `(user_id, module, created_at DESC)` supports bounded recent-progress reads.
- Row-level security only allows authenticated owners to read or insert their own rows. The API also enforces ownership through the authenticated user id and writes with the service-role client.

Attempt persistence is best effort: a storage failure is logged and graded feedback is still returned, so a database incident never blocks practice. Progress reads examine at most the 500 most recent attempts for the module to avoid unbounded scans.

## Reliability and observability

- Exercise and quiz collections are bounded (`limit` is validated between 1 and 20).
- Answer submission is throttled per learner to 30 requests per minute.
- Failed persistence and failed progress reads log the module, the operation and the database error code without storing tokens or private content.
- All unknown language, tense, exercise identifier and blank-answer cases return validation errors.

## Accessibility and UX

- Language and tense controls use the owned Spartan native select and labelled controls.
- Answer choices are real buttons with pressed state, disabled state after grading, visible focus and text feedback for correct and incorrect outcomes.
- Correctness is never communicated by colour alone: both the feedback panel and the answer text state the result.
- All product copy flows through `TranslatePipe`; learner content (verbs, phonemes, examples) is returned by the API.
- Layout uses logical Tailwind properties and works from mobile through desktop.

## Rollout and rollback

1. Apply the migration before deploying the API that writes attempts. The migration is additive and safe to retry.
2. Deploy the backend module, then the frontend routes.
3. The feature is isolated behind new routes. To roll back, remove the two routes or redeploy the previous frontend; the additive table can remain without affecting existing behaviour.
4. If attempt writes must be disabled without a deploy, the persistence call already fails open and logs a warning.

## Verification

- Backend service tests cover catalogue integrity, option uniqueness, grading, normalisation, invalid identifiers and progress aggregation.
- Controller tests cover authentication, delegation, throttle-independent grading and attempt recording.
- The migration test pins the table, constraints, index and RLS policies.
- Frontend service tests use `HttpTestingController` for every endpoint.
- Component tests cover loading, chart rendering, correct and incorrect feedback, completion summaries, language reloads and failure states.
