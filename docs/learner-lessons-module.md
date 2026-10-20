# Learner lessons module

Issue #1123 is implemented as a read-only learner surface backed by the existing `lessons` table and admin authoring workflow.

## Architecture

`LessonsService` is the learner-facing Angular API client. It sends the current Supabase bearer token to:

- `GET /api/lessons`
- `GET /api/lessons/:id`

The NestJS `LearningLessonsController` exposes those read-only routes behind `SupabaseAuthGuard` and delegates to the existing `LessonsService`. Lesson creation, editing, deletion and upload management remain under the existing admin-only `/api/admin/lessons` controller.

The `/lessons` Angular page owns both browsing and reading. Selecting a lesson uses the `lesson` query parameter so the existing route remains backward compatible. Cards are native links, images use browser lazy loading, and the reader exposes segmented progress with native/Spartan controls.

## Content contract

Admin-authored `content_json` remains backward compatible. The learner UI recognises these optional fields:

```json
{
  "featured": true,
  "duration_minutes": 12,
  "stream_url": "https://example.com/live",
  "segments": [
    {
      "title": "Warm-up",
      "text": "Learner-visible plain text",
      "stream_url": "https://example.com/segment"
    }
  ]
}
```

Unknown fields are ignored. Malformed segment entries are discarded. If no usable segments exist, the plain-text lesson description is used as the reading segment. User-visible content is interpolated as text, never treated as trusted HTML.

`difficulty_level` maps from `1..6` to `A1..C2`. The "For your level" row reads the authenticated user's proficiency metadata when available and otherwise falls back to non-featured lessons. If authors have not marked any lesson as featured, the first three returned lessons form the Featured row so existing data remains usable.

## Security and privacy

Learner reads require a valid Supabase session. The browser fails closed before network I/O if no access token exists, and API failures propagate into an explicit retry state instead of returning synthetic lesson data.

Media links are accepted only when they parse as HTTP or HTTPS URLs. External stream links use `noopener noreferrer`. No new learner data, progress history, analytics or completion state is persisted by this change.

## Accessibility and responsive behaviour

- Lesson cards are native links with visible focus treatment and a title-based accessible name.
- Cover images use the lesson title as alternate text and `loading="lazy"`.
- Reader progress uses `role="progressbar"` with numeric and textual progress values.
- Previous/Next actions use touch-sized Spartan buttons and native disabled semantics.
- Content wraps at narrow widths and high zoom; layouts move from one to two to three columns without physical left/right spacing utilities.
- Lesson text and titles remain plain text, allowing browser selection, screen readers and multilingual shaping.

## Verification

Focused automated coverage lives in:

- `backend/src/lessons/learning-lessons.controller.spec.ts`
- `frontend/src/app/services/lessons.service.spec.ts`
- `frontend/src/app/pages/lessons/lessons.model.spec.ts`

The repository CI remains authoritative for frontend unit/static-analysis/build, backend unit/lint/build/E2E, design governance and dependency review.

## Rollout and rollback

No schema migration, environment variable or background job is required. Deploy the backend and frontend normally. Older frontends remain compatible because the existing admin lesson contract is unchanged.

Rollback is a normal revert. No learner progress or new persisted state requires cleanup.
